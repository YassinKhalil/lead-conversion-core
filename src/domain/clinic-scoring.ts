import {
  sha256Hex, stableJson, temperature,
  type LeadScoreFactor, type LeadScoreResult, type LeadScoringInput,
} from './lead-scoring.js';

export const CLINIC_SCORING_VERSION = 'clinic_v1';

/**
 * A booking priority, not a clinical assessment: it orders the front desk's
 * queue by how soon the patient wants to be seen and how likely they are to
 * book. It never reads or infers symptoms, which the flow does not collect.
 */
const REQUIRED_ANSWERS = ['q_service', 'q_patient_type', 'q_urgency', 'q_time_pref', 'q_coverage', 'q_book_now'];

const text = (answers: Record<string, string>, key: string): string => String(answers[key] || '').trim();

function urgencyPoints(value: string): number {
  if (value === 'asap') return 45;
  if (value === 'this_week') return 20;
  return value ? 5 : 0;
}

export function scoreClinicLead(input: LeadScoringInput): LeadScoreResult {
  const answers = { ...input.answers };
  const factors: LeadScoreFactor[] = [];
  const add = (key: string, points: number, value: string, reason: string) => factors.push({ key, points, value, reason });
  const missingAnswers = REQUIRED_ANSWERS.filter((key) => !text(answers, key));

  add('base', 10, 'clinic', 'Baseline score for a patient who finished the booking questions');
  const urgency = text(answers, 'q_urgency');
  add('urgency', urgencyPoints(urgency), urgency, 'The sooner the patient wants to be seen, the higher the priority');
  const patientType = text(answers, 'q_patient_type');
  add('patient_type', patientType === 'new' ? 15 : patientType ? 8 : 0, patientType, 'A new patient is worth a quicker first call');
  const bookNow = text(answers, 'q_book_now').toLocaleLowerCase();
  add('book_now', bookNow === 'yes' ? 20 : 0, bookNow, 'Asking for a slot now is a strong booking signal');
  const service = text(answers, 'q_service');
  add('service_present', service ? 5 : 0, service, 'A known kind of visit lets the desk prepare');
  const coverage = text(answers, 'q_coverage');
  add('coverage_known', coverage && coverage !== 'unsure' ? 5 : 0, coverage, 'Knowing how the visit is paid avoids a back-and-forth');
  add(
    'qualified_state',
    input.leadStatus === 'qualified' || input.currentStage === 'qualified' ? 5 : 0,
    `${input.leadStatus}:${input.currentStage}`,
    'Completed qualification state is required before high-confidence routing',
  );

  const score = Math.max(0, Math.min(100, factors.reduce((total, factor) => total + factor.points, 0)));
  const sourceSnapshot: LeadScoringInput = { leadStatus: input.leadStatus, currentStage: input.currentStage, answers };
  return {
    scoringVersion: CLINIC_SCORING_VERSION,
    score,
    temperature: temperature(score),
    inputHash: sha256Hex(stableJson({ scoringVersion: CLINIC_SCORING_VERSION, sourceSnapshot })),
    missingAnswers,
    factors,
    sourceSnapshot,
  };
}
