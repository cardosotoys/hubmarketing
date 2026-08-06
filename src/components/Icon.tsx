import { createElement } from 'react';
import { ICON_NODES } from './iconNodes';

// Ícones no traço do Lucide, renderizados inline (SVG) a partir dos nós já embutidos —
// sem dependência em runtime, build leve.
export default function Icon({ name, size = 18, strokeWidth = 1.9 }: { name: string; size?: number; strokeWidth?: number }) {
  const nodes = ICON_NODES[name];
  if (!nodes) {
    return <span style={{ display: 'inline-flex', width: size, justifyContent: 'center' }}>•</span>;
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0 }}
      aria-hidden
    >
      {nodes.map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}
