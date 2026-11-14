import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    if (!email.trim()) {
      setError('Please enter your registered university email.');
      return;
    }
    setLoading(true);
    const res = await requestPasswordReset(email);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSent(true);
  };

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
          Reset Password
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          Enter your email address to receive a Supabase password recovery link.
        </p>

        {sent ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
            If an account exists for <strong>{email}</strong>, a password reset link has been sent.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
                {error}
              </div>
            )}
            <div>
              <label
                htmlFor="forgot-email"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Email Address
              </label>
              <input
                id="forgot-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#C62828] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#B71C1C]"
            >
              <Mail className="h-4 w-4" />
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-slate-600 dark:text-slate-400">
          <Link to="/login" className="font-semibold text-[#C62828] hover:underline dark:text-red-400">
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
