import type { SocialChannel, SocialPlanItem } from '../../types/database';

/* Utilidades do Centro de Operações de Conteúdo. Datas são sempre YYYY-MM-DD locais
 * (nunca toISOString para date-only: o fuso empurra o dia). */

export const DOW = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
export const MES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const MES_NOME = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export type Kind = SocialPlanItem['link_kind'];
export const KIND_LABEL: Record<Kind, string> = { matriz: 'Matriz', reaproveita: 'Reaproveita', adapta: 'Adapta' };

const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = (iso: string) => { const [Y, M, D] = iso.split('-').map(Number); return new Date(Y, M - 1, D); };
export const todayISO = () => ymd(new Date());
export function addDays(iso: string, n: number) { const d = parseYmd(iso); d.setDate(d.getDate() + n); return ymd(d); }
export const dowIndex = (iso: string) => (parseYmd(iso).getDay() + 6) % 7; // 0 = segunda
export const mondayOf = (iso: string) => addDays(iso, -dowIndex(iso));
export const brShort = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
export const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '');
export const ymOf = (iso: string) => iso.slice(0, 7);
export function addMonths(ym: string, n: number) {
  const [Y, M] = ym.split('-').map(Number);
  const d = new Date(Y, M - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export const monthName = (ym: string) => { const [Y, M] = ym.split('-').map(Number); return `${MES_NOME[M - 1]} ${Y}`; };

export function derive(iso: string) {
  const [Y, M] = iso.split('-').map(Number);
  return { weekday: DOW[dowIndex(iso)], month_label: `${MES_ABREV[M - 1]}/${String(Y).slice(2)}` };
}

export const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export type ChannelMap = Map<string, SocialChannel>;

/** "Playmi · Instagram Reels + Facebook" */
export function destLabel(item: Pick<SocialPlanItem, 'channel_id' | 'piece_type' | 'mirror_facebook' | 'channel'>, chans: ChannelMap) {
  const ch = item.channel_id ? chans.get(item.channel_id) : undefined;
  if (!ch) return item.channel || '—';
  const fmt = ch.formats.length && item.piece_type ? ` ${item.piece_type}` : '';
  return `${ch.account} · ${ch.name}${fmt}${item.mirror_facebook ? ' + Facebook' : ''}`;
}

/** Tipo de peça legado (filtros/feed) para canais sem formato escolhível. */
export function defaultPieceType(ch: SocialChannel) {
  if (ch.formats.length) return ch.formats[0];
  switch (ch.network) {
    case 'LinkedIn': return 'LinkedIn';
    case 'Pinterest': return 'Pin';
    case 'TikTok': return 'Reels';
    case 'WhatsApp': return 'WhatsApp';
    case 'Google Meu Negócio': return 'Post';
    default: return 'Feed';
  }
}

/** Legenda e criativo que valem para a peça: reaproveita herda da matriz; adapta herda o criativo se não mudou. */
export function effective(item: SocialPlanItem, matriz: SocialPlanItem | undefined) {
  if (item.link_kind === 'reaproveita') return { caption: matriz?.caption ?? null, creative: matriz?.creative_url ?? null };
  if (item.link_kind === 'adapta' && !item.creative_changed) return { caption: item.caption, creative: matriz?.creative_url ?? null };
  return { caption: item.caption, creative: item.creative_url };
}

/* ---------- Fase 2: duas etapas de aprovação ----------
 * Etapa 1 (pauta e legenda) = status. Etapa 2 (criativo final) = creative_status.
 * Quem herda da matriz é resolvido no banco (0110); aqui só se decide quem tem botão. */
export const ownGate1 = (x: SocialPlanItem) => x.link_kind !== 'reaproveita';
export const ownGate2 = (x: SocialPlanItem) => x.link_kind === 'matriz' || (x.link_kind === 'adapta' && x.creative_changed);
export const licBlocked = (t: { licensed: boolean; licensor_ok: boolean } | null | undefined) => !!t?.licensed && !t.licensor_ok;

export type Tone = 'ok' | 'sky' | 'warn' | 'red' | '';
export type PieceState = { label: string; tone: Tone; ready: boolean; done: boolean };

export function pieceState(
  x: SocialPlanItem, matriz: SocialPlanItem | undefined,
  topic: { licensed: boolean; licensor_ok: boolean } | null | undefined, future: boolean,
): PieceState {
  const eff = effective(x, matriz);
  const st = (label: string, tone: Tone, ready = false, done = false) => ({ label, tone, ready, done });
  if (future) return st('Guardada · canal futuro', '');
  if (x.stage === 'publicado') return st('Publicada', 'ok', true, true);
  if (x.stage === 'agendado') return st('Agendada', 'sky', true, true);
  if (x.status === 'ajuste') return st('Ajuste na legenda', 'red');
  if (x.creative_status === 'ajuste') return st('Ajuste no criativo', 'red');
  if (x.status === 'aprovada' && x.creative_status === 'aprovada')
    return licBlocked(topic) ? st('Aguardando licenciador', 'warn') : st('Pronta para agendar', 'ok', true);
  if (x.status === 'aprovada' && eff.creative) return st('Aguardando etapa 2', 'warn');
  if (x.status === 'aprovada') return st('Em produção', '');
  if (eff.caption) return st('Aguardando etapa 1', 'warn');
  return st('Rascunho', '');
}

/** Filas de aprovação: só quem tem decisão própria naquela etapa. */
export const inQueue1 = (x: SocialPlanItem) =>
  ownGate1(x) && x.status === 'pendente' && !!x.caption?.trim() && x.stage !== 'agendado' && x.stage !== 'publicado';
export const inQueue2 = (x: SocialPlanItem) =>
  ownGate2(x) && x.status === 'aprovada' && !!x.creative_url && x.creative_status === 'pendente' && x.stage !== 'agendado' && x.stage !== 'publicado';

/** Prévia de arquivo do Drive (não passa pelo Storage do Supabase). */
export function driveThumb(url: string | null | undefined) {
  if (!url) return null;
  const m = url.match(/\/d\/([\w-]{10,})/) ?? url.match(/[?&]id=([\w-]{10,})/);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1000` : null;
}
