import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export interface GlobalSearchResults {
  projects: { id: string; name: string }[];
  tasks: { id: string; title: string; project_id: string | null }[];
  products: { id: string; code: string; name: string }[];
}

const EMPTY_RESULTS: GlobalSearchResults = { projects: [], tasks: [], products: [] };

// Busca global debounced (projetos/demandas/produtos) — usada pelo Topbar (desktop) e pela busca
// em tela cheia do celular, pra não duplicar a mesma query em dois lugares.
export function useGlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<GlobalSearchResults>(EMPTY_RESULTS);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(EMPTY_RESULTS);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      const like = `%${q}%`;
      const [projectsByName, tasksByTitle, productsByName, productsByCode] = await Promise.all([
        supabase.from('projects').select('id, name').ilike('name', like).limit(5),
        supabase.from('tasks').select('id, title, project_id').ilike('title', like).limit(5),
        supabase.from('products').select('id, code, name').ilike('name', like).limit(5),
        supabase.from('products').select('id, code, name').ilike('code', like).limit(5),
      ]);
      const productMap = new Map<string, { id: string; code: string; name: string }>();
      [...(productsByName.data ?? []), ...(productsByCode.data ?? [])].forEach((p) => productMap.set(p.id, p));
      setResults({
        projects: (projectsByName.data as { id: string; name: string }[]) ?? [],
        tasks: (tasksByTitle.data as { id: string; title: string; project_id: string | null }[]) ?? [],
        products: Array.from(productMap.values()),
      });
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const hasResults = results.projects.length > 0 || results.tasks.length > 0 || results.products.length > 0;

  function goTo(path: string) {
    setQuery('');
    navigate(path);
  }

  return { query, setQuery, searching, results, hasResults, goTo };
}
