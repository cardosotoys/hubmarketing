import type { MouseEvent, ReactNode } from 'react';

export default function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  function stop(e: MouseEvent) {
    e.stopPropagation();
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={stop}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}
