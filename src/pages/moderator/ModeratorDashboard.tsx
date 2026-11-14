import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ClipboardList, Flag, ShieldCheck, XCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  fetchModeratorWorkspace,
  moderateBloodRequestStatus,
  resolveReport,
  reviewVerificationRequest,
} from '../../services/adminService';
import type {
  AdminLogItem,
  BloodRequest,
  ReportItem,
  RequestStatus,
  VerificationRequest,
} from '../../types/database';

type ModTab = 'verifications' | 'requests' | 'reports' | 'logs';

export function ModeratorDashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState<ModTab>('verifications');
  const [loading, setLoading] = useState(true);
  const [verifications, setVerifications] = useState<VerificationRequest[]>([]);
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [logs, setLogs] = useState<AdminLogItem[]>([]);
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const ws = await fetchModeratorWorkspace();
      setVerifications(ws.verifications);
      setRequests(ws.requests);
      setReports(ws.reports);
      setLogs(ws.logs);
    } catch (err) {
      showToast(
        'Failed to load moderator queue',
        'error',
        err instanceof Error ? err.message : 'Check permissions.'
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleVerify = async (id: string, decision: 'approved' | 'rejected') => {
    try {
      await reviewVerificationRequest(id, decision, notesMap[id]);
      showToast(`Donor verification ${decision}`, 'success');
      await loadData();
    } catch (err) {
      showToast('Action Failed', 'error', err instanceof Error ? err.message : 'Error');
    }
  };

  const handleModerateRequest = async (
    id: string,
    nextStatus: Exclude<RequestStatus, 'pending'>
  ) => {
    try {
      await moderateBloodRequestStatus(id, nextStatus, notesMap[id]);
      showToast(`Blood request updated to ${nextStatus.replace('_', ' ')}`, 'success');
      await loadData();
    } catch (err) {
      showToast('Action Failed', 'error', err instanceof Error ? err.message : 'Error');
    }
  };

  const handleReportDecision = async (
    id: string,
    status: 'reviewing' | 'resolved' | 'dismissed'
  ) => {
    if (!user) return;
    try {
      await resolveReport(id, user.id, status, notesMap[id] || '');
      showToast(`Report marked ${status}`, 'success');
      await loadData();
    } catch (err) {
      showToast('Action Failed', 'error', err instanceof Error ? err.message : 'Error');
    }
  };

  const pendingVerifications = verifications.filter((v) => v.status === 'pending');
  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const openReports = reports.filter((r) => r.status === 'open' || r.status === 'reviewing');

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="border-b border-slate-200 pb-6 dark:border-slate-800">
        <p className="text-xs font-semibold text-[#C62828] dark:text-red-400">
          Campus Moderation Console
        </p>
        <h1 className="font-display mt-1 text-2xl font-extrabold text-slate-900 dark:text-white sm:text-3xl">
          Moderator Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Review student donor verifications, verify urgent blood requests, and resolve community
          reports.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Pending Donor Verifications
          </p>
          <p className="font-mono-tabular mt-1.5 text-3xl font-bold text-slate-900 dark:text-white">
            {pendingVerifications.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Pending Blood Requests
          </p>
          <p className="font-mono-tabular mt-1.5 text-3xl font-bold text-[#C62828] dark:text-red-400">
            {pendingRequests.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Open Reports
          </p>
          <p className="font-mono-tabular mt-1.5 text-3xl font-bold text-slate-900 dark:text-white">
            {openReports.length}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-8 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-900">
        {[
          { key: 'verifications', label: `Donor Verifications (${verifications.length})` },
          { key: 'requests', label: `Blood Requests (${requests.length})` },
          { key: 'reports', label: `Reports (${reports.length})` },
          { key: 'logs', label: 'Audit History' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key as ModTab)}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              tab === item.key
                ? 'bg-[#C62828] text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
        ) : tab === 'verifications' ? (
          <div className="space-y-4">
            {verifications.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                No donor verification requests found.
              </div>
            ) : (
              verifications.map((v) => (
                <div
                  key={v.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <ShieldCheck className="h-4 w-4 text-[#C62828]" />
                        <span className="capitalize font-semibold">{v.status}</span>
                        <span>·</span>
                        <span className="font-mono-tabular">ID: {v.student_id_snapshot}</span>
                        <span>·</span>
                        <span>Group: {v.requested_blood_group}</span>
                      </div>
                      <h2 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                        {v.profile?.full_name || 'Student User'} ({v.profile?.department?.code || 'Dept'})
                      </h2>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        {v.notes || 'Registration verification'}
                      </p>
                    </div>

                    {v.status === 'pending' &&
                      (v.user_id === user?.id ? (
                        <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                          Own verification (requires another moderator/admin)
                        </span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            placeholder="Moderator note..."
                            value={notesMap[v.id] || ''}
                            onChange={(e) => setNotesMap({ ...notesMap, [v.id]: e.target.value })}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                          />
                          <button
                            type="button"
                            onClick={() => handleVerify(v.id, 'approved')}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleVerify(v.id, 'rejected')}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-[#C62828] hover:bg-red-50 dark:border-red-900 dark:text-red-400"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : tab === 'requests' ? (
          <div className="space-y-4">
            {requests.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                  <div>
                    <p className="text-xs text-slate-500">
                      <span className="capitalize font-semibold">{r.status.replace('_', ' ')}</span>{' '}
                      · {r.required_blood_group} · {r.bags_needed} bags · {r.required_date}
                    </p>
                    <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                      {r.patient_name} — {r.hospital_name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                      Contact: {r.contact_person} ({r.contact_phone})
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {r.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleModerateRequest(r.id, 'verified')}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Verify Request
                      </button>
                    )}
                    {r.status === 'verified' && (
                      <button
                        type="button"
                        onClick={() => handleModerateRequest(r.id, 'donor_found')}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-slate-700"
                      >
                        Mark Donor Found
                      </button>
                    )}
                    {(r.status === 'verified' || r.status === 'donor_found') && (
                      <button
                        type="button"
                        onClick={() => handleModerateRequest(r.id, 'completed')}
                        className="rounded-lg bg-[#C62828] px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Mark Completed
                      </button>
                    )}
                    {r.status !== 'cancelled' && r.status !== 'completed' && (
                      <button
                        type="button"
                        onClick={() => handleModerateRequest(r.id, 'cancelled')}
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-[#C62828] dark:border-red-900 dark:text-red-400"
                      >
                        Reject / Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : tab === 'reports' ? (
          <div className="space-y-4">
            {reports.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                No reported accounts or requests.
              </div>
            ) : (
              reports.map((rep) => (
                <div
                  key={rep.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Flag className="h-3.5 w-3.5 text-[#C62828]" />
                        <span className="capitalize font-semibold">{rep.status}</span>
                        <span>·</span>
                        <span>{new Date(rep.created_at).toLocaleDateString()}</span>
                      </div>
                      <h3 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                        {rep.reason}
                      </h3>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{rep.details}</p>
                    </div>
                    {(rep.status === 'open' || rep.status === 'reviewing') && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleReportDecision(rep.id, 'resolved')}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Resolve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReportDecision(rep.id, 'dismissed')}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium dark:border-slate-700"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3.5 text-sm font-bold dark:border-slate-800">
              <ClipboardList className="h-4 w-4 text-[#C62828]" />
              <span>Recent Moderation & Audit Logs</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {logs.map((l) => (
                <div key={l.id} className="flex items-center justify-between px-5 py-3 text-xs">
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white">{l.action}</span>
                    <span className="text-slate-500">
                      {' '}
                      on {l.target_table} by {l.actor?.full_name || 'Staff'}
                    </span>
                  </div>
                  <span className="font-mono-tabular text-slate-400">
                    {new Date(l.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
