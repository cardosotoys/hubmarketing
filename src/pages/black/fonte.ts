import { useEffect } from 'react';

/* Redonda (títulos da Cardoso Black) pelo projeto web da Cardoso no Adobe Fonts.
 * Carregada só nas telas da Black, para não pesar o resto do Hub. */
const KIT = 'https://use.typekit.net/jvg1wdj.css';

export function useRedonda() {
  useEffect(() => {
    if (document.querySelector(`link[href="${KIT}"]`)) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = KIT;
    document.head.appendChild(l);
  }, []);
}
