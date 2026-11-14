import React, { useState } from 'react';
import { HeartHandshake, ShieldCheck, X } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { expressInterestInRequest } from '../../services/requestService';
import type { BloodGroup } from '../../types/database';

interface ExpressInterestModalProps {
  open: boolean;
  request: {
    id: string;
    patient_name: string;
    required_blood_group: BloodGroup;
    hospital_name: string;
    hospital_location: string;
    required_date: string;
  } | null;
  onClose: () => void;
  onSubmitted: (result: { interested_count: number }) => void;
}

export function ExpressInterestModal({
  open,
  request,
  onClose,
  onSubmitted,
}: ExpressInterestModalProps) {
  const { showToast } = useToast();
  const [message, setMessage] = useState('');
  const [shareContact, setShareContact] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!open || !request) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    try {
      const res = await expressInterestInRequest({
        requestId: request.id,
        message,
        shareContact,
      });
      setMessage('');
      setShareContact(false);
      showToast(
        'Interest Submitted',
        'success',
        'The request owner has been notified and can review your donor profile.'
      );
      onSubmitted({ interested_count: res.interested_count });
      onClose();
    } catch (err) {
      showToast(
        'Could Not Submit Interest',
        'error',
        err instanceof Error ? err.message : 'Unable to register your interest.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="express-interest-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-[#C62828] dark:bg-red-950/50 dark:text-red-400">
              <HeartHandshake className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="express-interest-title"
                className="font-display text-base font-bold text-slate-900 dark:text-white"
              >
                Offer to Donate Blood
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {request.patient_name} · {request.required_blood_group}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label="Close express interest modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
          <p className="font-semibold text-slate-900 dark:text-white">{request.hospital_name}</p>
          <p className="mt-0.5">
            {request.hospital_location} · Needed {request.required_date}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="interest-message"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Availability Note (Optional)
            </label>
            <textarea
              id="interest-message"
              rows={3}
              maxLength={400}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Share when you can reach the hospital or any helpful note..."
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            <input
              type="checkbox"
              checked={shareContact}
              onChange={(e) => setShareContact(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded accent-[#C62828]"
            />
            <span>
              Share my phone number directly with the request owner so they can coordinate faster.
              <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
                If unchecked, your phone stays private until you approve an in-app contact request
                or are selected as donor.
              </span>
            </span>
          </label>

          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>The request owner receives an immediate in-app notification.</span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#C62828] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B71C1C] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Submitting...' : 'Confirm Interest'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
