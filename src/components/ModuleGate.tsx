import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { ModuleKey } from '../types/database';

export default function ModuleGate({ moduleKey, children }: { moduleKey: ModuleKey; children: ReactNode }) {
  const { profile } = useAuth();
  if (!profile) return null;
  if (profile.hidden_modules.includes(moduleKey)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
