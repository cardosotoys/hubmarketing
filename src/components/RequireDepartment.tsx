import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Department } from '../types/database';

const FULL_ACCESS: Department[] = ['diretoria', 'growth', 'coordenacao'];

export default function RequireDepartment({
  extraFor = [],
  redirectTo = '/',
  children,
}: {
  extraFor?: Department[];
  redirectTo?: string;
  children: ReactNode;
}) {
  const { profile } = useAuth();
  if (!profile) return null;
  if (!FULL_ACCESS.includes(profile.department) && !extraFor.includes(profile.department)) {
    return <Navigate to={redirectTo} replace />;
  }
  return <>{children}</>;
}
