import { View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { LeadListSkeleton } from '@/design/Skeleton';
import { color, layout } from '@/design/tokens';
import { useProfile } from '@/profile/ProfileProvider';

/**
 * Appointments exist for clinic tenants. The link is hidden for others, and
 * this guard is the control: a user of another vertical who types the address lands home.
 */
export default function AppointmentsLayout() {
  const { status } = useAuth();
  const profile = useProfile();

  if (status === 'restoring') {
    return (
      <View style={{ flex: 1, backgroundColor: color.tint, paddingTop: layout.queueHeader }}>
        <LeadListSkeleton rows={6} />
      </View>
    );
  }
  if (status === 'anonymous') return <Redirect href="/login" />;
  if (!profile.features.appointments) return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.tint } }} />;
}
