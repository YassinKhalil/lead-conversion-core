import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { explain } from '@/api/errors';
import type { Appointment } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { activeCount, dayLabel, groupByDay, statusLabel, timeIn, todayIn } from '@/appointments/format';
import { useAppointmentList } from '@/appointments/hooks';
import { Button } from '@/design/Button';
import { LeadListSkeleton } from '@/design/Skeleton';
import { EmptyState, ErrorState } from '@/design/StateBlock';
import { Text } from '@/design/Text';
import { color, hitSlop, layout, radius, space } from '@/design/tokens';
import { Page } from '@/desk/Page';
import { valueLabel } from '@/leads/labels';
import { useProfile } from '@/profile/ProfileProvider';
import { rangeFor, type RangeKey } from '@/reservations/format';

const RANGES: Array<{ key: RangeKey; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'upcoming', label: 'Upcoming' },
];

export default function Appointments() {
  const { user } = useAuth();
  const profile = useProfile();
  const router = useRouter();
  const timezone = user?.timezone ?? 'Europe/Madrid';
  const today = useMemo(() => todayIn(timezone), [timezone]);
  const [range, setRange] = useState<RangeKey>('today');

  const filters = useMemo(() => rangeFor(range, today), [range, today]);
  const list = useAppointmentList(filters);

  const items = useMemo<Appointment[]>(() => list.data?.pages.flatMap((page) => page.appointments) ?? [], [list.data]);
  const days = useMemo(() => groupByDay(items), [items]);

  const failed = list.isError && items.length === 0;
  const explained = failed ? explain(list.error, 'Loading appointments') : null;
  const refresh = () => void list.refetch();
  const subtitle = list.isLoading ? undefined : `${activeCount(items)} ${activeCount(items) === 1 ? 'appointment' : 'appointments'} in this view.`;

  return (
    <Page
      title="Appointments"
      {...(subtitle ? { subtitle } : {})}
      actions={
        <View style={{ flexDirection: 'row', gap: space.md, flexWrap: 'wrap' }}>
          {RANGES.map((option) => (
            <Chip key={option.key} label={option.label} active={range === option.key} onPress={() => setRange(option.key)} />
          ))}
        </View>
      }
    >
      {list.isLoading ? (
        <Panel>
          <LeadListSkeleton rows={5} urgent={0} />
        </Panel>
      ) : explained ? (
        <ErrorState title={explained.title} detail={explained.detail} onRetry={refresh} />
      ) : days.length === 0 ? (
        <Panel>
          <EmptyState
            title={range === 'today' ? 'Nothing booked for today' : range === 'tomorrow' ? 'Nothing booked for tomorrow' : 'No upcoming appointments'}
            detail={`Appointments appear here when ${profile.terms.leads.toLowerCase()} pick a time on WhatsApp. Open one to see the whole conversation.`}
          />
        </Panel>
      ) : (
        days.map((day) => (
          <View key={day.date} style={{ gap: layout.rowY }}>
            <Text size="title" weight="semibold" role="heading" aria-level={2}>
              {dayLabel(day.date, today)}
            </Text>
            <Panel>
              {day.items.map((item) => (
                <Row key={item.appointmentId} item={item} profile={profile} onPress={() => router.push(`/leads/${item.leadId}`)} />
              ))}
            </Panel>
          </View>
        ))
      )}

      {list.hasNextPage ? (
        <View style={{ alignItems: 'center' }}>
          <Button label="Show more" variant="outline" busy={list.isFetchingNextPage} onPress={() => void list.fetchNextPage()} />
        </View>
      ) : null}
      <View style={{ alignItems: 'flex-start' }}>
        <Button label="Refresh" variant="text" busy={list.isRefetching} onPress={refresh} />
      </View>
      <RefreshControl refreshing={false} onRefresh={refresh} style={{ height: 0 }} />
    </Page>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ borderWidth: 1, borderColor: color.line, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: color.paper }}>
      {children}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      hitSlop={hitSlop}
      onPress={onPress}
      style={{
        paddingVertical: space.md,
        paddingHorizontal: space.xl,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: active ? color.ink : color.lineStrong,
        backgroundColor: active ? color.ink : color.paper,
      }}
    >
      <Text size="small" weight="medium" tone={active ? 'inverse' : 'default'}>
        {label}
      </Text>
    </Pressable>
  );
}

function Row({ item, profile, onPress }: { item: Appointment; profile: ReturnType<typeof useProfile>; onPress: () => void }) {
  const dim = item.status === 'cancelled' || item.status === 'no_show';
  const service = valueLabel('q_service', item.service, profile);
  const detail = [
    service,
    valueLabel('q_patient_type', item.patientType, profile),
    item.urgency === 'asap' ? valueLabel('q_urgency', item.urgency, profile) : '',
    item.coordinatorName ? `${profile.terms.person} ${item.coordinatorName}` : '',
  ].filter(Boolean);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.patientName || item.patientPhone}, ${service || 'appointment'}, ${statusLabel(item.status)}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: space.lg,
        paddingHorizontal: layout.rowX,
        paddingVertical: layout.rowY,
        minHeight: layout.tableRow,
        borderBottomWidth: 1,
        borderBottomColor: color.line2,
        backgroundColor: pressed ? color.line2 : color.paper,
        opacity: dim ? 0.6 : 1,
      })}
    >
      <Text size="body" weight="semibold" numeric style={{ width: 64 }}>
        {timeIn(item.timezone, item.startsAt)}
      </Text>
      <View style={{ flexGrow: 1, flexBasis: 200, gap: space.hair }}>
        <Text size="body" weight="medium" autoDirection>
          {item.patientName || item.patientPhone}
        </Text>
        {detail.length > 0 ? (
          <Text size="small" tone="muted">
            {detail.join(' · ')}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', flexBasis: 120 }}>
        <Text size="small" weight="medium">
          {statusLabel(item.status)}
        </Text>
      </View>
    </Pressable>
  );
}
