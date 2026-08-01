import type { MouseEvent, ReactNode } from 'react';

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
  function stop(e: MouseEvent) {
    e.stopPropagation();
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal${wide ? ' wide' : ''}`} onClick={stop}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}
