import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { ModuleKey } from '../types/database';
import { isModuleOptInLocked } from '../lib/navVisibility';

export default function ModuleGate({ moduleKey, children }: { moduleKey: ModuleKey; children: ReactNode }) {
  const { profile } = useAuth();
  if (!profile) return null;
  if (profile.hidden_modules.includes(moduleKey)) return <Navigate to="/" replace />;
  const ctx = {
    role: profile.role,
    department: profile.department,
    hiddenModules: profile.hidden_modules,
    extraModules: profile.extra_modules,
  };
  if (isModuleOptInLocked(moduleKey, ctx)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
