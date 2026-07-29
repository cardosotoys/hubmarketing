import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Department, ModuleKey } from '../types/database';

const FULL_ACCESS: Department[] = ['diretoria', 'growth', 'coordenacao'];

export default function RequireDepartment({
  extraFor = [],
  redirectTo = '/',
  moduleKey,
  children,
}: {
  extraFor?: Department[];
  redirectTo?: string;
  moduleKey?: ModuleKey;
  children: ReactNode;
}) {
  const { profile } = useAuth();
  if (!profile) return null;
  if (moduleKey && profile.hidden_modules.includes(moduleKey)) return <Navigate to={redirectTo} replace />;
  if (moduleKey && profile.extra_modules.includes(moduleKey)) return <>{children}</>;
  if (!FULL_ACCESS.includes(profile.department) && !extraFor.includes(profile.department)) {
    return <Navigate to={redirectTo} replace />;
  }
  return <>{children}</>;
}
