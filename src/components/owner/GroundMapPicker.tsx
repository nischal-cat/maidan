import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Search, LocateFixed, ExternalLink, MapPin } from 'lucide-react';
import { useLocationCity } from '../../context/LocationContext';
import { useCities } from '../../hooks/useCities';
import { Spinner } from '../ui/spinner';

export interface GroundMapValue {
  latitude: number | null;
  longitude: number | null;
  address?: string;
}

interface GroundMapPickerProps {
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
  onChange: (value: GroundMapValue) => void;
}

interface PlaceResult {
  lat: number;
  lon: number;
  name: string;
}

const DEFAULT_FALLBACK = { lat: 27.7172, lng: 85.324 } as const;

const pinIcon = L.divIcon({
  className: 'bg-transparent',
  html: `<div style="position:relative;width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:var(--primary);border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"><div style="position:absolute;inset:0;margin:auto;width:8px;height:8px;border-radius:50%;background:#fff"></div></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 24],
});

function Recenter({ center }: { center: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo([center.lat, center.lng], Math.max(map.getZoom(), 15));
  }, [map, center]);
  return null;
}

function MapSizer() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

export default function GroundMapPicker({ latitude, longitude, address, onChange }: GroundMapPickerProps) {
  const { city } = useLocationCity();
  const { coordsMap } = useCities();

  const hasPin = latitude != null && longitude != null;

  const startCenter = useMemo(() => {
    if (latitude != null && longitude != null) return { lat: latitude, lng: longitude };
    const c = coordsMap[city] ?? DEFAULT_FALLBACK;
    return { lat: c.lat, lng: c.lng };
  }, [latitude, longitude, city, coordsMap]);

  const [centerTarget, setCenterTarget] = useState<{ lat: number; lng: number } | null>(hasPin ? startCenter : null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const searchSeq = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setResults([]);
      setShowResults(false);
      return;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=np&q=${encodeURIComponent(trimmed)}`,
          { headers: { Accept: 'application/json' } }
        );
        if (!res.ok) throw new Error('lookup failed');
        const data = await res.json();
        if (seq !== searchSeq.current) return;
        const mapped: PlaceResult[] = (Array.isArray(data) ? data : []).map((r: { lat?: string; lon?: string; display_name?: string }) => ({
          lat: parseFloat(r.lat ?? '0'),
          lon: parseFloat(r.lon ?? '0'),
          name: (r.display_name ?? '').split(',').slice(0, 3).join(','),
        }));
        setResults(mapped);
        setShowResults(mapped.length > 0);
      } catch {
        if (seq === searchSeq.current) setError('Could not search that address. Try dropping the pin on the map instead.');
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [query]);

  const pick = (lat: number, lng: number, addressLabel?: string) => {
    onChange({ latitude: lat, longitude: lng, address: addressLabel });
    setCenterTarget({ lat, lng });
    setShowResults(false);
  };

  const useCurrentLocation = async () => {
    if (!('geolocation' in navigator)) {
      setError('Location is not supported on this device.');
      return;
    }
    setLocating(true);
    setError(null);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });
      pick(position.coords.latitude, position.coords.longitude);
    } catch {
      setError('Could not detect your location. Search an address or drop the pin manually.');
    } finally {
      setLocating(false);
    }
  };

  const mapsUrl = latitude != null && longitude != null
    ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
    : address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
      : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <label htmlFor="map-search" className="sr-only">Search address</label>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            id="map-search"
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setError(null); }}
            onFocus={() => results.length > 0 && setShowResults(true)}
            placeholder="Search an address, e.g. Dharan Chowk"
            autoComplete="off"
            className="min-h-11 w-full rounded-xl border border-input bg-background pl-10 pr-10 text-sm font-semibold text-foreground outline-none transition-colors placeholder:font-medium placeholder:text-muted-foreground focus:border-primary focus-visible:ring-2 focus-visible:ring-ring"
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              <Spinner className="h-4 w-4" />
            </span>
          )}
          {showResults && (
            <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-xl border border-border bg-card py-1 shadow-card">
              {results.map((r, i) => (
                <li key={`${r.lat}-${r.lon}-${i}`}>
                  <button
                    type="button"
                    onClick={() => {
                      pick(r.lat, r.lon, r.name);
                      setQuery(r.name);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-card-foreground transition-colors hover:bg-accent"
                  >
                    <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span className="truncate">{r.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={locating}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold text-primary transition-colors hover:bg-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LocateFixed className={`h-4 w-4 ${locating ? 'animate-pulse' : ''}`} aria-hidden />
          {locating ? 'Locating…' : 'My location'}
        </button>
      </div>

      {hasPin && (
        <p className="text-xs font-semibold text-muted-foreground">
          Pin: {Number(latitude).toFixed(6)}, {Number(longitude).toFixed(6)}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-border">
        <MapContainer
          center={[startCenter.lat, startCenter.lng]}
          zoom={hasPin ? 15 : 12}
          scrollWheelZoom={true}
          className="h-64 w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Recenter center={centerTarget} />
          <MapSizer />
          {hasPin && (
            <Marker
              position={[latitude as number, longitude as number]}
              icon={pinIcon}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const latLng = (e.target as L.Marker).getLatLng();
                  onChange({ latitude: latLng.lat, longitude: latLng.lng });
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      {error && <p className="text-sm font-semibold text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground">
          Drag the green pin to the exact spot, or use the search box.
        </p>
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-bold text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            Open in Google Maps
          </a>
        )}
      </div>
    </div>
  );
}