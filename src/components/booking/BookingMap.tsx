import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ExternalLink, MapPin, Navigation } from 'lucide-react';
import { directionsUrl, formatAddress, hasPin, searchUrl, type MapTarget } from '../../lib/maps';
import { Button } from '../ui/button';

// Leaflet's default marker images 404 under a bundler, so both the ground
// picker and this map use an inline divIcon instead. Same shape, same colour.
const pinIcon = L.divIcon({
  className: 'bg-transparent',
  html: `<div style="position:relative;width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:var(--primary);border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"><div style="position:absolute;inset:0;margin:auto;width:8px;height:8px;border-radius:50%;background:#fff"></div></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 24],
});

/** Leaflet mis-measures itself when it mounts inside a not-yet-laid-out box. */
function MapSizer() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

interface BookingMapProps extends MapTarget {
  /** Rendered above the map, e.g. the ground name. */
  label?: string;
  className?: string;
}

/**
 * Read-only location map for a booking.
 *
 * Deliberately not interactive beyond panning: this is a "where do I go" view,
 * not an editor. When the ground has no pin (owners can leave latitude and
 * longitude null) we degrade to an address card with a Google Maps hand-off
 * rather than showing an empty map or centring on Kathmandu pretending to be
 * the venue.
 */
export default function BookingMap({ latitude, longitude, address, city, label, className }: BookingMapProps) {
  const target = useMemo<MapTarget>(() => ({ latitude, longitude, address, city }), [latitude, longitude, address, city]);
  const pinned = hasPin(target);
  const directions = directionsUrl(target);
  const search = searchUrl(target);
  const humanAddress = formatAddress(target);

  if (!humanAddress && !pinned) return null;

  return (
    <div className={className}>
      {pinned ? (
        <div className="overflow-hidden rounded-2xl border border-border">
          <MapContainer
            center={[latitude as number, longitude as number]}
            zoom={15}
            scrollWheelZoom={false}
            className="h-56 w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[latitude as number, longitude as number]} icon={pinIcon} />
            <MapSizer />
          </MapContainer>
        </div>
      ) : (
        // No pin: say so plainly instead of showing a map of the wrong place.
        <div className="flex items-start gap-3 rounded-2xl border border-dashed border-border bg-muted p-4">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-bold text-card-foreground">{label || humanAddress}</p>
            {label && humanAddress !== label && <p className="mt-0.5 text-xs text-muted-foreground">{humanAddress}</p>}
            <p className="mt-1 text-xs text-muted-foreground">
              This venue has not pinned its exact location yet. Directions will open in Google Maps.
            </p>
          </div>
        </div>
      )}

      {humanAddress && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{humanAddress}</span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {directions && (
          <Button asChild variant="primary" size="sm">
            <a href={directions} target="_blank" rel="noopener noreferrer">
              <Navigation className="h-4 w-4" aria-hidden /> Directions
            </a>
          </Button>
        )}
        {search && (
          <Button asChild variant="outline" size="sm">
            <a href={search} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" aria-hidden /> Open in Google Maps
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
