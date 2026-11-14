import React, { useEffect, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { searchPublicDonors } from '../../services/publicService';
import {
  fetchRequestInterests,
  ownerCompleteBloodRequest,
} from '../../services/requestService';
import type { BloodGroup, BloodRequestInterest, PublicDonor } from '../../types/database';

interface CompleteDonationModalProps {
  open: boolean;
  request: {
    id: string;
    patient_name: string;
    required_blood_group: BloodGroup;
    hospital_name: string;
    bags_needed: number;
    fulfilled_by_donor_id?: string | null;
    fulfilled_donor_name?: string | null;
  } | null;
  initialDonorId?: string | null;
  onClose: () => void;
  onCompleted: () => void;
}

export function CompleteDonationModal({
  open,
  request,
  initialDonorId,
  onClose,
  onCompleted,
}: CompleteDonationModalProps) {
  const { showToast } = useToast();
  const todayIso = new Date().toISOString().slice(0, 10);

  const [interests, setInterests] = useState<BloodRequestInterest[]>([]);
  const [directoryDonors, setDirectoryDonors] = useState<PublicDonor[]>([]);
  const [selectedDonorId, setSelectedDonorId] = useState('');
  const [donationDate, setDonationDate] = useState(todayIso);
  const [unitsDonated, setUnitsDonated] = useState(1);
  const [notes, setNotes] = useState('');
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !request) return;
    let active = true;
    setSelectedDonorId(initialDonorId || request.fulfilled_by_donor_id || '');
    setDonationDate(todayIso);
    setUnitsDonated(Math.min(4, Math.max(1, request.bags_needed || 1)));
    setNotes('');
    setLoadingCandidates(true);

    Promise.all([
      fetchRequestInterests(request.id).catch(() => [] as BloodRequestInterest[]),
      searchPublicDonors({ bloodGroup: request.required_blood_group, page: 1, pageSize: 20 }).catch(
        () => ({ donors: [] as PublicDonor[] })
      ),
    ])
      .then(([interestRows, dirRes]) => {
        if (!active) return;
        setInterests(interestRows);
        setDirectoryDonors(dirRes.donors);
        if (!initialDonorId && !request.fulfilled_by_donor_id) {
          const preselected = interestRows.find((i) => i.status === 'selected') || interestRows[0];
          if (preselected) {
            setSelectedDonorId(preselected.donor_id);
          }
        }
      })
      .finally(() => {
        if (active) setLoadingCandidates(false);
      });

    return () => {
      active = false;
    };
  }, [open, request, initialDonorId, todayIso]);

  if (!open || !request) return null;

  const interestDonorIds = new Set(interests.map((i) => i.donor_id));
  const extraDonors = directoryDonors.filter((d) => !interestDonorIds.has(d.donor_id));

  const selectedLabel =
    interests.find((i) => i.donor_id === selectedDonorId)?.full_name ||
    directoryDonors.find((d) => d.donor_id === selectedDonorId)?.display_name ||
    (selectedDonorId === request.fulfilled_by_donor_id ? request.fulfilled_donor_name : null);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!selectedDonorId) {
      showToast(
        'Donor Required',
        'error',
        'Please select the donor who completed the blood donation.'
      );
      return;
    }

    setSubmitting(true);
    try {
      await ownerCompleteBloodRequest({
        requestId: request.id,
        donorId: selectedDonorId,
        donationDate,
        unitsDonated,
        notes,
      });
      showToast(
        'Donation Completed',
        'success',
        'Donation history and donor totals have been recorded and updated across the platform.'
      );
      onCompleted();
      onClose();
    } catch (err) {
      showToast(
        'Completion Failed',
        'error',
        err instanceof Error ? err.message : 'Unable to complete blood request.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="complete-donation-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="complete-donation-title"
                className="font-display text-base font-bold text-slate-900 dark:text-white"
              >
                Confirm Donation Complete
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Patient: {request.patient_name} · {request.required_blood_group}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label="Close complete donation modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="mt-5 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            <p className="font-semibold text-slate-900 dark:text-white">{request.hospital_name}</p>
            <p className="mt-0.5">
              Completing this request creates one verified donation record and updates the
              donor&apos;s lifetime donation count.
            </p>
          </div>

          <div>
            <label
              htmlFor="complete-donor-select"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Confirm Fulfilling Donor *
            </label>
            <select
              id="complete-donor-select"
              required
              disabled={loadingCandidates || submitting}
              value={selectedDonorId}
              onChange={(e) => setSelectedDonorId(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="">
                {loadingCandidates ? 'Loading donors...' : 'Select the donor who donated'}
              </option>
              {request.fulfilled_by_donor_id &&
                !interestDonorIds.has(request.fulfilled_by_donor_id) &&
                !directoryDonors.some((d) => d.donor_id === request.fulfilled_by_donor_id) && (
                  <option value={request.fulfilled_by_donor_id}>
                    {request.fulfilled_donor_name || 'Previously Selected Donor'} (Assigned)
                  </option>
                )}
              {interests.length > 0 && (
                <optgroup label="Interested Members">
                  {interests.map((item) => (
                    <option key={item.donor_id} value={item.donor_id}>
                      {item.full_name} ({item.blood_group}) — {item.total_donations}{' '}
                      {item.total_donations === 1 ? 'donation' : 'donations'}
                      {item.status === 'selected' ? ' · Selected' : ''}
                    </option>
                  ))}
                </optgroup>
              )}
              {extraDonors.length > 0 && (
                <optgroup label={`Verified ${request.required_blood_group} Donors`}>
                  {extraDonors.map((d) => (
                    <option key={d.donor_id} value={d.donor_id}>
                      {d.display_name} ({d.blood_group}) — {d.total_donations}{' '}
                      {d.total_donations === 1 ? 'donation' : 'donations'}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {selectedLabel && (
              <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Confirmed donor: {selectedLabel}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="complete-donation-date"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Donation Date *
              </label>
              <input
                id="complete-donation-date"
                type="date"
                required
                max={todayIso}
                disabled={submitting}
                value={donationDate}
                onChange={(e) => setDonationDate(e.target.value)}
                className="font-mono-tabular mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <div>
              <label
                htmlFor="complete-units-donated"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Units / Bags Donated *
              </label>
              <input
                id="complete-units-donated"
                type="number"
                min={1}
                max={4}
                required
                disabled={submitting}
                value={unitsDonated}
                onChange={(e) => setUnitsDonated(Number(e.target.value))}
                className="font-mono-tabular mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="complete-donation-notes"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Confirmation Notes (Optional)
            </label>
            <textarea
              id="complete-donation-notes"
              rows={2}
              maxLength={400}
              disabled={submitting}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional note confirming hospital collection or crossmatch..."
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
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
              disabled={submitting || !selectedDonorId}
              className="rounded-lg bg-[#C62828] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B71C1C] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Completing...' : 'Confirm Donation Complete'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
