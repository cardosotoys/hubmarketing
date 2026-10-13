import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import FinalBoard from './social-plan/FinalBoard';
import { useFinalData } from './social-plan/useFinalData';
import { todayISO, ymOf } from './social-plan/shared';

/* Visão final — pública (sem login), aberta por link com token, como o Campo do Trade.
 * Mostra só o que está pronto: redes, calendário e área comercial. */
export default function VisaoFinal() {
  const [params] = useSearchParams();
  const token = params.get('t') ?? '';
  const [month, setMonth] = useState(() => ymOf(todayISO()));
  const { data, state } = useFinalData(token, month);
  return (
    <div className="sp sp-public">
      <header className="sp-pub-head">
        <div className="sp-pub-logo">C</div>
        <div><small>Cardoso · Centro de Operações de Conteúdo</small><b>Visão final{data?.label ? ` · ${data.label}` : ''}</b></div>
      </header>
      <main className="sp-main">
        {state === 'loading' && <p className="sp-calhint">Carregando…</p>}
        {state === 'invalid' && (
          <div className="sp-empty"><b>Este link não abre</b>Ele pode ter sido desativado. Peça um link novo para quem te enviou.</div>
        )}
        {state === 'ok' && data && <FinalBoard data={data} month={month} onMonth={setMonth} />}
        <p className="sp-calhint" style={{ marginTop: 18 }}>Aqui aparece só o que já foi aprovado. Os criativos abrem no Google Drive.</p>
      </main>
    </div>
  );
}
