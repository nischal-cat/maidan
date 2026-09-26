/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { FALLBACK_CITY_COORDS as CITY_COORDS } from '../constants';
import { useCities } from '../hooks/useCities';

const STORAGE_KEY = 'maidan_city';

export { CITY_COORDS };

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export { haversineKm };

export interface UserCoords {
  lat: number;
  lng: number;
}

export function nearestCity(lat: number, lng: number, coordsMap: Record<string, { lat: number; lng: number }>): string {
  const names = Object.keys(coordsMap);
  if (!names.length) return 'Kathmandu';
  let best = names[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const name of names) {
    const c = coordsMap[name];
    if (!c) continue;
    const d = haversineKm(lat, lng, c.lat, c.lng);
    if (d < bestDist) {
      bestDist = d;
      best = name;
    }
  }
  return best;
}

interface LocationContextValue {
  city: string;
  setCity: (city: string) => void;
  detecting: boolean;
  detectLocation: () => Promise<boolean>;
  coords: UserCoords | null;
}

const LocationContext = createContext<LocationContextValue | undefined>(undefined);

function readStoredCity(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  } catch {
    // localStorage unavailable — fall through to default
  }
  return 'Kathmandu';
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const { cities, coordsMap } = useCities();
  const [city, setCityState] = useState(readStoredCity);
  const [detecting, setDetecting] = useState(false);
  const [coords, setCoords] = useState<UserCoords | null>(null);

  const setCity = useCallback((next: string) => {
    setCityState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore persistence failures
    }
  }, []);

  // Clamp to a real city once the server list (or fallback) is known.
  useEffect(() => {
    setCityState((prev) => (cities.some((c) => c.name === prev) ? prev : cities[0]?.name ?? 'Kathmandu'));
  }, [cities]);

  const detectLocation = useCallback(async () => {
    if (!('geolocation' in navigator)) return false;
    setDetecting(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          maximumAge: 5 * 60 * 1000,
        });
      });
      setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      setCity(nearestCity(position.coords.latitude, position.coords.longitude, coordsMap));
      return true;
    } catch {
      return false;
    } finally {
      setDetecting(false);
    }
  }, [setCity, coordsMap]);

  const value = useMemo(
    () => ({ city, setCity, detecting, detectLocation, coords }),
    [city, setCity, detecting, detectLocation, coords]
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationCity() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocationCity must be used within LocationProvider');
  return ctx;
}