import { useInfiniteQuery } from '@tanstack/react-query';
import * as api from '@/api/endpoints';
import type { AppointmentFilters, AppointmentPage } from '@/api/types';

const PAGE_SIZE = 50;

/** There is no appointment event on the stream, so a list refreshes itself every 30 seconds. */
const REFRESH_MS = 30_000;

export function useAppointmentList(filters: AppointmentFilters) {
  return useInfiniteQuery({
    queryKey: ['appointments', 'list', filters] as const,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.listAppointments(filters, { limit: PAGE_SIZE, offset: pageParam as number }),
    getNextPageParam: (lastPage: AppointmentPage) => {
      const loaded = lastPage.offset + lastPage.appointments.length;
      return loaded < lastPage.total ? loaded : undefined;
    },
    refetchInterval: REFRESH_MS,
  });
}
