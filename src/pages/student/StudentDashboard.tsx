import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera,
  Check,
  CheckCircle2,
  FileUp,
  Plus,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { SearchableDepartmentSelect } from '../../components/common/SearchableDepartmentSelect';
import { CompleteDonationModal } from '../../components/requests/CompleteDonationModal';
import { InterestedMembersModal } from '../../components/requests/InterestedMembersModal';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  fetchMyDonorWorkspace,
  respondToContactRequest,
  submitStudentTestimonial,
  submitVerificationDocument,
  toggleDonorAvailability,
  updateMyProfileAndDonor,
  uploadProfileAvatar,
} from '../../services/donorService';
import { fetchActiveDepartments } from '../../services/publicService';
import { cancelOwnBloodRequest, fetchMyBloodRequests } from '../../services/requestService';
import type {
  BloodGroup,
  BloodRequest,
  ContactRequest,
  Department,
  DonationHistory,
  DonorDetails,
  Profile,
  VerificationRequest,
} from '../../types/database';
import { BLOOD_GROUPS } from '../../utils/bloodCompatibility';
import { formatDepartmentLabel } from '../../utils/departments';
import {
  canCompleteBloodRequest,
  formatRequestStatusLabel,
  getRequestStatusBadgeClass,
  isActiveRequestStatus,
} from '../../utils/requestStatus';
import { computeProfileCompletion } from '../../utils/validation';

type TabKey = 'profile' | 'requests' | 'contacts' | 'donations';

export function StudentDashboard() {
  const { user, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState<TabKey>('profile');
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [donorDetails, setDonorDetails] = useState<DonorDetails | null>(null);
  const [donations, setDonations] = useState<DonationHistory[]>([]);
  const [myRequests, setMyRequests] = useState<BloodRequest[]>([]);
  const [incomingContacts, setIncomingContacts] = useState<ContactRequest[]>([]);
  const [outgoingContacts, setOutgoingContacts] = useState<ContactRequest[]>([]);
  const [verifications, setVerifications] = useState<VerificationRequest[]>([]);

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    department_id: '',
    batch: '',
    blood_group: 'O+' as BloodGroup,
    location: 'Netrokona Campus',
    is_available: true,
    is_publicly_discoverable: true,
    contact_preference: 'in_app' as 'in_app' | 'phone_on_approval',
    show_last_donation_date: true,
    bio: '',
  });

  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docNotes, setDocNotes] = useState('');
  const [submittingDoc, setSubmittingDoc] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [interestedTarget, setInterestedTarget] = useState<BloodRequest | null>(null);
  const [completeTarget, setCompleteTarget] = useState<{
    request: BloodRequest;
    initialDonorId?: string | null;
  } | null>(null);

  const [testimonialQuote, setTestimonialQuote] = useState('');
  const [submittingTestimonial, setSubmittingTestimonial] = useState(false);

  const loadWorkspace = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [depts, ws, reqs] = await Promise.all([
        fetchActiveDepartments(),
        fetchMyDonorWorkspace(user.id),
        fetchMyBloodRequests(user.id),
      ]);
      setDepartments(depts);
      setProfile(ws.profile);
      setDonorDetails(ws.donorDetails);
      setDonations(ws.donations);
      setIncomingContacts(ws.incomingContacts);
      setOutgoingContacts(ws.outgoingContacts);
      setVerifications(ws.verifications);
      setMyRequests(reqs);

      if (ws.profile && ws.donorDetails) {
        setForm({
          full_name: ws.profile.full_name,
          phone: ws.profile.phone,
          department_id: ws.profile.department_id || '',
          batch: ws.profile.batch,
          blood_group: ws.donorDetails.blood_group,
          location: ws.donorDetails.location,
          is_available: ws.donorDetails.is_available,
          is_publicly_discoverable: ws.donorDetails.is_publicly_discoverable,
          contact_preference: ws.donorDetails.contact_preference,
          show_last_donation_date: ws.donorDetails.show_last_donation_date,
          bio: ws.donorDetails.bio || '',
        });
      }
    } catch (err) {
      showToast(
        'Failed to load dashboard',
        'error',
        err instanceof Error ? err.message : 'Unable to fetch donor profile.'
      );
    } finally {
      setLoading(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const completion = computeProfileCompletion(profile, donorDetails);

  const handleQuickAvailability = async () => {
    if (!user || !donorDetails) return;
    const next = !donorDetails.is_available;
    try {
      await toggleDonorAvailability(user.id, next);
      setDonorDetails({ ...donorDetails, is_available: next });
      setForm((prev) => ({ ...prev, is_available: next }));
      showToast(
        next ? 'Marked Available' : 'Marked Unavailable',
        'success',
        next
          ? 'Verified profile is discoverable when Public Discoverability is enabled.'
          : 'You are hidden from public donor search results.'
      );
    } catch (err) {
      showToast('Update Failed', 'error', err instanceof Error ? err.message : 'Try again.');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !donorDetails) return;
    setSaving(true);
    try {
      await updateMyProfileAndDonor(
        user.id,
        {
          full_name: form.full_name,
          phone: form.phone,
          department_id: form.department_id || null,
          batch: form.batch,
        },
        {
          blood_group: form.blood_group,
          location: form.location,
          is_available: form.is_available,
          is_publicly_discoverable: form.is_publicly_discoverable,
          contact_preference: form.contact_preference,
          show_last_donation_date: form.show_last_donation_date,
          bio: form.bio,
        },
        donorDetails.blood_group,
        profile.student_id
      );
      await Promise.all([loadWorkspace(), refreshProfile()]);
      showToast(
        'Profile Updated',
        'success',
        donorDetails.blood_group !== form.blood_group
          ? 'Blood group updated. Re-verification by a moderator is now pending.'
          : 'Your donor profile settings were saved.'
      );
    } catch (err) {
      showToast('Save Failed', 'error', err instanceof Error ? err.message : 'Check your inputs.');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadProfileAvatar(user.id, file);
      setProfile((prev) => (prev ? { ...prev, avatar_url: url } : prev));
      await refreshProfile();
      showToast('Avatar Updated', 'success', 'Profile picture uploaded to Supabase Storage.');
    } catch (err) {
      showToast('Upload Failed', 'error', err instanceof Error ? err.message : 'Check image size/type.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !donorDetails) return;
    setSubmittingDoc(true);
    try {
      await submitVerificationDocument(
        user.id,
        donorDetails.blood_group,
        profile.student_id,
        docNotes,
        docFile
      );
      setDocFile(null);
      setDocNotes('');
      await loadWorkspace();
      showToast('Verification Submitted', 'success', 'Campus moderators will review your request.');
    } catch (err) {
      showToast('Submission Failed', 'error', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setSubmittingDoc(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!cancelTargetId) return;
    try {
      await cancelOwnBloodRequest(cancelTargetId);
      setCancelTargetId(null);
      await loadWorkspace();
      showToast('Request Cancelled', 'info');
    } catch (err) {
      showToast('Error', 'error', err instanceof Error ? err.message : 'Could not cancel request.');
    }
  };

  const handleContactResponse = async (id: string, decision: 'accepted' | 'declined') => {
    try {
      await respondToContactRequest(id, decision);
      await loadWorkspace();
      showToast(`Contact request ${decision}`, 'success');
    } catch (err) {
      showToast('Error', 'error', err instanceof Error ? err.message : 'Update failed.');
    }
  };

  const handleTestimonialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || testimonialQuote.trim().length < 20) {
      showToast('Too short', 'error', 'Please share at least 20 characters about your experience.');
      return;
    }
    setSubmittingTestimonial(true);
    try {
      await submitStudentTestimonial({
        userId: user.id,
        quote: testimonialQuote,
        roleLabel: `${profile?.department?.code || 'Student'} Donor`,
      });
      setTestimonialQuote('');
      showToast(
        'Story Submitted',
        'success',
        'Moderators will review your testimonial before publishing on the homepage.'
      );
    } catch (err) {
      showToast('Error', 'error', err instanceof Error ? err.message : 'Could not submit.');
    } finally {
      setSubmittingTestimonial(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* Header & Role Quick Links */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center dark:border-slate-800">
        <div>
          <p className="text-xs font-semibold text-[#C62828] dark:text-red-400">
            Student Donor Workspace · Netrokona University
          </p>
          <h1 className="font-display mt-1 text-2xl font-extrabold text-slate-900 dark:text-white sm:text-3xl">
            Welcome, {profile?.full_name || 'Student'}
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Student ID: <span className="font-mono-tabular font-semibold">{profile?.student_id}</span>
            {profile?.department && (
              <>
                {' '}
                · Department:{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {formatDepartmentLabel(profile.department)}
                </span>
              </>
            )}{' '}
            · Role: <span className="capitalize font-semibold">{profile?.role?.replace('_', ' ')}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(profile?.role === 'moderator' || profile?.role === 'super_admin') && (
            <Link
              to="/moderator"
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              Moderator Queue
            </Link>
          )}
          {profile?.role === 'super_admin' && (
            <Link
              to="/admin"
              className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-700"
            >
              Super Admin Panel
            </Link>
          )}
          <Link
            to="/requests/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#C62828] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B71C1C]"
          >
            <Plus className="h-4 w-4" />
            New Blood Request
          </Link>
        </div>
      </div>

      {/* Top Status Strip */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Profile Completion</p>
          <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-slate-900 dark:text-white">
            {completion}%
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div className="h-full bg-[#C62828]" style={{ width: `${completion}%` }} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Verification Status</p>
          <div className="mt-1.5 flex items-center gap-2">
            <ShieldCheck
              className={`h-5 w-5 ${
                donorDetails?.verification_status === 'approved'
                  ? 'text-emerald-600'
                  : donorDetails?.verification_status === 'rejected'
                    ? 'text-red-600'
                    : 'text-amber-600'
              }`}
            />
            <span className="text-base font-bold capitalize text-slate-900 dark:text-white">
              {donorDetails?.verification_status || 'pending'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Blood Group: <span className="font-bold text-[#C62828] dark:text-red-400">{donorDetails?.blood_group}</span>
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Donor Availability</p>
          <button
            type="button"
            onClick={handleQuickAvailability}
            className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"
          >
            {donorDetails?.is_available ? (
              <>
                <ToggleRight className="h-6 w-6 text-emerald-600" />
                <span>Available to Donate</span>
              </>
            ) : (
              <>
                <ToggleLeft className="h-6 w-6 text-slate-400" />
                <span>Currently Unavailable</span>
              </>
            )}
          </button>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Toggle anytime to pause search visibility
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Recorded Donations</p>
          <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-slate-900 dark:text-white">
            {Math.max(donorDetails?.total_donations ?? 0, donations.length)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Last: {donorDetails?.last_donation_date || donations[0]?.donation_date || 'No donation recorded'}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="mt-8 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-900">
        {[
          { key: 'profile', label: 'Profile & Verification' },
          { key: 'requests', label: `My Blood Requests (${myRequests.length})` },
          { key: 'contacts', label: `Contact Requests (${incomingContacts.length})` },
          { key: 'donations', label: `Donation History (${donations.length})` },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key as TabKey)}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === item.key
                ? 'bg-[#C62828] text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {tab === 'profile' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <form
              onSubmit={handleSaveProfile}
              className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-8 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 pb-5 dark:border-slate-800">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name}
                    referrerPolicy="no-referrer"
                    className="h-16 w-16 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {profile?.full_name?.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <Camera className="h-4 w-4" />
                    <span>{uploadingAvatar ? 'Uploading...' : 'Upload Profile Picture'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleAvatarUpload}
                      className="sr-only"
                    />
                  </label>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    JPG, PNG, or WebP up to 2MB
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Phone Number (Private)
                  </label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="font-mono-tabular mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label
                    htmlFor="profile-dept"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Department
                  </label>
                  <SearchableDepartmentSelect
                    id="profile-dept"
                    value={form.department_id}
                    onChange={(department_id) => setForm({ ...form, department_id })}
                    departments={departments}
                    legacySelectedDepartment={profile?.department}
                    placeholder="Select Your Department"
                    compact
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Batch
                  </label>
                  <input
                    type="text"
                    required
                    value={form.batch}
                    onChange={(e) => setForm({ ...form, batch: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Blood Group (Changing requires re-verification)
                  </label>
                  <select
                    value={form.blood_group}
                    onChange={(e) => setForm({ ...form, blood_group: e.target.value as BloodGroup })}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  >
                    {BLOOD_GROUPS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Current Campus / Town Location
                  </label>
                  <input
                    type="text"
                    required
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="space-y-2.5 border-t border-slate-100 pt-4 text-xs dark:border-slate-800">
                <label className="flex items-center gap-2.5 font-medium text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={form.is_publicly_discoverable}
                    onChange={(e) =>
                      setForm({ ...form, is_publicly_discoverable: e.target.checked })
                    }
                    className="h-4 w-4 rounded accent-[#C62828]"
                  />
                  <span>Allow verified profile in Public Donor Search</span>
                </label>

                <label className="flex items-center gap-2.5 font-medium text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={form.show_last_donation_date}
                    onChange={(e) =>
                      setForm({ ...form, show_last_donation_date: e.target.checked })
                    }
                    className="h-4 w-4 rounded accent-[#C62828]"
                  />
                  <span>Display last donation date on public donor card</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#C62828] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#B71C1C] disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </form>

            {/* Student Verification Upload */}
            <div className="space-y-5 lg:col-span-4">
              <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Identity & Blood Group Verification
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Upload your Netrokona University Student ID card or blood group lab card so a
                  moderator can approve your donor badge.
                </p>

                <form onSubmit={handleSubmitVerification} className="mt-4 space-y-3">
                  <div>
                    <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                      <FileUp className="h-4 w-4" />
                      <span>{docFile ? docFile.name : 'Choose ID / Blood Card (JPG/PNG/PDF)'}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,application/pdf"
                        onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                        className="sr-only"
                      />
                    </label>
                  </div>
                  <textarea
                    rows={2}
                    value={docNotes}
                    onChange={(e) => setDocNotes(e.target.value)}
                    placeholder="Optional note for moderator..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                  <button
                    type="submit"
                    disabled={submittingDoc}
                    className="w-full rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-red-700 dark:hover:bg-red-600"
                  >
                    {submittingDoc ? 'Submitting...' : 'Submit Verification Request'}
                  </button>
                </form>

                {verifications.length > 0 && (
                  <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Recent Submissions
                    </p>
                    <ul className="mt-2 space-y-2 text-xs">
                      {verifications.slice(0, 3).map((v) => (
                        <li
                          key={v.id}
                          className="flex items-center justify-between text-slate-600 dark:text-slate-400"
                        >
                          <span>{v.requested_blood_group}</span>
                          <span className="capitalize font-semibold">{v.status}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'requests' && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                My Submitted Blood Requests
              </h2>
              <Link
                to="/requests/new"
                className="text-xs font-semibold text-[#C62828] hover:underline dark:text-red-400"
              >
                + Submit New
              </Link>
            </div>

            {myRequests.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                You have not submitted any blood requests yet.
              </p>
            ) : (
              <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                {myRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex flex-col justify-between gap-3 py-4 lg:flex-row lg:items-center"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {req.patient_name} · {req.required_blood_group} ({req.bags_needed} bags)
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>
                          {req.hospital_name} · Needed {req.required_date}
                        </span>
                        <span
                          className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold ${getRequestStatusBadgeClass(
                            req.status
                          )}`}
                        >
                          {formatRequestStatusLabel(req.status)}
                        </span>
                        <span className="font-mono-tabular">
                          · {req.interested_count ?? 0} interested
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {isActiveRequestStatus(req.status) && (
                        <>
                          <button
                            type="button"
                            onClick={() => setInterestedTarget(req)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                          >
                            <Users className="h-3.5 w-3.5 text-[#C62828]" />
                            Interested ({req.interested_count ?? 0})
                          </button>
                          {(req.status === 'pending' || req.status === 'verified') && (
                            <button
                              type="button"
                              onClick={() => setInterestedTarget(req)}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-700"
                            >
                              <UserCheck className="h-3.5 w-3.5" />
                              Donor Found
                            </button>
                          )}
                          {canCompleteBloodRequest(req.status) && (
                            <button
                              type="button"
                              onClick={() =>
                                setCompleteTarget({
                                  request: req,
                                  initialDonorId: req.fulfilled_by_donor_id,
                                })
                              }
                              className="inline-flex items-center gap-1 rounded-lg bg-[#C62828] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#B71C1C]"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Donation Complete
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setCancelTargetId(req.id)}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-[#C62828] hover:bg-red-50 dark:border-red-900/60 dark:text-red-400"
                          >
                            Cancel Request
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'contacts' && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Incoming Donor Contact Requests
              </h2>
              {incomingContacts.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                  No incoming requests right now.
                </p>
              ) : (
                <div className="mt-4 space-y-4">
                  {incomingContacts.map((cr) => (
                    <div
                      key={cr.id}
                      className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          From: {cr.requester_profile?.full_name || 'Campus Member'}
                        </span>
                        <span className="capitalize text-slate-500">{cr.status}</span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {cr.message}
                      </p>
                      {cr.requester_phone && (
                        <p className="font-mono-tabular mt-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                          Callback: {cr.requester_phone}
                        </p>
                      )}
                      {cr.status === 'pending' && (
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleContactResponse(cr.id, 'accepted')}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => handleContactResponse(cr.id, 'declined')}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                          >
                            <X className="h-3.5 w-3.5" />
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Outgoing Contact Requests
              </h2>
              {outgoingContacts.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                  You have not contacted any donors yet.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {outgoingContacts.map((cr) => (
                    <div
                      key={cr.id}
                      className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          To: {cr.donor_profile?.full_name || 'Verified Donor'}
                        </span>
                        <span className="capitalize font-semibold text-slate-600 dark:text-slate-300">
                          {cr.status}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
                        {cr.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'donations' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Verified Donation History
              </h2>
              {donations.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                  No verified donations recorded on your profile yet.
                </p>
              ) : (
                <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                  {donations.map((d) => (
                    <div key={d.id} className="flex items-center justify-between py-3 text-sm">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {d.hospital_name}
                        </p>
                        <p className="font-mono-tabular text-xs text-slate-500">
                          {d.donation_date} · {d.units_donated} unit(s)
                        </p>
                      </div>
                      <span className="font-display font-bold text-[#C62828] dark:text-red-400">
                        {d.blood_group}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Share Your Donor Experience
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Approved stories appear on the Campus Blood Connect homepage.
              </p>
              <form onSubmit={handleTestimonialSubmit} className="mt-4 space-y-3">
                <textarea
                  rows={4}
                  value={testimonialQuote}
                  onChange={(e) => setTestimonialQuote(e.target.value)}
                  placeholder="Share how donating through Campus Blood Connect helped someone..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
                <button
                  type="submit"
                  disabled={submittingTestimonial}
                  className="rounded-lg bg-[#C62828] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B71C1C]"
                >
                  {submittingTestimonial ? 'Submitting...' : 'Submit for Approval'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      <InterestedMembersModal
        open={Boolean(interestedTarget)}
        request={interestedTarget}
        canManage
        onClose={() => setInterestedTarget(null)}
        onDonorSelected={(donorId) => {
          if (!interestedTarget) return;
          setInterestedTarget((prev) =>
            prev ? { ...prev, status: 'donor_found', fulfilled_by_donor_id: donorId } : null
          );
          loadWorkspace();
        }}
        onProceedToComplete={(donorId) => {
          if (!interestedTarget) return;
          setCompleteTarget({
            request: interestedTarget,
            initialDonorId: donorId ?? interestedTarget.fulfilled_by_donor_id,
          });
        }}
      />

      <CompleteDonationModal
        open={Boolean(completeTarget)}
        request={completeTarget?.request || null}
        initialDonorId={completeTarget?.initialDonorId}
        onClose={() => setCompleteTarget(null)}
        onCompleted={() => loadWorkspace()}
      />

      <ConfirmDialog
        open={Boolean(cancelTargetId)}
        title="Cancel Blood Request?"
        description="This will mark your blood request as cancelled and remove it from active searches. No donation history record will be created."
        confirmLabel="Confirm Cancel Request"
        destructive
        onConfirm={handleCancelRequest}
        onCancel={() => setCancelTargetId(null)}
      />
    </div>
  );
}
