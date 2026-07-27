import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Brand, Campaign } from '../types/database';
import type { CampaignTaskStats } from '../context/CampaignWorkspaceContext';

export function useCampaignWorkspaceData(campaignId: string | undefined) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [taskStats, setTaskStats] = useState<CampaignTaskStats>({ total: 0, done: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    setError(null);
    const [campaignRes, tasksRes] = await Promise.all([
      supabase
        .from('campaigns')
        .select('*, brand:brands(*), owner:profiles!campaigns_owner_id_fkey(name)')
        .eq('id', campaignId)
        .single(),
      supabase.from('campaign_tasks').select('id, stage').eq('campaign_id', campaignId),
    ]);
    if (campaignRes.error) {
      setError(campaignRes.error.message);
      setLoading(false);
      return;
    }
    const row = campaignRes.data as Campaign & { brand: Brand | null; owner: { name: string } | null };
    setCampaign(row);
    setBrand(row.brand ?? null);
    setOwnerName(row.owner?.name ?? null);
    const tasks = (tasksRes.data as { id: string; stage: string }[]) ?? [];
    setTaskStats({ total: tasks.length, done: tasks.filter((t) => t.stage === 'concluida').length });
    setLoading(false);
  }, [campaignId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { campaign, brand, ownerName, taskStats, loading, error, reload };
}
