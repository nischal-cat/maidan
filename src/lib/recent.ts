const RECENT_KEY = 'maidan_recent_grounds';
const PENDING_KEY = 'maidan_pending_booking';
const MAX_RECENT = 8;

export interface RecentGround {
  id: string;
  name: string;
  city?: string;
  address?: string;
  basePrice?: number;
  rating?: number | null;
  imageUrl?: string | null;
  gallery?: string[] | null;
  ts: number;
}

export interface PendingDraft {
  groundId?: string;
  groundName?: string;
  date?: string;
  slotId?: string;
  startTime?: string;
  endTime?: string;
  price?: number;
}

export function getRecentGrounds(): RecentGround[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function addRecentGround(ground: Omit<RecentGround, 'ts'>): void {
  try {
    const rest = getRecentGrounds().filter((g) => g.id !== ground.id);
    const next = [{ ...ground, ts: Date.now() }, ...rest].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable — recents are best-effort
  }
}

export function getPendingDraft(): PendingDraft | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingDraft) : null;
  } catch {
    return null;
  }
}

export function clearPendingDraft(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}
