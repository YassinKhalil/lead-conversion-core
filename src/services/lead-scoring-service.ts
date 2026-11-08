import type { Db } from '../db/pool.js';
import { AuditRepository } from '../infrastructure/runtime.js';
import { scoreClinicLead } from '../domain/clinic-scoring.js';
import { scoreRealEstateLead } from '../domain/lead-scoring.js';


interface ScoreLeadResult {
  scoreRunId: string;
  score: number;
  temperature: string;
  inputHash: string;
  inserted: boolean;
}

export class LeadScoringService {
  constructor(private readonly audit = new AuditRepository()) {}

  async scoreLead(client: Db, input: {
    leadId: string;
    answers?: Record<string, string>;
    actorType?: 'worker' | 'system' | 'migration';
    actorId?: string;
    correlationId?: string;
    causationId?: string;
  }): Promise<ScoreLeadResult> {
    const lead = await client.query<{
      lead_id: string;
      status: string;
      current_stage: string;
      lead_score: number | null;
      temperature: string;
      vertical: string;
    }>(
      `SELECT l.lead_id, l.status, l.current_stage, l.lead_score, l.temperature,
              (SELECT c.vertical FROM app.clients c WHERE c.client_id=l.client_id) AS vertical
       FROM app.leads l
       WHERE l.lead_id=$1
       FOR UPDATE OF l`,
      [input.leadId],
    );
    const leadRow = lead.rows[0];
    if (!leadRow) throw new Error(`lead_not_found_for_scoring:${input.leadId}`);

    const session = await client.query<{ qualification_session_id: string }>(
      `SELECT qualification_session_id
       FROM app.qualification_sessions
       WHERE lead_id=$1
       ORDER BY
         CASE WHEN status='completed' THEN 0 ELSE 1 END,
         COALESCE(completed_at, started_at) DESC,
         qualification_session_id DESC
       LIMIT 1`,
      [input.leadId],
    );
    const sessionId = session.rows[0]?.qualification_session_id || null;
    const answers = sessionId
      ? await client.query<{ question_key: string; normalized_value: string }>(
          `SELECT question_key, normalized_value
           FROM app.qualification_answers
           WHERE qualification_session_id=$1
           ORDER BY question_key`,
          [sessionId],
        )
      : { rows: [] };
    const answerMap = {
      ...Object.fromEntries(answers.rows.map((row) => [row.question_key, row.normalized_value])),
      ...(input.answers || {}),
    };
    const scorer = leadRow.vertical === 'clinic' ? scoreClinicLead : scoreRealEstateLead;
    const result = scorer({
      leadStatus: leadRow.status,
      currentStage: leadRow.current_stage,
      answers: answerMap,
    });

    const inserted = await client.query<{ score_run_id: string }>(
      `INSERT INTO app.score_runs
        (lead_id, qualification_session_id, scoring_version, score, temperature,
         input_hash, factors_json, source_snapshot_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
       ON CONFLICT (lead_id, scoring_version, input_hash) WHERE input_hash <> 'legacy-import' DO NOTHING
       RETURNING score_run_id`,
      [
        input.leadId,
        sessionId,
        result.scoringVersion,
        result.score,
        result.temperature,
        result.inputHash,
        JSON.stringify({
          missingAnswers: result.missingAnswers,
          factors: result.factors,
        }),
        JSON.stringify(result.sourceSnapshot),
      ],
    );
    let scoreRunId = inserted.rows[0]?.score_run_id || '';
    const wasInserted = Boolean(scoreRunId);
    if (!scoreRunId) {
      const existing = await client.query<{ score_run_id: string }>(
        `SELECT score_run_id
         FROM app.score_runs
         WHERE lead_id=$1 AND scoring_version=$2 AND input_hash=$3
         LIMIT 1`,
        [input.leadId, result.scoringVersion, result.inputHash],
      );
      scoreRunId = existing.rows[0]?.score_run_id || '';
    }
    if (!scoreRunId) throw new Error('score_run_not_created');

    await client.query(
      `UPDATE app.leads
       SET lead_score=$2,
           temperature=$3,
           updated_at=now()
       WHERE lead_id=$1`,
      [input.leadId, result.score, result.temperature],
    );

    const scoreChanged = leadRow.lead_score !== result.score || leadRow.temperature !== result.temperature;
    if (wasInserted || scoreChanged) {
      await this.audit.record(client, {
        eventType: 'lead.scored',
        actorType: input.actorType || 'worker',
        actorId: input.actorId || 'lead-scoring-service',
        aggregateType: 'lead',
        aggregateId: input.leadId,
        ...(input.correlationId ? { correlationId: input.correlationId } : {}),
        causationId: input.causationId || scoreRunId,
        payload: {
          scoringVersion: result.scoringVersion,
          scoreRunId,
          inputHash: result.inputHash,
          missingAnswers: result.missingAnswers,
        },
        before: {
          score: leadRow.lead_score,
          temperature: leadRow.temperature,
        },
        after: {
          score: result.score,
          temperature: result.temperature,
        },
      });
    }

    return {
      scoreRunId,
      score: result.score,
      temperature: result.temperature,
      inputHash: result.inputHash,
      inserted: wasInserted,
    };
  }
}
