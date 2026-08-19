import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/* Aba "Campo" do Trade: mostra os links de acesso (líder + promotores) e o
 * acompanhamento da semana (plano vs. realizado + motivos de não-visita).
 * Não mexe nos indicadores/rankings existentes — é uma visão à parte. */

type Token = { token: string; kind: 'lider' | 'promotor'; promoter_id: string | null; label: string; active: boolean };
type Prom = { id: string; name: string; status: string };
type PlanRow = { promoter_id: string; weekday: number; store_id: string };
type RepRow = { promoter_id: string; report_date: string; store_id: string; status: 'foi' | 'nao_foi'; reason: string };

function mondayOf(d: Date) {
  const x = new Date(d);
  const iso = (x.getDay() + 6) % 7; // 0=segunda
  x.setDate(x.getDate() - iso);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

export default function CampoAdmin() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [proms, setProms] = useState<Prom[]>([]);
  const [storeName, setStoreName] = useState<Map<string, string>>(new Map());
  const [plan, setPlan] = useState<PlanRow[]>([]);
  const [reports, setReports] = useState<RepRow[]>([]);
  const [copied, setCopied] = useState<string>('');
  const weekStart = useMemo(() => mondayOf(new Date()), []);

  const load = useCallback(async () => {
    const [tk, pr, st, pl, rp] = await Promise.all([
      supabase.from('tm_field_tokens').select('*'),
      supabase.from('tm_promoters').select('id, name, status').eq('status', 'ativo').order('name'),
      supabase.from('tm_stores').select('id, name'),
      supabase.from('tm_field_plan').select('promoter_id, weekday, store_id').eq('week_start', weekStart),
      supabase.from('tm_field_report').select('promoter_id, report_date, store_id, status, reason').gte('report_date', weekStart),
    ]);
    setTokens((tk.data as Token[]) ?? []);
    setProms((pr.data as Prom[]) ?? []);
    setStoreName(new Map(((st.data as { id: string; name: string }[]) ?? []).map((s) => [s.id, s.name])));
    setPlan((pl.data as PlanRow[]) ?? []);
    setReports((rp.data as RepRow[]) ?? []);
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const copy = (token: string) => {
    const url = `${baseUrl}/campo?t=${token}`;
    navigator.clipboard?.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied((c) => (c === token ? '' : c)), 1800);
  };

  const lider = tokens.find((t) => t.kind === 'lider');
  const tokenOfProm = (pid: string) => tokens.find((t) => t.promoter_id === pid);

  return (
    <div className="tm-panel">
      <h3 className="tm-panel-title">Links de campo (sem login)</h3>
      <p className="tm-note">Envie o link por WhatsApp. A pessoa abre no celular, planeja a semana e dá o report diário — tudo cai aqui, sem entrar no hub.</p>

      <div className="campo-links">
        {lider && <LinkRow label="🧑‍🏫 Neylik (líder — vê todos)" url={`${baseUrl}/campo?t=${lider.token}`} onCopy={() => copy(lider.token)} copied={copied === lider.token} />}
        {proms.map((p) => {
          const t = tokenOfProm(p.id);
          return t ? <LinkRow key={p.id} label={p.name} url={`${baseUrl}/campo?t=${t.token}`} onCopy={() => copy(t.token)} copied={copied === t.token} /> : null;
        })}
      </div>

      <h3 className="tm-panel-title" style={{ marginTop: 22 }}>Esta semana ({weekStart.split('-').reverse().join('/')})</h3>
      <table className="tm-tbl">
        <thead><tr><th>Promotor</th><th>Planejadas</th><th>Foi</th><th>Não foi</th><th>Sem report</th></tr></thead>
        <tbody>
          {proms.map((p) => {
            const planned = plan.filter((x) => x.promoter_id === p.id);
            const reps = reports.filter((x) => x.promoter_id === p.id);
            const foi = reps.filter((x) => x.status === 'foi').length;
            const nao = reps.filter((x) => x.status === 'nao_foi').length;
            const semReport = Math.max(0, planned.length - reps.length);
            return (
              <tr key={p.id}>
                <td><b>{p.name}</b></td>
                <td>{planned.length}</td>
                <td style={{ color: 'var(--tm-good, #16a34a)', fontWeight: 700 }}>{foi}</td>
                <td style={{ color: 'var(--tm-bad, #dc2626)', fontWeight: 700 }}>{nao}</td>
                <td>{semReport}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {reports.some((r) => r.status === 'nao_foi') && (
        <>
          <h3 className="tm-panel-title" style={{ marginTop: 22 }}>Não-visitas da semana (motivos)</h3>
          <table className="tm-tbl">
            <thead><tr><th>Data</th><th>Promotor</th><th>Loja</th><th>Motivo</th></tr></thead>
            <tbody>
              {reports.filter((r) => r.status === 'nao_foi').sort((a, b) => b.report_date.localeCompare(a.report_date)).map((r, i) => (
                <tr key={i}>
                  <td>{r.report_date.split('-').reverse().join('/')}</td>
                  <td>{proms.find((p) => p.id === r.promoter_id)?.name ?? '—'}</td>
                  <td>{storeName.get(r.store_id) ?? '—'}</td>
                  <td>{r.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function LinkRow({ label, url, onCopy, copied }: { label: string; url: string; onCopy: () => void; copied: boolean }) {
  return (
    <div className="campo-linkrow">
      <div className="campo-linkinfo">
        <b>{label}</b>
        <span>{url}</span>
      </div>
      <button className="tm-btn" onClick={onCopy}>{copied ? 'Copiado ✓' : 'Copiar link'}</button>
    </div>
  );
}
