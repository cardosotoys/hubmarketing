import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';

export default function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  // wide = modal mais largo/retangular no desktop (ex.: edição de demanda), em vez do estreito padrão
  wide?: boolean;
}) {
  // Fechar no Esc — mantém o onClose atual num ref pra não re-registrar o listener a cada render
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function stop(e: MouseEvent) {
    e.stopPropagation();
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal${wide ? ' wide' : ''}`} onClick={stop}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <h3 style={{ flex: 1 }}>{title}</h3>
          <button
            type="button"
            className="btn ghost sm"
            onClick={onClose}
            aria-label="Fechar"
            title="Fechar"
            style={{ marginTop: -2, fontSize: 16, lineHeight: 1, padding: '2px 8px' }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
