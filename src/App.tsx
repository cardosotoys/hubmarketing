import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AppLayout from './components/AppLayout';
import RequireRole from './components/RequireRole';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Demandas from './pages/Demandas';
import RelatorioDiario from './pages/RelatorioDiario';
import Auditoria from './pages/Auditoria';
import Perfil from './pages/Perfil';
import Configuracoes from './pages/Configuracoes';
import Produtos from './pages/Produtos';
import RedesSociais from './pages/RedesSociais';
import Biblioteca from './pages/Biblioteca';
import Campaigns from './pages/Campaigns';
import Calendario from './pages/Calendario';
import Relatorios from './pages/Relatorios';
import Ia from './pages/phase2/Ia';
import Brand from './pages/phase2/Brand';
import CampaignWorkspace from './pages/campaigns/CampaignWorkspace';
import CampaignResumo from './pages/campaigns/CampaignResumo';
import CampaignPlanejamento from './pages/campaigns/CampaignPlanejamento';
import CampaignObjetivos from './pages/campaigns/CampaignObjetivos';
import CampaignKpis from './pages/campaigns/CampaignKpis';
import CampaignCronograma from './pages/campaigns/CampaignCronograma';
import CampaignDemandas from './pages/campaigns/CampaignDemandas';
import CampaignFinanceiro from './pages/campaigns/CampaignFinanceiro';
import CampaignAprovacoes from './pages/campaigns/CampaignAprovacoes';
import CampaignRiscos from './pages/campaigns/CampaignRiscos';
import CampaignDecisoes from './pages/campaigns/CampaignDecisoes';
import CampaignHistorico from './pages/campaigns/CampaignHistorico';
import CampaignProdutos from './pages/campaigns/CampaignProdutos';
import CampaignComingSoon from './pages/campaigns/CampaignComingSoon';
import CampaignRoadmap from './pages/campaigns/CampaignRoadmap';
import CampaignCriativos from './pages/campaigns/CampaignCriativos';
import CampaignConteudos from './pages/campaigns/CampaignConteudos';
import CampaignCalendarioEditorial from './pages/campaigns/CampaignCalendarioEditorial';
import CampaignSocial from './pages/campaigns/CampaignSocial';
import CampaignInfluenciadores from './pages/campaigns/CampaignInfluenciadores';
import CampaignTrade from './pages/campaigns/CampaignTrade';
import CampaignMarketplace from './pages/campaigns/CampaignMarketplace';
import CampaignCrm from './pages/campaigns/CampaignCrm';
import CampaignMidiaPaga from './pages/campaigns/CampaignMidiaPaga';
import CampaignConfiguracoes from './pages/campaigns/CampaignConfiguracoes';

const CAMPAIGN_COMING_SOON: { path: string; title: string; description: string }[] = [
  { path: 'relatorios', title: 'Relatórios', description: 'O painel de Relatórios global já cobre campanhas (incluindo verba e status) e o Resumo desta campanha já traz os números específicos dela — um relatório dedicado por campanha fica para quando fizer sentido um formato de exportação próprio.' },
  { path: 'biblioteca', title: 'Biblioteca', description: 'Pasta dedicada desta campanha dentro da Biblioteca (Drive) — depende de evoluir a integração real com o Google Drive, ainda não conectada.' },
  { path: 'auditoria', title: 'Auditoria', description: 'Hoje seria idêntica ao Histórico desta campanha (mesmo activity_log) — uma visão de auditoria privilegiada de verdade só faz sentido quando cobrir algo que o Histórico não cobre.' },
];

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="projetos" element={<Projects />} />
            <Route path="projetos/:id" element={<ProjectDetail />} />
            <Route path="demandas" element={<Demandas />} />
            <Route path="relatorio-diario" element={<RelatorioDiario />} />
            <Route
              path="auditoria"
              element={
                <RequireRole roles={['diretoria']}>
                  <Auditoria />
                </RequireRole>
              }
            />
            <Route path="perfil" element={<Perfil />} />
            <Route
              path="configuracoes"
              element={
                <RequireRole roles={['diretoria', 'administrador']}>
                  <Configuracoes />
                </RequireRole>
              }
            />
            <Route path="calendario" element={<Calendario />} />
            <Route path="redes-sociais" element={<RedesSociais />} />
            <Route path="biblioteca" element={<Biblioteca />} />
            <Route path="produtos" element={<Produtos />} />
            <Route path="campanhas" element={<Campaigns />} />
            <Route path="campanhas/:id" element={<CampaignWorkspace />}>
              <Route index element={<Navigate to="resumo" replace />} />
              <Route path="resumo" element={<CampaignResumo />} />
              <Route path="planejamento" element={<CampaignPlanejamento />} />
              <Route path="objetivos" element={<CampaignObjetivos />} />
              <Route path="produtos" element={<CampaignProdutos />} />
              <Route path="cronograma" element={<CampaignCronograma />} />
              <Route path="demandas" element={<CampaignDemandas />} />
              <Route path="financeiro" element={<CampaignFinanceiro />} />
              <Route path="kpis" element={<CampaignKpis />} />
              <Route path="aprovacoes" element={<CampaignAprovacoes />} />
              <Route path="riscos" element={<CampaignRiscos />} />
              <Route path="decisoes" element={<CampaignDecisoes />} />
              <Route path="historico" element={<CampaignHistorico />} />
              <Route path="roadmap" element={<CampaignRoadmap />} />
              <Route path="criativos" element={<CampaignCriativos />} />
              <Route path="conteudos" element={<CampaignConteudos />} />
              <Route path="calendario-editorial" element={<CampaignCalendarioEditorial />} />
              <Route path="social" element={<CampaignSocial />} />
              <Route path="influenciadores" element={<CampaignInfluenciadores />} />
              <Route path="trade" element={<CampaignTrade />} />
              <Route path="marketplace" element={<CampaignMarketplace />} />
              <Route path="crm" element={<CampaignCrm />} />
              <Route path="midia-paga" element={<CampaignMidiaPaga />} />
              <Route path="configuracoes" element={<CampaignConfiguracoes />} />
              {CAMPAIGN_COMING_SOON.map((item) => (
                <Route key={item.path} path={item.path} element={<CampaignComingSoon title={item.title} description={item.description} />} />
              ))}
            </Route>
            <Route path="ia" element={<Ia />} />
            <Route path="relatorios" element={<Relatorios />} />
            <Route path="brand" element={<Brand />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
