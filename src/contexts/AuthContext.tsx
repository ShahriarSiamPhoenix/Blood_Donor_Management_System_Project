import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getAuthRedirectUrl, isSupabaseConfigured, supabase } from '../lib/supabase';
import type { BloodGroup, DonorDetails, Profile } from '../types/database';
import { formatAuthErrorMessage } from '../utils/authErrors';

interface SignUpPayload {
  email: string;
  password: string;
  fullName: string;
  studentId: string;
  departmentId: string;
  batch: string;
  phone: string;
  bloodGroup: BloodGroup;
}

interface AuthContextValue {
  isConfigured: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  donorDetails: DonorDetails | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (payload: SignUpPayload) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [donorDetails, setDonorDetails] = useState<DonorDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);

  const loadUserRecords = useCallback(async (userId: string) => {
    if (!supabase) return;
    const [profileRes, donorRes] = await Promise.all([
      supabase.from('profiles').select('*, department:departments(*)').eq('id', userId).maybeSingle(),
      supabase.from('donor_details').select('*').eq('user_id', userId).maybeSingle(),
    ]);

    setProfile((profileRes.data as Profile | null) ?? null);
    setDonorDetails((donorRes.data as DonorDetails | null) ?? null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await loadUserRecords(user.id);
    }
  }, [user, loadUserRecords]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const currentSession = data.session ?? null;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        await loadUserRecords(currentSession.user.id);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        await loadUserRecords(nextSession.user.id);
      } else {
        setProfile(null);
        setDonorDetails(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadUserRecords]);

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      return { error: 'Supabase is not configured. Configure environment variables first.' };
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return { error: formatAuthErrorMessage(error) };
  };

  const signUp = async (payload: SignUpPayload) => {
    if (!supabase) {
      return {
        error: 'Supabase is not configured. Configure environment variables first.',
        needsEmailConfirmation: false,
      };
    }

    const { data, error } = await supabase.auth.signUp({
      email: payload.email.trim(),
      password: payload.password,
      options: {
        emailRedirectTo: getAuthRedirectUrl('/login'),
        data: {
          full_name: payload.fullName.trim(),
          student_id: payload.studentId.trim(),
          department_id: payload.departmentId,
          batch: payload.batch.trim(),
          phone: payload.phone.trim(),
          blood_group: payload.bloodGroup,
        },
      },
    });

    if (error) {
      return { error: formatAuthErrorMessage(error), needsEmailConfirmation: false };
    }

    return {
      error: null,
      needsEmailConfirmation: Boolean(data.user && !data.session),
    };
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setDonorDetails(null);
  };

  const requestPasswordReset = async (email: string) => {
    if (!supabase) {
      return { error: 'Supabase is not configured.' };
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: getAuthRedirectUrl('/reset-password'),
    });
    return { error: formatAuthErrorMessage(error) };
  };

  const updatePassword = async (newPassword: string) => {
    if (!supabase) {
      return { error: 'Supabase is not configured.' };
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: formatAuthErrorMessage(error) };
  };

  return (
    <AuthContext.Provider
      value={{
        isConfigured: isSupabaseConfigured,
        session,
        user,
        profile,
        donorDetails,
        loading,
        signIn,
        signUp,
        signOut,
        requestPasswordReset,
        updatePassword,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
