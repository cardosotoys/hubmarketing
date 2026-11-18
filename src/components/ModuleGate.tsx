import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { ModuleKey } from '../types/database';
import { getVisibleNavItems, isModuleOptInLocked } from '../lib/navVisibility';

export default function ModuleGate({ moduleKey, children }: { moduleKey: ModuleKey; children: ReactNode }) {
  const { profile } = useAuth();
  if (!profile) return null;
  const ctx = {
    role: profile.role,
    department: profile.department,
    hiddenModules: profile.hidden_modules,
    extraModules: profile.extra_modules,
  };
  if (profile.hidden_modules.includes(moduleKey) || isModuleOptInLocked(moduleKey, ctx)) {
    // o Dashboard é a página inicial: quem não tem acesso a ele vai para o primeiro módulo liberado
    // (ex.: acesso só à Cardoso Black). Sem isso, a página inicial redirecionaria para ela mesma.
    if (moduleKey === 'dashboard') {
      const destino = getVisibleNavItems(ctx).find((i) => i.to !== '/')?.to;
      return destino ? <Navigate to={destino} replace /> : null;
    }
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
