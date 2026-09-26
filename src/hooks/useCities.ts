import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { citiesAPI } from '../services/api';
import { FALLBACK_CITIES, FALLBACK_CITY_COORDS } from '../constants';
import type { City } from '../types';

export function useCities() {
  const query = useQuery({
    queryKey: ['cities'],
    queryFn: async () => (await citiesAPI.getCities()).data.cities,
    staleTime: 5 * 60_000,
  });

  const cities: City[] = query.data ?? FALLBACK_CITIES;

  const coordsMap = useMemo(() => {
    const map: Record<string, { lat: number; lng: number }> = {};
    for (const city of cities) {
      if (city.latitude != null && city.longitude != null) {
        map[city.name] = { lat: city.latitude, lng: city.longitude };
      }
    }
    for (const [name, coord] of Object.entries(FALLBACK_CITY_COORDS)) {
      if (!map[name]) map[name] = coord;
    }
    return map;
  }, [cities]);

  const cityNames = useMemo(() => cities.map((c) => c.name), [cities]);

  return { cities, cityNames, coordsMap, isLoading: query.isLoading };
}