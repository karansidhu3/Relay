import type {
  ApiResponse,
  DlqResponse,
  EventDetail,
  EventsPage,
  OverviewStats,
} from '../../types/relay';

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_RELAY_API_BASE_URL ??
    process.env.RELAY_API_BASE_URL ??
    ''
  );
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  const body = (await res.json()) as ApiResponse<T>;

  if (!body.success) {
    throw new Error(body.error.message);
  }

  return body.data;
}

export async function getOverview(): Promise<OverviewStats> {
  return apiFetch<OverviewStats>('/dashboard/overview');
}

export async function getEvents(
  projectId: string,
  params?: { status?: string; cursor?: string; limit?: number },
): Promise<EventsPage> {
  const qs = new URLSearchParams({ project_id: projectId });
  if (params?.status) qs.set('status', params.status);
  if (params?.cursor) qs.set('cursor', params.cursor);
  if (params?.limit) qs.set('limit', String(params.limit));
  return apiFetch<EventsPage>(`/events?${qs.toString()}`);
}

export async function getEvent(eventId: string): Promise<EventDetail> {
  return apiFetch<EventDetail>(`/events/${eventId}`);
}

export async function getDlq(): Promise<DlqResponse> {
  return apiFetch<DlqResponse>('/dashboard/dlq');
}

export async function requeueEvent(eventId: string): Promise<{ event_id: string; status: string; requeued_at: string }> {
  return apiFetch<{ event_id: string; status: string; requeued_at: string }>(
    `/dashboard/dlq/${eventId}/requeue`,
    { method: 'POST' },
  );
}

export function getEventsKey(
  projectId: string,
  params?: { status?: string; cursor?: string; limit?: number },
): string {
  const qs = new URLSearchParams({ project_id: projectId });
  if (params?.status) qs.set('status', params.status);
  if (params?.cursor) qs.set('cursor', params.cursor);
  if (params?.limit) qs.set('limit', String(params.limit));
  return `/events?${qs.toString()}`;
}
