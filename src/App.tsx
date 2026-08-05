import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AppLayout from './components/AppLayout';
import RequireRole from './components/RequireRole';
import RequireDepartment from './components/RequireDepartment';
import ModuleGate from './components/ModuleGate';
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
import MonitorPrecos from './pages/MonitorPrecos';
import RedesSociais from './pages/RedesSociais';
import Biblioteca from './pages/Biblioteca';
import Campaigns from './pages/Campaigns';
import Calendario from './pages/Calendario';
import Relatorios from './pages/Relatorios';
import Ia from './pages/Ia';
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
import DesignProduto from './pages/DesignProduto';
import Embalagens from './pages/design-produto/Embalagens';
import ProductDevWorkspace from './pages/design-produto/ProductDevWorkspace';
import ProductDevResumo from './pages/design-produto/ProductDevResumo';
import ProductDevFases from './pages/design-produto/ProductDevFases';
import ProductDevFicha from './pages/design-produto/ProductDevFicha';
import ProductDevEmbalagem from './pages/design-produto/ProductDevEmbalagem';
import ProductDevCertificacao from './pages/design-produto/ProductDevCertificacao';
import ProductDevMarketing from './pages/design-produto/ProductDevMarketing';
import ProductDevRiscos from './pages/design-produto/ProductDevRiscos';
import ProductDevDecisoes from './pages/design-produto/ProductDevDecisoes';
import ProductDevHistorico from './pages/design-produto/ProductDevHistorico';
import Monday from './pages/Monday';
import MondayBoardView from './pages/MondayBoardView';

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
            <Route index element={<ModuleGate moduleKey="dashboard"><Dashboard /></ModuleGate>} />
            <Route path="projetos" element={<ModuleGate moduleKey="projetos"><Projects /></ModuleGate>} />
            <Route path="projetos/:id" element={<ModuleGate moduleKey="projetos"><ProjectDetail /></ModuleGate>} />
            <Route path="demandas" element={<ModuleGate moduleKey="demandas"><Demandas /></ModuleGate>} />
            <Route path="relatorio-diario" element={<ModuleGate moduleKey="relatorio-diario"><RelatorioDiario /></ModuleGate>} />
            <Route path="auditoria" element={<ModuleGate moduleKey="auditoria"><Auditoria /></ModuleGate>} />
            <Route path="perfil" element={<ModuleGate moduleKey="perfil"><Perfil /></ModuleGate>} />
            <Route
              path="configuracoes"
              element={
                <RequireRole roles={['diretoria', 'administrador']} moduleKey="configuracoes">
                  <Configuracoes />
                </RequireRole>
              }
            />
            <Route path="calendario" element={<ModuleGate moduleKey="calendario"><Calendario /></ModuleGate>} />
            <Route
              path="redes-sociais"
              element={
                <RequireRole roles={['diretoria', 'administrador']} moduleKey="redes-sociais">
                  <RedesSociais />
                </RequireRole>
              }
            />
            <Route path="biblioteca" element={<ModuleGate moduleKey="biblioteca"><Biblioteca /></ModuleGate>} />
            <Route path="produtos" element={<ModuleGate moduleKey="produtos"><Produtos /></ModuleGate>} />
            <Route
              path="monitor-precos"
              element={
                <RequireDepartment moduleKey="monitor-precos">
                  <MonitorPrecos />
                </RequireDepartment>
              }
            />
            <Route path="campanhas" element={<ModuleGate moduleKey="campanhas"><Campaigns /></ModuleGate>} />
            <Route path="campanhas/:id" element={<ModuleGate moduleKey="campanhas"><CampaignWorkspace /></ModuleGate>}>
              <Route index element={<Navigate to="resumo" replace />} />
              <Route path="resumo" element={<CampaignResumo />} />
              <Route
                path="planejamento"
                element={
                  <RequireDepartment extraFor={['design']} redirectTo="../resumo">
                    <CampaignPlanejamento />
                  </RequireDepartment>
                }
              />
              <Route
                path="objetivos"
                element={
                  <RequireDepartment redirectTo="../resumo">
                    <CampaignObjetivos />
                  </RequireDepartment>
                }
              />
              <Route
                path="produtos"
                element={
                  <RequireDepartment extraFor={['design']} redirectTo="../resumo">
                    <CampaignProdutos />
                  </RequireDepartment>
                }
              />
              <Route path="cronograma" element={<CampaignCronograma />} />
              <Route
                path="demandas"
                element={
                  <RequireDepartment extraFor={['assistente']} redirectTo="../resumo">
                    <CampaignDemandas />
                  </RequireDepartment>
                }
              />
              <Route
                path="financeiro"
                element={
                  <RequireDepartment redirectTo="../resumo">
                    <CampaignFinanceiro />
                  </RequireDepartment>
                }
              />
              <Route
                path="kpis"
                element={
                  <RequireDepartment redirectTo="../resumo">
                    <CampaignKpis />
                  </RequireDepartment>
                }
              />
              <Route
                path="aprovacoes"
                element={
                  <RequireDepartment redirectTo="../resumo">
                    <CampaignAprovacoes />
                  </RequireDepartment>
                }
              />
              <Route
                path="riscos"
                element={
                  <RequireDepartment redirectTo="../resumo">
                    <CampaignRiscos />
                  </RequireDepartment>
                }
              />
              <Route
                path="decisoes"
                element={
                  <RequireDepartment redirectTo="../resumo">
                    <CampaignDecisoes />
                  </RequireDepartment>
                }
              />
              <Route path="historico" element={<CampaignHistorico />} />
              <Route
                path="roadmap"
                element={
                  <RequireDepartment redirectTo="../resumo">
                    <CampaignRoadmap />
                  </RequireDepartment>
                }
              />
              <Route
                path="criativos"
                element={
                  <RequireDepartment extraFor={['design']} redirectTo="../resumo">
                    <CampaignCriativos />
                  </RequireDepartment>
                }
              />
              <Route path="conteudos" element={<CampaignConteudos />} />
              <Route
                path="calendario-editorial"
                element={
                  <RequireDepartment extraFor={['assistente']} redirectTo="../resumo">
                    <CampaignCalendarioEditorial />
                  </RequireDepartment>
                }
              />
              <Route
                path="social"
                element={
                  <RequireDepartment redirectTo="../resumo">
                    <CampaignSocial />
                  </RequireDepartment>
                }
              />
              <Route
                path="influenciadores"
                element={
                  <RequireDepartment redirectTo="../resumo">
                    <CampaignInfluenciadores />
                  </RequireDepartment>
                }
              />
              <Route
                path="trade"
                element={
                  <RequireDepartment redirectTo="../resumo">
                    <CampaignTrade />
                  </RequireDepartment>
                }
              />
              <Route
                path="marketplace"
                element={
                  <RequireDepartment redirectTo="../resumo">
                    <CampaignMarketplace />
                  </RequireDepartment>
                }
              />
              <Route
                path="crm"
                element={
                  <RequireDepartment redirectTo="../resumo">
                    <CampaignCrm />
                  </RequireDepartment>
                }
              />
              <Route
                path="midia-paga"
                element={
                  <RequireDepartment redirectTo="../resumo">
                    <CampaignMidiaPaga />
                  </RequireDepartment>
                }
              />
              <Route
                path="configuracoes"
                element={
                  <RequireDepartment redirectTo="../resumo">
                    <CampaignConfiguracoes />
                  </RequireDepartment>
                }
              />
              {CAMPAIGN_COMING_SOON.map((item) => (
                <Route key={item.path} path={item.path} element={<CampaignComingSoon title={item.title} description={item.description} />} />
              ))}
            </Route>
            <Route path="design-produto" element={<ModuleGate moduleKey="design-produto"><DesignProduto /></ModuleGate>} />
            <Route path="design-produto/embalagens" element={<ModuleGate moduleKey="design-produto"><Embalagens /></ModuleGate>} />
            <Route path="design-produto/:id" element={<ModuleGate moduleKey="design-produto"><ProductDevWorkspace /></ModuleGate>}>
              <Route index element={<Navigate to="resumo" replace />} />
              <Route path="resumo" element={<ProductDevResumo />} />
              <Route path="fases" element={<ProductDevFases />} />
              <Route path="ficha" element={<ProductDevFicha />} />
              <Route path="embalagem" element={<ProductDevEmbalagem />} />
              <Route path="certificacao" element={<ProductDevCertificacao />} />
              <Route path="marketing" element={<ProductDevMarketing />} />
              <Route path="riscos" element={<ProductDevRiscos />} />
              <Route path="decisoes" element={<ProductDevDecisoes />} />
              <Route path="historico" element={<ProductDevHistorico />} />
            </Route>
            <Route path="ia" element={<ModuleGate moduleKey="ia"><Ia /></ModuleGate>} />
            <Route
              path="relatorios"
              element={
                <RequireDepartment moduleKey="relatorios">
                  <Relatorios />
                </RequireDepartment>
              }
            />
            <Route path="brand" element={<ModuleGate moduleKey="brand"><Brand /></ModuleGate>} />
            <Route path="monday" element={<RequireRole roles={['diretoria', 'administrador']} moduleKey="monday"><Monday /></RequireRole>} />
            <Route path="monday/:id" element={<RequireRole roles={['diretoria', 'administrador']} moduleKey="monday"><MondayBoardView /></RequireRole>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
