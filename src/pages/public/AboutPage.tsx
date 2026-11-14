import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, ShieldCheck, Users } from 'lucide-react';
import communityDriveImg from '../../assets/images/donor_community_drive_1794561232426.jpg';

export function AboutPage() {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold text-[#C62828] dark:text-red-400">
          About Campus Blood Connect
        </p>
        <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          Built for Netrokona University’s Voluntary Blood Donor Network
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300">
          Campus Blood Connect bridges students, faculty, and local hospitals in Netrokona with a
          verified, privacy-preserving donor directory and structured blood request workflow.
        </p>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {!imgFailed ? (
          <img
            src={communityDriveImg}
            alt="University blood donation awareness seminar and voluntary donor drive"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="aspect-[16/9] w-full object-cover"
          />
        ) : (
          <div className="flex aspect-[16/9] items-center justify-center bg-slate-100 dark:bg-slate-800">
            <Users className="h-12 w-12 text-[#C62828]" />
          </div>
        )}
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <ShieldCheck className="h-6 w-6 text-[#C62828] dark:text-red-400" />
          <h2 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
            Moderator Verification
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Student IDs and blood group updates are reviewed by authorized campus moderators before
            appearing in public donor searches.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <Lock className="h-6 w-6 text-[#C62828] dark:text-red-400" />
          <h2 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
            Zero Public PII Exposure
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Phone numbers, email addresses, and Student IDs are protected by PostgreSQL Row Level
            Security and are never exposed on public donor cards.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <Users className="h-6 w-6 text-[#C62828] dark:text-red-400" />
          <h2 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
            Donor Control
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Students can pause availability or hide public discoverability anytime from their
            personal dashboard.
          </p>
        </div>
      </div>

      <div className="mt-10 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
          Join or Request Support
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Whether you are a Netrokona University student ready to donate or coordinating blood for a
          patient at Netrokona Sadar Hospital, you can get started in minutes.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            to="/register"
            className="rounded-lg bg-[#C62828] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#B71C1C]"
          >
            Register as a Student Donor
          </Link>
          <Link
            to="/donors"
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Find Verified Donors
          </Link>
        </div>
      </div>
    </div>
  );
}
