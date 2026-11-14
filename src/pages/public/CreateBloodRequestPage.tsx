import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Lock, Send } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { createBloodRequest } from '../../services/requestService';
import type { BloodGroup } from '../../types/database';
import { BLOOD_GROUPS } from '../../utils/bloodCompatibility';
import { validateBloodRequestForm } from '../../utils/validation';

export function CreateBloodRequestPage() {
  const { user, profile, isConfigured } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const todayIso = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    patientName: '',
    requiredBloodGroup: 'O+' as BloodGroup,
    hospitalName: '',
    hospitalLocation: 'Netrokona Town',
    bagsNeeded: 1,
    requiredDate: todayIso,
    requiredTime: '10:00',
    contactPerson: profile?.full_name || '',
    contactPhone: profile?.phone || '',
    requesterName: profile?.full_name || '',
    requesterRelation: 'Self / Family',
    emergencyDescription: '',
    isEmergency: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateBloodRequestForm(form, todayIso);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    if (!user || !isConfigured) {
      showToast('Sign in required', 'error', 'Please sign in to submit a blood request.');
      return;
    }

    setSubmitting(true);
    try {
      await createBloodRequest({
        requesterId: user.id,
        requesterName: form.requesterName,
        requesterRelation: form.requesterRelation,
        patientName: form.patientName,
        requiredBloodGroup: form.requiredBloodGroup,
        hospitalName: form.hospitalName,
        hospitalLocation: form.hospitalLocation,
        bagsNeeded: Number(form.bagsNeeded),
        requiredDate: form.requiredDate,
        requiredTime: form.requiredTime,
        contactPerson: form.contactPerson,
        contactPhone: form.contactPhone,
        emergencyDescription: form.emergencyDescription,
        isEmergency: form.isEmergency,
      });

      showToast(
        'Blood Request Submitted',
        'success',
        'Your request is Pending moderator verification and visible in your Dashboard.'
      );
      navigate('/dashboard');
    } catch (err) {
      showToast(
        'Submission Failed',
        'error',
        err instanceof Error ? err.message : 'Unable to submit blood request.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div>
        <p className="text-sm font-semibold text-[#C62828] dark:text-red-400">
          Emergency & Planned Support
        </p>
        <h1 className="font-display mt-1 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Submit a Blood Donation Request
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          All requests undergo moderator verification to prevent spam and duplicate entries before
          being published to campus donors.
        </p>
      </div>

      {!user && (
        <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-xl border border-amber-300 bg-amber-50 p-5 sm:flex-row sm:items-center dark:border-amber-800 dark:bg-amber-950/40">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
            <div className="text-sm text-amber-950 dark:text-amber-100">
              <p className="font-semibold">Student sign-in required to publish requests</p>
              <p className="mt-0.5 text-xs">
                Signing in links the request to a verified campus account so moderators can contact
                you quickly.
              </p>
            </div>
          </div>
          <Link
            to="/login"
            className="shrink-0 rounded-lg bg-[#C62828] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B71C1C]"
          >
            Sign In
          </Link>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-8 space-y-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="patient-name"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Patient Name *
            </label>
            <input
              id="patient-name"
              type="text"
              value={form.patientName}
              onChange={(e) => setForm({ ...form, patientName: e.target.value })}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            {errors.patientName && <p className="mt-1 text-xs text-red-600">{errors.patientName}</p>}
          </div>

          <div>
            <label
              htmlFor="req-bg"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Required Blood Group *
            </label>
            <select
              id="req-bg"
              value={form.requiredBloodGroup}
              onChange={(e) =>
                setForm({ ...form, requiredBloodGroup: e.target.value as BloodGroup })
              }
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              {BLOOD_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            {errors.requiredBloodGroup && (
              <p className="mt-1 text-xs text-red-600">{errors.requiredBloodGroup}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="hospital-name"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Hospital Name *
            </label>
            <input
              id="hospital-name"
              type="text"
              placeholder="e.g. Netrokona Sadar Hospital"
              value={form.hospitalName}
              onChange={(e) => setForm({ ...form, hospitalName: e.target.value })}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            {errors.hospitalName && (
              <p className="mt-1 text-xs text-red-600">{errors.hospitalName}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="hospital-location"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Hospital Address / Location *
            </label>
            <input
              id="hospital-location"
              type="text"
              value={form.hospitalLocation}
              onChange={(e) => setForm({ ...form, hospitalLocation: e.target.value })}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            {errors.hospitalLocation && (
              <p className="mt-1 text-xs text-red-600">{errors.hospitalLocation}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="bags-needed"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Number of Blood Bags *
            </label>
            <input
              id="bags-needed"
              type="number"
              min={1}
              max={20}
              value={form.bagsNeeded}
              onChange={(e) => setForm({ ...form, bagsNeeded: Number(e.target.value) })}
              className="font-mono-tabular mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            {errors.bagsNeeded && <p className="mt-1 text-xs text-red-600">{errors.bagsNeeded}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="req-date"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Required Date *
              </label>
              <input
                id="req-date"
                type="date"
                min={todayIso}
                value={form.requiredDate}
                onChange={(e) => setForm({ ...form, requiredDate: e.target.value })}
                className="font-mono-tabular mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
              {errors.requiredDate && (
                <p className="mt-1 text-xs text-red-600">{errors.requiredDate}</p>
              )}
            </div>
            <div>
              <label
                htmlFor="req-time"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Required Time *
              </label>
              <input
                id="req-time"
                type="time"
                value={form.requiredTime}
                onChange={(e) => setForm({ ...form, requiredTime: e.target.value })}
                className="font-mono-tabular mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
              {errors.requiredTime && (
                <p className="mt-1 text-xs text-red-600">{errors.requiredTime}</p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="contact-person"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Contact Person *
            </label>
            <input
              id="contact-person"
              type="text"
              value={form.contactPerson}
              onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            {errors.contactPerson && (
              <p className="mt-1 text-xs text-red-600">{errors.contactPerson}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="contact-phone"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Contact Phone Number *
            </label>
            <input
              id="contact-phone"
              type="tel"
              placeholder="01712345678"
              value={form.contactPhone}
              onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            {errors.contactPhone && (
              <p className="mt-1 text-xs text-red-600">{errors.contactPhone}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="requester-name"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Requester Name *
            </label>
            <input
              id="requester-name"
              type="text"
              value={form.requesterName}
              onChange={(e) => setForm({ ...form, requesterName: e.target.value })}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            {errors.requesterName && (
              <p className="mt-1 text-xs text-red-600">{errors.requesterName}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="requester-relation"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Relation to Patient
            </label>
            <input
              id="requester-relation"
              type="text"
              value={form.requesterRelation}
              onChange={(e) => setForm({ ...form, requesterRelation: e.target.value })}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="emergency-description"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            Medical Context & Ward Information *
          </label>
          <textarea
            id="emergency-description"
            rows={3}
            placeholder="Describe ward/cabin, surgery or medical reason, and any hospital blood bank instructions."
            value={form.emergencyDescription}
            onChange={(e) => setForm({ ...form, emergencyDescription: e.target.value })}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
          {errors.emergencyDescription && (
            <p className="mt-1 text-xs text-red-600">{errors.emergencyDescription}</p>
          )}
        </div>

        <label className="flex items-center gap-2.5 text-sm font-medium text-slate-800 dark:text-slate-200">
          <input
            type="checkbox"
            checked={form.isEmergency}
            onChange={(e) => setForm({ ...form, isEmergency: e.target.checked })}
            className="h-4 w-4 rounded accent-[#C62828]"
          />
          <span>Mark as Emergency Request (requires immediate same-day response)</span>
        </label>

        <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>
            Hospital blood bank crossmatching and physician approval are mandatory before any blood
            transfusion.
          </span>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link
            to="/requests"
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-[#C62828] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#B71C1C] disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {submitting ? 'Submitting...' : 'Submit Blood Request'}
          </button>
        </div>
      </form>
    </div>
  );
}
