import { Outlet } from 'react-router-dom';
import MobileTopBar from './MobileTopBar';
import MobileTabBar from './MobileTabBar';

// Casca de navegação específica pro celular — barra superior + conteúdo + barra inferior fixa,
// em vez do menu lateral + topbar do desktop. Mesmas rotas/dados de sempre: só a moldura muda.
export default function MobileLayout() {
  return (
    <div className="mobile-app">
      <MobileTopBar />
      <div className="mobile-content">
        <Outlet />
      </div>
      <MobileTabBar />
    </div>
  );
}
