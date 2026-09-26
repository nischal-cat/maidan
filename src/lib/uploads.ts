const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5001/api').replace(/\/api\/?$/, '');

export function resolveUploadUrl(path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('/uploads/')) return `${API_ORIGIN}${path}`;
  return path;
}

export function firstGroundImage(ground: { imageUrl?: string | null; gallery?: string[] | null }): string | null {
  return resolveUploadUrl(ground.gallery?.[0] || ground.imageUrl || null);
}