/* Ícones da Cardoso Black: os da marca (PNG em /black/icons, pintados pela cor do texto)
 * e alguns traços simples em SVG, os mesmos do onboarding aprovado. */

export type IconeMarca =
  | 'chat' | 'calendar' | 'users' | 'laptop' | 'store' | 'marketing' | 'tag' | 'check' | 'rocket'
  | 'target' | 'handshake' | 'bolt' | 'receipt' | 'flame' | 'star' | 'coins' | 'cart';

export const Ic = ({ n, className = '' }: { n: IconeMarca; className?: string }) => (
  <i className={`bi bi-${n} ${className}`} aria-hidden="true" />
);

const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

export const Sv = {
  lock: () => <svg className="sv" {...base} strokeWidth={2.4}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>,
  hg: () => <svg className="sv" {...base} strokeWidth={2.2}><path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9" /></svg>,
  mail: () => <svg className="sv" {...base} strokeWidth={2.2}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>,
  info: () => <svg className="sv" {...base} strokeWidth={2.4}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></svg>,
  search: () => <svg className="sv" {...base} strokeWidth={2.6}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>,
  up: () => <svg className="sv" {...base} strokeWidth={2.4}><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>,
  db: () => <svg className="sv" {...base} strokeWidth={2.2}><ellipse cx="12" cy="5.5" rx="8" ry="3" /><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg>,
  play: () => <svg className="sv" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>,
  wa: () => (
    <svg className="sv" {...base} strokeWidth={2.2}>
      <path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z" />
      <path d="M9 9.5c.2 2 2.5 4.3 4.5 4.6l1.3-1.2 1.7.8c-.3 1.4-1.4 2-2.6 1.8-3-.6-5.9-3.5-6.3-6.4-.1-1.2.5-2.2 1.8-2.5l.8 1.7z" fill="currentColor" stroke="none" />
    </svg>
  ),
};
