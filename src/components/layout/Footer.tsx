import { Link } from 'react-router-dom';
import { Mail, MapPin, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { BrandLogo } from '../common/BrandLogo';

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <BrandLogo className="h-7 w-7" />
              <span className="font-display text-base font-bold text-slate-900 dark:text-white">
                {t.brandName}
              </span>
            </div>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {t.universityName}, Bangladesh — A student-led voluntary blood donation management
              network designed for donor privacy, verified campus coordination, and rapid emergency
              response.
            </p>
            <div className="mt-4 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#C62828] dark:text-red-400" />
                <span>Netrokona University, Netrokona-2400, Bangladesh</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 shrink-0 text-[#C62828] dark:text-red-400" />
                <a
                  href="mailto:siam62326@gmail.com"
                  className="break-all transition-colors hover:text-[#C62828] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C62828]/50 dark:hover:text-red-400"
                >
                  siam62326@gmail.com
                </a>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Platform</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link to="/donors" className="hover:text-[#C62828] dark:hover:text-red-400">
                  Find Blood Donors
                </Link>
              </li>
              <li>
                <Link to="/requests" className="hover:text-[#C62828] dark:hover:text-red-400">
                  Blood Requests
                </Link>
              </li>
              <li>
                <Link to="/requests/new" className="hover:text-[#C62828] dark:hover:text-red-400">
                  Submit Emergency Request
                </Link>
              </li>
              <li>
                <Link to="/compatibility" className="hover:text-[#C62828] dark:hover:text-red-400">
                  Compatibility Reference
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Student Access
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link to="/register" className="hover:text-[#C62828] dark:hover:text-red-400">
                  Become a Donor
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-[#C62828] dark:hover:text-red-400">
                  Student Sign In
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-[#C62828] dark:hover:text-red-400">
                  About Us & Privacy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-slate-200 pt-6 text-xs sm:flex-row sm:items-center dark:border-slate-800">
          <p>
            © {new Date().getFullYear()} Campus Blood Connect · Netrokona University. Voluntary
            non-profit campus service.
          </p>
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <ShieldCheck className="h-4 w-4 text-[#C62828] dark:text-red-400" />
            <span>Medical crossmatching must always be confirmed by a hospital blood bank.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
