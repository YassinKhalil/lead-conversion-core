import { View } from 'react-native';
import { words } from '@/profile/words';
import type { ActivityItem, LeadDetail, QualificationAnswer, RoutingRun, ScoreRun } from '@/api/types';
import { EmptyState } from '@/design/StateBlock';
import { Text } from '@/design/Text';
import { color, radius, space } from '@/design/tokens';
import { eventLabel, factorLabel, questionLabel, valueLabel } from '@/leads/labels';
import { useProfile } from '@/profile/ProfileProvider';
import { indexAnswers, skipReason } from '@/leads/qualification';
import { ageAgo, timestamp } from '@/time/format';

function SectionHeading({ title, note }: { title: string; note?: string }) {
  return (
    <View style={{ paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space.md, gap: 2 }}>
      <Text size="label" weight="semibold">
        {title}
      </Text>
      {note ? (
        <Text size="micro" tone="faint">
          {note}
        </Text>
      ) : null}
    </View>
  );
}

function Row({ children, last = false }: { children: React.ReactNode; last?: boolean }) {
  return (
    <View
      style={{
        paddingHorizontal: space.xl,
        paddingVertical: space.lg,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: color.line2,
        backgroundColor: color.paper,
      }}
    >
      {children}
    </View>
  );
}

/** Unanswered questions stay visible and are labelled, never hidden. */
export function QualificationTab({ qualification }: { qualification: LeadDetail['qualification'] }) {
  const profile = useProfile();
  const answers = qualification.answers;
  const answered = answers.filter((answer) => answer.answered).length;

  if (answers.length === 0) {
    return (
      <EmptyState
        title="No qualification questions recorded"
        detail={profile.qualificationEmptyDetail}
      />
    );
  }

  const byKey = indexAnswers(answers);

  return (
    <View>
      <SectionHeading
        title={profile.qualificationTitle}
        note={`${answered} of ${answers.length} answered · session ${qualification.status.replace(/_/g, ' ')}`}
      />
      {answers.map((answer: QualificationAnswer, position) => (
        <Row key={answer.questionKey} last={position === answers.length - 1}>
          <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'flex-start' }}>
            <Text size="small" tone="faint" numeric style={{ width: 18 }}>
              {answer.order}
            </Text>
            <View style={{ flex: 1, gap: space.xs }}>
              <Text size="small" weight="semibold" tone={answer.answered ? 'default' : 'faint'}>
                {questionLabel(answer.questionKey, profile)}
              </Text>
              {answer.answered ? (
                <>
                  <Text size="body" autoDirection>
                    {valueLabel(answer.questionKey, answer.normalizedValue, profile) !== answer.normalizedValue
                      ? valueLabel(answer.questionKey, answer.normalizedValue, profile)
                      : answer.rawValue || answer.normalizedValue}
                  </Text>
                  {answer.normalizedValue && answer.normalizedValue !== answer.rawValue ? (
                    <Text size="micro" tone="muted" numeric>
                      Parsed as {answer.normalizedValue}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text size="small" tone="faint">
                  {skipReason(answer.questionKey, byKey)}
                </Text>
              )}
            </View>
            {answer.answeredAt ? (
              <Text size="micro" tone="faint" numeric>
                {ageAgo(answer.answeredAt)}
              </Text>
            ) : null}
          </View>
        </Row>
      ))}
    </View>
  );
}

export function ScoreTab({ scoreRun }: { scoreRun: ScoreRun | null }) {
  const profile = useProfile();
  if (!scoreRun) {
    return (
      <EmptyState
        title="Not scored yet"
        detail="A score is computed once the qualification conversation produces enough answers. Until then the lead shows as unscored."
      />
    );
  }

  return (
    <View>
      <SectionHeading
        title="Score"
        note={`${scoreRun.scoringVersion} · ${ageAgo(scoreRun.createdAt)}`}
      />
      <Row>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.md }}>
          <Text size="title" weight="bold" numeric>
            {scoreRun.score}
          </Text>
          <Text size="small" tone="muted">
            {scoreRun.temperature}
          </Text>
        </View>
      </Row>

      {scoreRun.factors.map((factor, index) => (
        <Row key={`${factor.key}-${index}`} last={index === scoreRun.factors.length - 1 && scoreRun.missingAnswers.length === 0}>
          <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text size="small" weight="semibold">
                {factorLabel(factor.key, profile)}
              </Text>
              <Text size="micro" tone="muted">
                {factor.reason || 'No reason recorded'}
              </Text>
            </View>
            <Text size="small" weight="semibold" numeric>
              {factor.points > 0 ? `+${factor.points}` : String(factor.points)}
            </Text>
          </View>
        </Row>
      ))}

      {scoreRun.missingAnswers.length > 0 ? (
        <Row last>
          <View style={{ gap: space.xs }}>
            <Text size="small" weight="semibold" style={{ color: color.ink2 }}>
              Scored without {scoreRun.missingAnswers.length} answer
              {scoreRun.missingAnswers.length === 1 ? '' : 's'}
            </Text>
            <Text size="micro" tone="muted">
              {scoreRun.missingAnswers.map((key) => questionLabel(key, profile)).join(', ')}. These contributed no points.
            </Text>
          </View>
        </Row>
      ) : null}
    </View>
  );
}

function MatchFlag({ label, matched }: { label: string; matched: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 2,
          borderWidth: 1,
          borderColor: matched ? color.ink : color.lineStrong,
          backgroundColor: matched ? color.tint : 'transparent',
        }}
      />
      <Text size="micro" style={{ color: matched ? color.ink : color.ink3 }}>
        {label}
        {matched ? '' : ' ✕'}
      </Text>
    </View>
  );
}

export function RoutingTab({ routingRun }: { routingRun: RoutingRun | null }) {
  const profile = useProfile();
  const w = (s: string) => words(s, profile.terms);
  if (!routingRun) {
    return (
      <EmptyState
        title="Not routed yet"
        detail={w(`Routing runs after scoring. It records every {person} considered and why one was chosen.`)}
      />
    );
  }

  return (
    <View>
      <SectionHeading
        title="Routing"
        note={`${routingRun.outcome.replace(/_/g, ' ')} · ${routingRun.routingVersion} · ${ageAgo(routingRun.createdAt)}`}
      />
      {routingRun.candidates.length === 0 ? (
        <Row last>
          <Text size="small" tone="muted">
            No candidates were recorded for this run.
          </Text>
        </Row>
      ) : (
        routingRun.candidates.map((candidate, index) => (
          <Row key={candidate.salespersonId || index} last={index === routingRun.candidates.length - 1}>
            <View style={{ gap: space.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <Text size="small" tone="faint" numeric style={{ width: 18 }}>
                  {candidate.rank}
                </Text>
                <Text size="small" weight={candidate.selected ? 'bold' : 'medium'} style={{ flex: 1 }}>
                  {candidate.name || candidate.salespersonId}
                </Text>
                {candidate.selected ? (
                  <View
                    style={{
                      backgroundColor: color.tint,
                      borderRadius: radius.sm,
                      paddingHorizontal: space.md,
                      paddingVertical: 2,
                    }}
                  >
                    <Text size="micro" weight="bold">
                      SELECTED
                    </Text>
                  </View>
                ) : null}
                <Text size="small" weight="semibold" numeric>
                  {candidate.score}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, paddingLeft: 30 }}>
                <MatchFlag label={profile.terms.category.toLowerCase()} matched={candidate.unitMatch} />
                <MatchFlag label="language" matched={candidate.languageMatch} />
                <MatchFlag label="location" matched={candidate.locationMatch} />
                <Text size="micro" tone="faint" numeric>
                  priority {candidate.priorityRank} · {candidate.activeAssignmentCount} active
                </Text>
              </View>
            </View>
          </Row>
        ))
      )}
    </View>
  );
}

export function ActivityTab({ activity }: { activity: ActivityItem[] }) {
  const profile = useProfile();
  const w = (s: string) => words(s, profile.terms);
  if (activity.length === 0) {
    return (
      <EmptyState
        title="No activity recorded"
        detail={w(`Every intake, message, SLA timer, follow-up and dashboard action on this {lead} is appended here as it happens.`)}
      />
    );
  }

  return (
    <View>
      <SectionHeading title="Activity" note="Newest first · from the append-only audit log" />
      {activity.map((event, index) => (
        <Row key={event.auditEventId} last={index === activity.length - 1}>
          <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text size="small" weight="semibold">
                {eventLabel(event.eventType, profile)}
              </Text>
              <Text size="micro" tone="faint">
                {event.actorType}
                {event.actorId ? ` · ${event.actorId.slice(0, 8)}` : ''}
              </Text>
            </View>
            <Text size="micro" tone="faint" numeric>
              {timestamp(event.createdAt)}
            </Text>
          </View>
        </Row>
      ))}
    </View>
  );
}
