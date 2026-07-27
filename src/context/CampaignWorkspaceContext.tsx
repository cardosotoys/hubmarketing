import { createContext, useContext } from 'react';
import type { Brand, Campaign } from '../types/database';

export interface CampaignTaskStats {
  total: number;
  done: number;
}

export interface CampaignWorkspaceValue {
  campaign: Campaign;
  brand: Brand | null;
  ownerName: string | null;
  taskStats: CampaignTaskStats;
  reload: () => void;
}

export const CampaignWorkspaceContext = createContext<CampaignWorkspaceValue | null>(null);

export function useCampaignWorkspace() {
  const ctx = useContext(CampaignWorkspaceContext);
  if (!ctx) {
    throw new Error('useCampaignWorkspace precisa ser usado dentro de uma rota /campanhas/:id/*');
  }
  return ctx;
}
