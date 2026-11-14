import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { UserRole } from '../types/database';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

interface RoleCheckState {
  checking: boolean;
  authorized: boolean;
  reason: string | null;
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, loading, isConfigured } = useAuth();
  const location = useLocation();
  const allowedRolesKey = allowedRoles ? allowedRoles.join(',') : '';

  const userId = user?.id ?? null;
  const verificationKey = `${userId || ''}|${allowedRolesKey}|${profile?.role || ''}|${String(profile?.is_active)}`;
  const verifiedKeyRef = React.useRef<string | null>(null);

  const [dbAuth, setDbAuth] = useState<RoleCheckState>({
    checking: Boolean(allowedRoles?.length),
    authorized: false,
    reason: null,
  });

  useEffect(() => {
    let active = true;

    async function verifyWithDatabase() {
      if (!allowedRoles || allowedRoles.length === 0) {
        if (active) {
          setDbAuth({ checking: false, authorized: true, reason: null });
        }
        return;
      }

      if (!isConfigured || !supabase || !userId) {
        verifiedKeyRef.current = null;
        if (active) {
          setDbAuth({ checking: false, authorized: false, reason: null });
        }
        return;
      }

      const alreadyVerifiedForUser =
        verifiedKeyRef.current === `${userId}|${allowedRolesKey}`;

      if (active && !alreadyVerifiedForUser) {
        setDbAuth({ checking: true, authorized: false, reason: null });
      }

      try {
        // Server/database-backed authorization check via SECURITY DEFINER RPC
        const { data, error } = await supabase.rpc('verify_user_role', {
          p_allowed_roles: allowedRoles,
        });

        if (!active) return;

        if (!error && Array.isArray(data) && data.length > 0) {
          const row = data[0] as { authorized: boolean; role: string | null; is_active: boolean };
          if (!row.is_active && row.role) {
            verifiedKeyRef.current = null;
            setDbAuth({
              checking: false,
              authorized: false,
              reason: 'Your account is currently suspended. Contact a Super Administrator.',
            });
            return;
          }
          if (row.authorized) {
            verifiedKeyRef.current = `${userId}|${allowedRolesKey}`;
          } else {
            verifiedKeyRef.current = null;
          }
          setDbAuth({
            checking: false,
            authorized: Boolean(row.authorized),
            reason: row.authorized
              ? null
              : 'Your account does not have permission to view this dashboard. Role elevation is strictly controlled by Super Administrators in Supabase.',
          });
          return;
        }

        // If RPC is not yet deployed (PGRST202), verify directly against the database profiles table (fail closed)
        if (error && (error.code === 'PGRST202' || error.message?.includes('verify_user_role'))) {
          const { data: freshProfile, error: profileErr } = await supabase
            .from('profiles')
            .select('role, is_active')
            .eq('id', userId)
            .maybeSingle();

          if (!active) return;

          if (profileErr || !freshProfile) {
            verifiedKeyRef.current = null;
            setDbAuth({
              checking: false,
              authorized: false,
              reason: 'Unable to verify your profile permissions from the database.',
            });
            return;
          }

          const isAllowed =
            Boolean(freshProfile.is_active) &&
            allowedRoles.includes(freshProfile.role as UserRole);

          if (isAllowed) {
            verifiedKeyRef.current = `${userId}|${allowedRolesKey}`;
          } else {
            verifiedKeyRef.current = null;
          }

          setDbAuth({
            checking: false,
            authorized: isAllowed,
            reason: isAllowed
              ? null
              : !freshProfile.is_active
                ? 'Your account is currently suspended. Contact a Super Administrator.'
                : 'Your account does not have permission to view this dashboard. Role elevation is strictly controlled by Super Administrators in Supabase.',
          });
          return;
        }

        // Fail closed on any unexpected database authorization error
        verifiedKeyRef.current = null;
        setDbAuth({
          checking: false,
          authorized: false,
          reason: 'Database role authorization check failed. Access denied.',
        });
      } catch {
        if (!active) return;
        if (!alreadyVerifiedForUser) {
          setDbAuth({
            checking: false,
            authorized: false,
            reason: 'Database role authorization check failed. Access denied.',
          });
        }
      }
    }

    if (!loading) {
      verifyWithDatabase();
    }

    return () => {
      active = false;
    };
  }, [loading, isConfigured, userId, verificationKey, allowedRolesKey]);

  if (loading || (Boolean(user) && Boolean(allowedRoles?.length) && dbAuth.checking)) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="animate-pulse space-y-4 rounded-xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="h-6 w-48 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-4 w-72 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-32 w-full rounded bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
    );
  }

  if (!isConfigured || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  const clientRoleAllowed =
    !allowedRoles ||
    (Boolean(profile) && Boolean(profile?.is_active) && allowedRoles.includes(profile!.role));

  if (allowedRoles && (!dbAuth.authorized || !clientRoleAllowed)) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="rounded-xl border border-red-200 bg-white p-8 text-center dark:border-red-900/60 dark:bg-slate-900">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-[#C62828] dark:bg-red-950/60 dark:text-red-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
            Restricted Access
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {dbAuth.reason ||
              'Your account does not have permission to view this dashboard. Role elevation is strictly controlled by Super Administrators in Supabase.'}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
