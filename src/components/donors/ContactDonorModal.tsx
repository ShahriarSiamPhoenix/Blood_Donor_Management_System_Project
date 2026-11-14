import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Send, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { sendContactRequestToDonor } from '../../services/donorService';
import type { PublicDonor } from '../../types/database';
import { isValidBangladeshPhone } from '../../utils/validation';

interface ContactDonorModalProps {
  donor: PublicDonor | null;
  onClose: () => void;
}

export function ContactDonorModal({ donor, onClose }: ContactDonorModalProps) {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const [message, setMessage] = useState('');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!donor) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (message.trim().length < 10) {
      setError('Please explain the hospital, patient need, and urgency (at least 10 characters).');
      return;
    }
    if (phone.trim() && !isValidBangladeshPhone(phone)) {
      setError('Please enter a valid Bangladesh contact number (e.g., 01712345678).');
      return;
    }

    setSubmitting(true);
    try {
      await sendContactRequestToDonor({
        donorId: donor.donor_id,
        message,
        requesterPhone: phone,
      });
      showToast(
        'Contact Request Sent',
        'success',
        `An in-app notification has been sent to ${donor.display_name}.`
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send contact request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-donor-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="contact-donor-title"
              className="font-display text-lg font-bold text-slate-900 dark:text-white"
            >
              Request Donor Contact
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {donor.display_name} · Blood Group {donor.blood_group} · {donor.department_code}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!user ? (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-5 text-center dark:border-slate-800 dark:bg-slate-950">
            <Lock className="mx-auto h-8 w-8 text-[#C62828] dark:text-red-400" />
            <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
              Sign In Required for Donor Privacy
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              To protect student donors from spam or unauthorized harvesting, you must sign in before
              sending an in-app contact request.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Link
                to="/login"
                className="rounded-lg bg-[#C62828] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B71C1C]"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                Register Account
              </Link>
            </div>
          </div>
        ) : user.id === donor.donor_id ? (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            This is your own donor profile. You can manage your availability from your dashboard.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="requester-phone"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Your Callback Phone Number (optional)
              </label>
              <input
                id="requester-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01712345678"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-[#C62828] focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <div>
              <label
                htmlFor="contact-message"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Hospital & Patient Context
              </label>
              <textarea
                id="contact-message"
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Mention hospital name, required date/time, and number of bags needed."
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-[#C62828] focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-[#C62828] px-4 py-2 text-sm font-semibold text-white hover:bg-[#B71C1C] disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {submitting ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
