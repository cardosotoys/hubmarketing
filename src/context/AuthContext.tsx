import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import type { FontScale, Profile, Theme } from '../types/database';

const FONT_ZOOM: Record<FontScale, string> = { sm: '90%', md: '100%', lg: '115%', xl: '130%' };

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setTheme: (theme: Theme) => Promise<void>;
  setFontScale: (fontScale: FontScale) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error) return;
    // acesso desativado por um admin → não entra no hub
    if ((data as Profile)?.disabled) {
      setProfile(null);
      await supabase.auth.signOut();
      if (typeof window !== 'undefined') window.alert('Seu acesso ao Cardoso Hub foi desativado. Fale com a Diretoria.');
      return;
    }
    setProfile(data as Profile);
  }

  useEffect(() => {
    document.documentElement.dataset.theme = profile?.theme ?? 'light';
  }, [profile?.theme]);

  useEffect(() => {
    document.body.style.zoom = FONT_ZOOM[profile?.font_scale ?? 'md'];
  }, [profile?.font_scale]);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        loadProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function refreshProfile() {
    if (session) await loadProfile(session.user.id);
  }

  async function setTheme(theme: Theme) {
    if (!profile) return;
    setProfile({ ...profile, theme });
    await supabase.from('profiles').update({ theme }).eq('id', profile.id);
  }

  async function setFontScale(fontScale: FontScale) {
    if (!profile) return;
    setProfile({ ...profile, font_scale: fontScale });
    await supabase.from('profiles').update({ font_scale: fontScale }).eq('id', profile.id);
  }

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, signIn, signOut, refreshProfile, setTheme, setFontScale }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
