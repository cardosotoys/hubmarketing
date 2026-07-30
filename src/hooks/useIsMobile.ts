import { useEffect, useState } from 'react';

// Mesmo breakpoint usado em todo o CSS responsivo (src/styles/global.css) — o que é "mobile"
// em JS precisa ser exatamente o que é "mobile" em CSS, senão a casca (JS) e o conteúdo (CSS)
// trocam de layout em pontos diferentes da tela.
const MOBILE_QUERY = '(max-width: 880px)';

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
