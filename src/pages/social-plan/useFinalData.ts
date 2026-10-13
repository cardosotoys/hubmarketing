import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { addMonths } from './shared';
import type { FinalData } from './FinalBoard';

/* Lê o cenário final de um mês pela função final_view (token do link). */
export function useFinalData(token: string, month: string) {
  const [data, setData] = useState<FinalData | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'invalid'>('loading');
  useEffect(() => {
    if (!token) { setState('invalid'); return; }
    let alive = true;
    const from = `${month}-01`;
    const to = `${addMonths(month, 1)}-01`;
    supabase.rpc('final_view', { p_token: token, p_from: from, p_to: to }).then(({ data: d, error }) => {
      if (!alive) return;
      const fd = d as FinalData | null;
      if (error || !fd?.ok) { setState('invalid'); return; }
      // o "to" da função é inclusivo: corta o primeiro dia do mês seguinte
      setData({ ...fd, pieces: fd.pieces.filter((p) => p.date < to) });
      setState('ok');
    });
    return () => { alive = false; };
  }, [token, month]);
  return { data, state };
}
