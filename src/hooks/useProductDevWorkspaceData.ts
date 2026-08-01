import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Brand, Product, ProductDevGate, ProductDevItem } from '../types/database';

export function useProductDevWorkspaceData(itemId: string | undefined) {
  const [item, setItem] = useState<ProductDevItem | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [gates, setGates] = useState<ProductDevGate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!itemId) return;
    setLoading(true);
    setError(null);
    const [itemRes, gatesRes] = await Promise.all([
      supabase
        .from('product_dev_items')
        .select('*, brand:brands(*), product:products(*), owner:profiles!product_dev_items_owner_id_fkey(name)')
        .eq('id', itemId)
        .single(),
      supabase.from('product_dev_gates').select('*').eq('item_id', itemId).order('phase'),
    ]);
    if (itemRes.error) {
      setError(itemRes.error.message);
      setLoading(false);
      return;
    }
    const row = itemRes.data as ProductDevItem & {
      brand: Brand | null;
      product: Product | null;
      owner: { name: string } | null;
    };
    setItem(row);
    setBrand(row.brand ?? null);
    setProduct(row.product ?? null);
    setOwnerName(row.owner?.name ?? null);
    setGates((gatesRes.data as ProductDevGate[]) ?? []);
    setLoading(false);
  }, [itemId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { item, brand, product, ownerName, gates, loading, error, reload };
}
