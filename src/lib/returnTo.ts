export function buildBookingReturnTo(groundId: string, date: string, slotId?: string, time?: string): string {
  const params = new URLSearchParams({ date });
  if (time) {
    params.set('time', time);
  } else if (slotId) {
    params.set('slot', slotId);
  }
  return `/grounds/${groundId}?${params.toString()}`;
}

export function buildBatchBookingReturnTo(groundId: string, date: string, slotIds: string[]): string {
  const params = new URLSearchParams({ date });
  if (slotIds.length > 0) {
    params.set('slots', slotIds.join(','));
  }
  return `/grounds/${groundId}/book?${params.toString()}`;
}

export function encodeReturnTo(path: string): string {
  return encodeURIComponent(path);
}

export function safeReturnTo(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return '/';
  let value: string;
  try {
    value = decodeURIComponent(raw);
  } catch {
    value = raw;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 500) return '/';
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) return '/';
  if (/^\/[^/]*:/.test(trimmed)) return '/';
  return trimmed;
}