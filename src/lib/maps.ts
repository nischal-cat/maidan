/**
 * Single source of truth for every "where is this ground" link.
 *
 * Three call sites used to build these independently (GroundDetailPage,
 * GroundMapPicker, and now the booking detail page), which is how they drifted.
 * Anything that needs to show or link a location should go through here.
 */

export interface MapTarget {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  city?: string | null;
}

export function hasPin(target: MapTarget): boolean {
  return target.latitude != null && target.longitude != null;
}

/** Single-line human address, falling back to the city when the street is blank. */
export function formatAddress(target: MapTarget): string {
  const parts = [target.address, target.city].map((p) => (p ?? '').trim()).filter(Boolean);
  return parts.join(', ');
}

/**
 * The string we hand to Google Maps. Prefers the pin (exact, language-neutral),
 * falls back to a free-text address for grounds whose owner never dropped one.
 */
export function mapQuery(target: MapTarget): string {
  if (hasPin(target)) return `${target.latitude},${target.longitude}`;
  const text = formatAddress(target);
  if (!text) return '';
  return encodeURIComponent(text);
}

/** Turn-by-turn directions to the ground. */
export function directionsUrl(target: MapTarget): string | null {
  const q = mapQuery(target);
  if (!q) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}

/** Open the pin / address in the Google Maps app. */
export function searchUrl(target: MapTarget): string | null {
  const q = mapQuery(target);
  if (!q) return null;
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** Centre used when a ground has no pin: its city, else the whole country. */
export const NEPAL_FALLBACK_CENTER = { lat: 27.7172, lng: 85.324 } as const;
