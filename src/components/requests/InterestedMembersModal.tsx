import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Droplets,
  Lock,
  MapPin,
  Phone,
  Search,
  Send,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { sendContactRequestToDonor } from '../../services/donorService';
import { searchPublicDonors } from '../../services/publicService';
import {
  fetchRequestInterests,
  ownerSelectDonorForRequest,
} from '../../services/requestService';
import type { BloodGroup, BloodRequestInterest, PublicDonor, RequestStatus } from '../../types/database';
import { isActiveRequestStatus } from '../../utils/requestStatus';

interface InterestedMembersModalProps {
  open: boolean;
  request: {
    id: string;
    patient_name: string;
    required_blood_group: BloodGroup;
    hospital_name: string;
    status: RequestStatus;
    fulfilled_by_donor_id?: string | null;
  } | null;
  canManage: boolean;
  onClose: () => void;
  onDonorSelected: (donorId: string, donorName: string) => void;
  onProceedToComplete?: (donorId?: string | null) => void;
}

export function InterestedMembersModal({
  open,
  request,
  canManage,
  onClose,
  onDonorSelected,
  onProceedToComplete,
}: InterestedMembersModalProps) {
  const { showToast } = useToast();
  const [interests, setInterests] = useState<BloodRequestInterest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectingDonorId, setSelectingDonorId] = useState<string | null>(null);
  const [contactingDonorId, setContactingDonorId] = useState<string | null>(null);

  const [showVerifiedDirectory, setShowVerifiedDirectory] = useState(false);
  const [verifiedDonors, setVerifiedDonors] = useState<PublicDonor[]>([]);
  const [loadingDirectory, setLoadingDirectory] = useState(false);

  const loadInterests = useCallback(async () => {
    if (!open || !request) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchRequestInterests(request.id);
      setInterests(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load interested members.');
    } finally {
      setLoading(false);
    }
  }, [open, request]);

  useEffect(() => {
    loadInterests();
  }, [loadInterests]);

  useEffect(() => {
    if (!open || !showVerifiedDirectory || !request) return;
    let active = true;
    setLoadingDirectory(true);
    searchPublicDonors({
      bloodGroup: request.required_blood_group,
      page: 1,
      pageSize: 12,
    })
      .then((res) => {
        if (active) setVerifiedDonors(res.donors);
      })
      .finally(() => {
        if (active) setLoadingDirectory(false);
      });
    return () => {
      active = false;
    };
  }, [open, showVerifiedDirectory, request]);

  if (!open || !request) return null;

  const requestIsActive = isActiveRequestStatus(request.status);

  const handleSelectDonor = async (donorId: string, donorName: string) => {
    if (selectingDonorId) return;
    setSelectingDonorId(donorId);
    try {
      await ownerSelectDonorForRequest({
        requestId: request.id,
        donorId,
      });
      showToast(
        'Donor Selected',
        'success',
        `${donorName} has been assigned and notified. Status is now Donor Found.`
      );
      onDonorSelected(donorId, donorName);
      await loadInterests();
    } catch (err) {
      showToast(
        'Selection Failed',
        'error',
        err instanceof Error ? err.message : 'Could not select donor.'
      );
    } finally {
      setSelectingDonorId(null);
    }
  };

  const handleRequestContact = async (donor: BloodRequestInterest) => {
    if (contactingDonorId) return;
    setContactingDonorId(donor.donor_id);
    try {
      await sendContactRequestToDonor({
        donorId: donor.donor_id,
        bloodRequestId: request.id,
        message: `Coordinating blood donation (${request.required_blood_group}) for ${request.patient_name} at ${request.hospital_name}.`,
      });
      showToast(
        'Contact Request Sent',
        'success',
        `${donor.full_name} received your in-app contact request.`
      );
      await loadInterests();
    } catch (err) {
      showToast(
        'Contact Request Failed',
        'error',
        err instanceof Error ? err.message : 'Unable to send contact request.'
      );
    } finally {
      setContactingDonorId(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="interested-members-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <h2
              id="interested-members-title"
              className="font-display text-lg font-bold text-slate-900 dark:text-white"
            >
              Interested Members · {request.patient_name}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {request.required_blood_group} · {request.hospital_name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close interested members modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950"
                />
              ))}
            </div>
          ) : interests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-950">
              <Users className="mx-auto h-7 w-7 text-slate-400" />
              <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                No members have expressed interest yet
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                When community donors click &ldquo;I&apos;m Interested&rdquo;, their profiles appear
                here right away.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {interests.map((item) => {
                const isSelected =
                  item.status === 'selected' ||
                  item.status === 'completed' ||
                  request.fulfilled_by_donor_id === item.donor_id;
                const isSelecting = selectingDonorId === item.donor_id;
                const isContacting = contactingDonorId === item.donor_id;

                return (
                  <div
                    key={item.interest_id}
                    className={`rounded-xl border p-4 ${
                      isSelected
                        ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-900/70 dark:bg-emerald-950/20'
                        : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950'
                    }`}
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-display rounded bg-[#C62828] px-2 py-0.5 text-xs font-bold text-white">
                            {item.blood_group}
                          </span>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            {item.full_name}
                          </h3>
                          {item.verification_status === 'approved' && (
                            <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300">
                              <ShieldCheck className="h-3 w-3" />
                              Verified
                            </span>
                          )}
                          {isSelected && (
                            <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-300">
                              <UserCheck className="h-3 w-3" />
                              Selected Donor
                            </span>
                          )}
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                          <span>
                            {item.department_code} · Batch {item.batch}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {item.location}
                          </span>
                          <span
                            className={`font-semibold ${
                              item.is_available
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-slate-500'
                            }`}
                          >
                            {item.is_available ? 'Available' : 'Unavailable'}
                          </span>
                        </div>

                        <div className="font-mono-tabular mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                          <span>
                            <Droplets className="mr-1 inline h-3.5 w-3.5 text-[#C62828]" />
                            Total Donations: {item.total_donations}
                          </span>
                          <span>
                            Last Donation: {item.last_donation_date || 'Not recorded'}
                          </span>
                        </div>

                        {item.message && (
                          <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                            &ldquo;{item.message}&rdquo;
                          </p>
                        )}

                        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                          {item.contact_phone ? (
                            <span className="font-mono-tabular inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                              <Phone className="h-3.5 w-3.5 text-emerald-600" />
                              {item.contact_phone}
                            </span>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                                <Lock className="h-3.5 w-3.5" />
                                Contact shared after consent or selection
                              </span>
                              {canManage &&
                                requestIsActive &&
                                (!item.contact_request_status ? (
                                  <button
                                    type="button"
                                    disabled={isContacting}
                                    onClick={() => handleRequestContact(item)}
                                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                  >
                                    <Send className="h-3 w-3" />
                                    {isContacting ? 'Sending...' : 'Request Contact'}
                                  </button>
                                ) : (
                                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium capitalize text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                    Contact request: {item.contact_request_status}
                                  </span>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {canManage && requestIsActive && (
                        <div className="flex shrink-0 flex-row gap-2 sm:flex-col">
                          {!isSelected ? (
                            <button
                              type="button"
                              disabled={Boolean(selectingDonorId)}
                              onClick={() => handleSelectDonor(item.donor_id, item.full_name)}
                              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600"
                            >
                              {isSelecting ? 'Selecting...' : 'Select as Donor'}
                            </button>
                          ) : (
                            onProceedToComplete && (
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  onProceedToComplete(item.donor_id);
                                }}
                                className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#C62828] px-3 py-2 text-xs font-semibold text-white hover:bg-[#B71C1C]"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Complete Donation
                              </button>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Optional Verified Directory Fallback if owner coordinated outside interest list */}
          {canManage && requestIsActive && (
            <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowVerifiedDirectory((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C62828] hover:underline dark:text-red-400"
              >
                <Search className="h-3.5 w-3.5" />
                {showVerifiedDirectory
                  ? 'Hide verified donor directory'
                  : `Or pick from available ${request.required_blood_group} verified campus donors`}
              </button>

              {showVerifiedDirectory && (
                <div className="mt-3 space-y-2">
                  {loadingDirectory ? (
                    <p className="text-xs text-slate-500">Searching verified donors...</p>
                  ) : verifiedDonors.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No publicly discoverable {request.required_blood_group} donors found.
                    </p>
                  ) : (
                    verifiedDonors.map((donor) => (
                      <div
                        key={donor.donor_id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-800"
                      >
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {donor.display_name} ({donor.blood_group})
                          </p>
                          <p className="text-slate-500 dark:text-slate-400">
                            {donor.department_code} · {donor.location} · {donor.total_donations}{' '}
                            donations
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={Boolean(selectingDonorId)}
                          onClick={() => handleSelectDonor(donor.donor_id, donor.display_name)}
                          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          {selectingDonorId === donor.donor_id ? 'Selecting...' : 'Select Donor'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
