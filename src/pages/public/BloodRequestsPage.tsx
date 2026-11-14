import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Flag,
  Hospital,
  Lock,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { CardGridSkeleton, EmptyState } from '../../components/common/StateFeedback';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { submitAbuseReport } from '../../services/donorService';
import { fetchPublicBloodRequests } from '../../services/publicService';
import type { PublicBloodRequest } from '../../types/database';
import { BLOOD_GROUPS } from '../../utils/bloodCompatibility';
import { formatRequestStatusLabel, getRequestStatusBadgeClass } from '../../utils/requestStatus';

const STATUS_OPTIONS = [
  { value: '', label: 'All Verified Requests' },
  { value: 'verified', label: 'Verified & Needed' },
  { value: 'donor_found', label: 'Donor Found' },
  { value: 'completed', label: 'Completed' },
];

const PROGRESS_STEPS = ['pending', 'verified', 'donor_found', 'completed'] as const;

export function BloodRequestsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [bloodGroup, setBloodGroup] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const [requests, setRequests] = useState<PublicBloodRequest[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeRequest, setActiveRequest] = useState<PublicBloodRequest | null>(null);
  const [reportTarget, setReportTarget] = useState<PublicBloodRequest | null>(null);
  const [reportReason, setReportReason] = useState('Suspicious or inaccurate hospital details');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchPublicBloodRequests({
          bloodGroup,
          location,
          status,
          page,
          pageSize: 12,
        });
        if (!active) return;
        setRequests(res.requests);
        setTotalCount(res.totalCount);
        setError(res.error);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load blood requests.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [bloodGroup, location, status, page]);

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reportTarget) return;
    if (reportDetails.trim().length < 10) {
      showToast('Details required', 'error', 'Please enter at least 10 characters explaining the issue.');
      return;
    }

    setSubmittingReport(true);
    try {
      await submitAbuseReport({
        reporterId: user.id,
        bloodRequestId: reportTarget.id,
        reason: reportReason,
        details: reportDetails,
      });
      showToast('Report Submitted', 'success', 'Moderators will review this blood request.');
      setReportTarget(null);
      setReportDetails('');
    } catch (err) {
      showToast('Error', 'error', err instanceof Error ? err.message : 'Unable to submit report.');
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Verified Blood Requests
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Active and completed hospital requests verified by campus moderators. Unauthenticated
            visitors see masked phone numbers to protect patient privacy.
          </p>
        </div>
        <Link
          to="/requests/new"
          className="inline-flex items-center gap-2 rounded-lg bg-[#C62828] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#B71C1C] whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          Submit Blood Request
        </Link>
      </div>

      {/* Filters */}
      <div className="mt-8 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <label
            htmlFor="req-blood-group"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            Blood Group
          </label>
          <select
            id="req-blood-group"
            value={bloodGroup}
            onChange={(e) => {
              setBloodGroup(e.target.value);
              setPage(1);
            }}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          >
            <option value="">All Groups</option>
            {BLOOD_GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="req-location"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            Hospital or Location
          </label>
          <input
            id="req-location"
            type="text"
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              setPage(1);
            }}
            placeholder="e.g. Netrokona Sadar Hospital"
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </div>

        <div>
          <label
            htmlFor="req-status"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            Status
          </label>
          <select
            id="req-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="font-mono-tabular mt-5 text-xs text-slate-500 dark:text-slate-400">
        {loading ? 'Loading requests...' : `${totalCount} requests found`}
      </p>

      <div className="mt-4">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            Error loading blood requests: {error}
          </div>
        )}

        {loading ? (
          <CardGridSkeleton count={4} />
        ) : requests.length === 0 ? (
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title="No matching verified blood requests"
            description="Only moderator-verified requests appear in the public feed. Submit a new request if a patient needs urgent blood."
            action={
              <Link
                to="/requests/new"
                className="rounded-lg bg-[#C62828] px-4 py-2 text-sm font-semibold text-white hover:bg-[#B71C1C]"
              >
                Create Blood Request
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {requests.map((req) => (
              <article
                key={req.id}
                className={`rounded-xl border p-5 transition-colors ${
                  req.is_emergency && req.status !== 'completed'
                    ? 'border-red-300 bg-red-50/40 dark:border-red-900/70 dark:bg-red-950/20'
                    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      {req.is_emergency && req.status !== 'completed' && (
                        <span className="inline-flex items-center gap-1 font-bold text-[#C62828] dark:text-red-400">
                          <AlertCircle className="h-3.5 w-3.5" />
                          Emergency
                        </span>
                      )}
                      {req.is_emergency && req.status !== 'completed' && <span aria-hidden="true">·</span>}
                      <span
                        className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold ${getRequestStatusBadgeClass(
                          req.status
                        )}`}
                      >
                        {formatRequestStatusLabel(req.status)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular">
                        {req.bags_needed} {req.bags_needed === 1 ? 'bag' : 'bags'}
                      </span>
                    </div>

                    <h2 className="mt-1.5 text-lg font-bold text-slate-900 dark:text-white">
                      Patient: {req.patient_name}
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1">
                        <Hospital className="h-3.5 w-3.5" />
                        {req.hospital_name}, {req.hospital_location}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono-tabular">
                        <Calendar className="h-3.5 w-3.5" />
                        {req.required_date} {req.required_time?.slice(0, 5)}
                      </span>
                    </div>
                  </div>

                  <span className="font-display shrink-0 rounded-lg bg-[#C62828] px-3 py-1.5 text-lg font-extrabold text-white">
                    {req.required_blood_group}
                  </span>
                </div>

                <p className="mt-3 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                  {req.emergency_description}
                </p>

                {/* Progress Indicator */}
                <div className="mt-4 grid grid-cols-4 gap-1.5" aria-label="Request progress">
                  {PROGRESS_STEPS.map((step, i) => {
                    const activeIdx = PROGRESS_STEPS.indexOf(
                      req.status as (typeof PROGRESS_STEPS)[number]
                    );
                    const reached = activeIdx >= i;
                    return (
                      <div key={step} className="text-center">
                        <div
                          className={`h-1.5 rounded-full ${
                            reached
                              ? 'bg-[#C62828] dark:bg-red-500'
                              : 'bg-slate-200 dark:bg-slate-800'
                          }`}
                        />
                        <p className="mt-1 text-[10px] capitalize text-slate-500 dark:text-slate-400">
                          {step.replace('_', ' ')}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 text-xs dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">
                    Posted {new Date(req.created_at).toLocaleString()}
                  </span>
                  <div className="flex items-center gap-3">
                    {user && (
                      <button
                        type="button"
                        onClick={() => setReportTarget(req)}
                        className="inline-flex items-center gap-1 text-slate-500 hover:text-red-700 dark:text-slate-400"
                      >
                        <Flag className="h-3.5 w-3.5" />
                        Report
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveRequest(req)}
                      className="font-semibold text-[#C62828] hover:underline dark:text-red-400"
                    >
                      Details & Contact
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {totalCount > 12 && (
          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <span className="font-mono-tabular text-xs font-semibold text-slate-600 dark:text-slate-300">
              Page {page} / {Math.max(1, Math.ceil(totalCount / 12))}
            </span>
            <button
              type="button"
              disabled={page >= Math.max(1, Math.ceil(totalCount / 12))}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {activeRequest && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="request-detail-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="request-detail-title"
                  className="font-display text-lg font-bold text-slate-900 dark:text-white"
                >
                  Request Details · {activeRequest.required_blood_group}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Created {new Date(activeRequest.created_at).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveRequest(null)}
                aria-label="Close details modal"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between gap-4 border-b border-slate-100 pb-2 dark:border-slate-800">
                <dt className="text-slate-500 dark:text-slate-400">Status</dt>
                <dd>
                  <span
                    className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${getRequestStatusBadgeClass(
                      activeRequest.status
                    )}`}
                  >
                    {formatRequestStatusLabel(activeRequest.status)}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-slate-100 pb-2 dark:border-slate-800">
                <dt className="text-slate-500 dark:text-slate-400">Patient</dt>
                <dd className="font-semibold text-slate-900 dark:text-white">
                  {activeRequest.patient_name}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-slate-100 pb-2 dark:border-slate-800">
                <dt className="text-slate-500 dark:text-slate-400">Hospital</dt>
                <dd className="text-right font-medium text-slate-900 dark:text-white">
                  {activeRequest.hospital_name}, {activeRequest.hospital_location}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-slate-100 pb-2 dark:border-slate-800">
                <dt className="text-slate-500 dark:text-slate-400">Bags & Schedule</dt>
                <dd className="font-mono-tabular font-medium text-slate-900 dark:text-white">
                  {activeRequest.bags_needed} bags · {activeRequest.required_date} at{' '}
                  {activeRequest.required_time?.slice(0, 5)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-slate-100 pb-2 dark:border-slate-800">
                <dt className="text-slate-500 dark:text-slate-400">Contact Person</dt>
                <dd className="font-medium text-slate-900 dark:text-white">
                  {activeRequest.contact_person}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-slate-100 pb-2 dark:border-slate-800">
                <dt className="text-slate-500 dark:text-slate-400">Contact Phone</dt>
                <dd className="font-mono-tabular font-semibold text-slate-900 dark:text-white">
                  {user ? (
                    activeRequest.contact_phone_masked
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-slate-500">
                      <Lock className="h-3.5 w-3.5" />
                      {activeRequest.contact_phone_masked}
                    </span>
                  )}
                </dd>
              </div>
            </dl>

            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700 dark:bg-slate-950 dark:text-slate-300">
              {activeRequest.emergency_description}
            </p>

            {!user && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                <span>Sign in as a registered student to view the full contact number.</span>
                <Link
                  to="/login"
                  className="shrink-0 font-semibold text-[#C62828] underline dark:text-red-300"
                >
                  Sign In
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Report Blood Request
            </h2>
            <form onSubmit={handleReportSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Reason
                </label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  <option>Suspicious or inaccurate hospital details</option>
                  <option>Duplicate blood request</option>
                  <option>Commercial or paid solicitation</option>
                  <option>Already fulfilled / outdated</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Additional Details
                </label>
                <textarea
                  rows={3}
                  required
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  placeholder="Explain what needs moderator review..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReportTarget(null)}
                  className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-medium dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReport}
                  className="rounded-lg bg-[#C62828] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B71C1C]"
                >
                  {submittingReport ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
