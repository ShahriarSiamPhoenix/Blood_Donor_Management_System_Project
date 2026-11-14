import { Database } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function SupabaseNoticeBanner() {
  const { isConfigured } = useAuth();
  if (isConfigured) return null;

  return (
    <div
      role="region"
      aria-label="Backend configuration status"
      className="border-b border-amber-200 bg-amber-50/90 px-4 py-2.5 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-100"
    >
      <div className="mx-auto flex max-w-7xl items-start gap-3 text-xs sm:items-center sm:text-sm">
        <Database className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300 sm:mt-0" />
        <p className="leading-snug">
          <span className="font-semibold">Supabase backend not yet connected:</span> Configure{' '}
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs dark:bg-amber-900/70">
            VITE_SUPABASE_URL
          </code>{' '}
          and{' '}
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs dark:bg-amber-900/70">
            VITE_SUPABASE_ANON_KEY
          </code>{' '}
          and run the SQL migrations in <code className="font-mono text-xs">supabase/migrations/</code> to enable live donor search, accounts, and requests.
        </p>
      </div>
    </div>
  );
}
