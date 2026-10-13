import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { CommercialBanner, ContentMaterial, ContentTaskBoardRow } from '../../types/database';

export type ProductLite = { id: string; code: string; name: string; brand: string; image_url: string };

/* Dados do banco de materiais e da área comercial. Só carrega quando uma das duas abas abre. */
export function useCommercial(enabled: boolean) {
  const [loaded, setLoaded] = useState(false);
  const [materials, setMaterials] = useState<ContentMaterial[]>([]);
  const [banners, setBanners] = useState<CommercialBanner[]>([]);
  const [board, setBoard] = useState<Map<string, ContentTaskBoardRow>>(new Map());
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [m, b, t, p] = await Promise.all([
      supabase.from('content_materials').select('*').order('created_at', { ascending: false }),
      supabase.from('commercial_banners').select('*').order('starts_on'),
      supabase.rpc('content_task_board'),
      supabase.from('products').select('id, code, name, image_url, brand:brands(label)').order('code'),
    ]);
    if (m.error) setError('O banco de materiais ainda não existe: rode a migration 0111 no Supabase.');
    else setError('');
    setMaterials((m.data as ContentMaterial[]) ?? []);
    setBanners((b.data as CommercialBanner[]) ?? []);
    setBoard(new Map(((t.data as ContentTaskBoardRow[]) ?? []).map((r) => [r.task_id, r])));
    type Row = { id: string; code: string; name: string; image_url: string | null; brand: { label: string } | { label: string }[] | null };
    setProducts(((p.data as Row[]) ?? []).map((r) => ({
      id: r.id, code: r.code, name: r.name, image_url: r.image_url ?? '',
      brand: (Array.isArray(r.brand) ? r.brand[0]?.label : r.brand?.label) ?? 'Cardoso',
    })));
    setLoaded(true);
  }, []);

  useEffect(() => { if (enabled && !loaded) load(); }, [enabled, loaded, load]);
  useEffect(() => {
    if (!loaded) return;
    const ch = supabase.channel('content-commercial')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_materials' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commercial_banners' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loaded, load]);

  return { loaded, error, materials, banners, board, products, reload: load };
}
