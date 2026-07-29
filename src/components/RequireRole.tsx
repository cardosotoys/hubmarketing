import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { ModuleKey, Role } from '../types/database';

export default function RequireRole({
  roles,
  moduleKey,
  children,
}: {
  roles: Role[];
  moduleKey?: ModuleKey;
  children: ReactNode;
}) {
  const { profile } = useAuth();
  if (!profile) return null;
  if (moduleKey && profile.hidden_modules.includes(moduleKey)) return <Navigate to="/" replace />;
  if (moduleKey && profile.extra_modules.includes(moduleKey)) return <>{children}</>;
  if (!roles.includes(profile.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
