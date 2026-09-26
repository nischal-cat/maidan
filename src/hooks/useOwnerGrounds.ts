import { useQuery } from '@tanstack/react-query';
import { groundsAPI } from '../services/api';
import type { Ground } from '../types';

export function useOwnerGrounds(ownerId?: string) {
  return useQuery<Ground[]>({
    queryKey: ['owner-grounds', ownerId],
    queryFn: async () => {
      if (!ownerId) return [];
      const res = await groundsAPI.getAll({ limit: 100, ownerId });
      return res.data.grounds;
    },
    enabled: !!ownerId,
  });
}