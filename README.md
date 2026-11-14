# Campus Blood Connect — Netrokona University

**Tagline:** *Donate Blood, Save Lives.*

Campus Blood Connect is a production-ready, privacy-first blood donation management web platform built for **Netrokona University, Bangladesh**. It connects verified student blood donors with urgent hospital needs while protecting private student contact information using PostgreSQL Row Level Security (RLS) and role-based access control.

---

## 1. Project Overview

Students and campus coordinators often struggle with fragmented social media posts during medical emergencies. Campus Blood Connect provides a structured, verified university network where:
- Students register with their university details and blood group.
- Campus moderators verify student identities before donors appear in public searches.
- Requesters find available donors by blood group, department, batch, and location without exposing personal phone numbers or Student IDs.
- Emergency blood requests go through verification, progress tracking, and automatic past-due expiration.

---

## 2. Core Features

- **Public Website**: Homepage with live Supabase statistics, blood group availability counts, verified blood requests, How It Works, Why Donate Blood, approved student testimonials, FAQ, About Us, and ABO/Rh Compatibility Guide with medical disclaimers.
- **Privacy-Safe Donor Search**: Filters by Blood Group (`A+` to `O-`), Department, Batch, Location, and 90+ day donation interval; pagination; in-app contact request modal.
- **Blood Donation Request System**: Request submission with validation & duplicate prevention, status tracking (`Pending -> Verified -> Donor Found -> Completed / Cancelled / Expired`), and abuse reporting.
- **Supabase Authentication & RBAC**: Registration, Sign In, Sign Out, Password Reset, and strict Role-Based Access Control (`Visitor`, `Student / Donor`, `Moderator`, `Super Admin`).
- **Role Dashboards**:
  - **Student Dashboard**: Profile completion, verification status, instant availability toggle, avatar & ID proof upload, my blood requests, incoming/outgoing contact requests, donation history, and testimonial submission.
  - **Moderator Dashboard**: Donor verification queue, blood request verification/status updates, report resolution, and audit history.
  - **Super Admin Dashboard**: Live analytics cards, Recharts visualizations (Blood Group Distribution, Department Donors, Monthly Trends, Request Statuses), user & role management, donation ledger, department management, activity logs, and platform settings.
- **In-App Notifications**: Unread counter, notification bell, mark as read / mark all read, and Supabase Realtime updates.
- **Accessibility & Localization**: English & Bangla (`EN` / `বাংলা`) language switcher, Light & Dark mode, responsive mobile drawer, loading skeletons, and empty states.

---

## 3. Technologies Used

- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS v4
- **Routing & Charts**: React Router (`react-router-dom`), Recharts, Lucide React
- **Backend & Database**: Supabase (PostgreSQL, Auth, Storage, Realtime, Row Level Security)
- **Hosting**: Vercel

---

## 4. Installation Instructions

### Prerequisites
- **Node.js 20+** and **npm** installed on your computer.
- A free **Supabase** account (`https://supabase.com`).
- A **GitHub** and **Vercel** account for deployment.

### Step 1: Install Dependencies
```bash
npm install
```

### Required Dependencies
Core packages included in `package.json`:
- `react`, `react-dom`, `react-router-dom`
- `@supabase/supabase-js`
- `recharts`
- `lucide-react`
- `tailwindcss`, `@tailwindcss/vite`

---

## 5. Environment Variable Setup

Create a `.env` file in the root directory (copy from `.env.example`):

```env
VITE_SUPABASE_URL="https://YOUR_PROJECT_ID.supabase.co"
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY"
VITE_UNIVERSITY_EMAIL_DOMAIN="neu.ac.bd"
```

> **Security Rule:** Never place your Supabase `service_role` key in `.env` or any `VITE_*` variable. Only the public `anon` / publishable key belongs in frontend code.

---

## 6. Supabase Project Setup

1. Log in to [Supabase Dashboard](https://supabase.com/dashboard) and click **New Project**.
2. Choose a project name (e.g., `campus-blood-connect-neu`), set a strong database password, and select a nearby region (e.g., Singapore `ap-southeast-1`).
3. Once provisioned, open **Project Settings → API** and copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** (or publishable) key → `VITE_SUPABASE_ANON_KEY`

---

## 7. SQL Migration Instructions

Run the three SQL migration files in order inside **Supabase Dashboard → SQL Editor**:

1. Open `supabase/migrations/001_initial_schema.sql` → paste into SQL Editor → **Run**.
   - Creates all 12 normalized tables (`departments`, `profiles`, `donor_details`, `verification_requests`, `blood_requests`, `donation_history`, `contact_requests`, `notifications`, `reports`, `admin_logs`, `platform_settings`, `testimonials`), constraints, indexes, and security triggers.
2. Open `supabase/migrations/002_rls_and_security.sql` → paste into SQL Editor → **Run**.
   - Enables Row Level Security (RLS) on all tables and installs `SECURITY DEFINER` RPCs (`get_public_platform_stats`, `search_public_donors`, `get_public_blood_requests`, `create_contact_request`, `review_donor_verification`, `moderate_blood_request`, `admin_update_user_role`, `expire_past_due_blood_requests`).
3. Open `supabase/migrations/003_storage_and_seed.sql` → paste into SQL Editor → **Run**.
   - Configures storage buckets (`avatars`, `verification-docs`), storage RLS policies, Netrokona University departments, and initial `platform_settings`.
4. Open `supabase/migrations/004_super_admin_security_hardening.sql` → paste into SQL Editor → **Run**.
   - Hardens `SECURITY DEFINER` triggers (`prevent_role_self_escalation`, `guard_donor_details_update`), tightens `profiles` RLS `WITH CHECK`, and installs `verify_user_role()` for database-backed route authorization.

*(Optional Scheduled Expiration)*: Enable the `pg_cron` extension under **Database → Extensions** in Supabase, then run the commented `cron.schedule(...)` statement at the bottom of `003_storage_and_seed.sql` to automatically expire past-due blood requests every hour.

---

## 8. Authentication Configuration

1. In Supabase Dashboard, go to **Authentication → Providers → Email** and ensure **Email** provider is enabled.
2. Go to **Authentication → URL Configuration**:
   - Set **Site URL** to your production domain (e.g. `https://your-app.vercel.app`) or `http://localhost:3000` during local-only development.
   - Add **Redirect URLs** for both local and production environments so dynamic `window.location.origin` redirects (email confirmation, password reset, and OAuth) work seamlessly everywhere:
     - `http://localhost:3000/**`
     - `https://your-app.vercel.app/**`
     - `https://*-your-vercel-scope.vercel.app/**` (optional, for Vercel preview deployments)
3. Under **Platform Settings** in the Admin Dashboard (or in `platform_settings`), you can toggle `enforce_domain: true` if you want registration strictly restricted to `@neu.ac.bd` / `@student.neu.ac.bd`.

---

## 9. Storage Bucket Configuration

Migration `003_storage_and_seed.sql` automatically creates two buckets:
- **`avatars`** (Public read, 2MB limit, JPEG/PNG/WebP): Users can upload/update files only inside their own `<user_id>/` folder.
- **`verification-docs`** (Private, 5MB limit, JPEG/PNG/PDF): Only the uploading student and verified Moderators / Super Admins can view verification documents.

---

## 10. Row Level Security (RLS) Summary

- **No self-escalation**: Database triggers block non-super-admins from modifying `profiles.role` or `profiles.is_active`.
- **No self-approval**: Donors cannot approve their own `verification_requests` or set `donor_details.verification_status = 'approved'`. Changing blood group automatically resets verification to `pending`.
- **Zero PII leakage**: Public visitors cannot `SELECT` `profiles` directly; public donor searches call `search_public_donors()`, which returns only approved, available, publicly discoverable donors without phone numbers, emails, or Student IDs.

---

## 11. Admin Account Bootstrap Instructions

For security, new signups are always assigned the `student` role automatically. To create your first **Super Admin**:

1. Register a normal student account through `/register` (and confirm email if email confirmation is enabled).
2. Open **Supabase Dashboard → SQL Editor**, replace `'your-admin-email@neu.ac.bd'` with your exact registered email, and run this fail-loud bootstrap script (it verifies **exactly 1** matching user and raises an error if 0 or multiple accounts match):
   ```sql
   DO $$
   DECLARE
     v_target_email CONSTANT TEXT := lower(trim('your-admin-email@neu.ac.bd'));
     v_user RECORD;
     v_match_count INTEGER;
     v_updated_count INTEGER;
     v_dept_id UUID;
     v_full_name TEXT;
     v_phone TEXT;
     v_student_id TEXT;
     v_batch TEXT;
     v_blood_group TEXT;
   BEGIN
     SELECT COUNT(*) INTO v_match_count
     FROM auth.users
     WHERE lower(trim(email)) = v_target_email;

     IF v_match_count = 0 THEN
       RAISE EXCEPTION 'Bootstrap aborted: No auth.users account found for %. Register via /register first.', v_target_email;
     ELSIF v_match_count > 1 THEN
       RAISE EXCEPTION 'Bootstrap aborted: Expected 1 auth.users row for %, found %.', v_target_email, v_match_count;
     END IF;

     SELECT id, email, raw_user_meta_data
     INTO v_user
     FROM auth.users
     WHERE lower(trim(email)) = v_target_email;

     BEGIN
       SELECT id INTO v_dept_id
       FROM public.departments
       WHERE id = NULLIF(v_user.raw_user_meta_data->>'department_id', '')::UUID;
     EXCEPTION WHEN OTHERS THEN
       v_dept_id := NULL;
     END;

     v_full_name := COALESCE(NULLIF(trim(v_user.raw_user_meta_data->>'full_name'), ''), split_part(v_user.email, '@', 1));
     IF char_length(v_full_name) < 2 THEN v_full_name := 'Super Admin'; END IF;

     v_phone := NULLIF(trim(v_user.raw_user_meta_data->>'phone'), '');
     IF v_phone IS NULL OR char_length(v_phone) NOT BETWEEN 10 AND 20 THEN v_phone := '01000000000'; END IF;

     v_student_id := NULLIF(trim(v_user.raw_user_meta_data->>'student_id'), '');
     IF v_student_id IS NULL OR char_length(v_student_id) NOT BETWEEN 4 AND 32 THEN
       v_student_id := 'ADMIN-' || substr(v_user.id::text, 1, 8);
     END IF;

     v_batch := COALESCE(NULLIF(trim(v_user.raw_user_meta_data->>'batch'), ''), 'Admin');
     v_blood_group := COALESCE(NULLIF(trim(v_user.raw_user_meta_data->>'blood_group'), ''), 'O+');
     IF v_blood_group NOT IN ('A+','A-','B+','B-','AB+','AB-','O+','O-') THEN v_blood_group := 'O+'; END IF;

     INSERT INTO public.profiles (
       id, full_name, email, phone, student_id, department_id, batch, role, is_active, privacy_policy_accepted_at
     )
     VALUES (
       v_user.id, left(v_full_name, 120), v_user.email, v_phone, v_student_id, v_dept_id, left(v_batch, 32), 'super_admin', true, now()
     )
     ON CONFLICT (id) DO UPDATE
     SET role = 'super_admin',
         is_active = true;

     GET DIAGNOSTICS v_updated_count = ROW_COUNT;
     IF v_updated_count <> 1 THEN
       RAISE EXCEPTION 'Bootstrap aborted: Expected 1 profile updated, affected %.', v_updated_count;
     END IF;

     INSERT INTO public.donor_details (user_id, blood_group, verification_status)
     VALUES (v_user.id, v_blood_group, 'approved')
     ON CONFLICT (user_id) DO UPDATE
     SET verification_status = 'approved';

     UPDATE public.verification_requests
     SET status = 'approved',
         reviewed_by = v_user.id,
         review_notes = 'Verified during Super Admin bootstrap',
         reviewed_at = now()
     WHERE user_id = v_user.id AND status = 'pending';

     INSERT INTO public.admin_logs (actor_id, action, target_table, target_id, details)
     VALUES (v_user.id, 'bootstrap_super_admin', 'profiles', v_user.id::text, jsonb_build_object('email', v_user.email));

     RAISE NOTICE 'Super Admin bootstrap succeeded for % (id: %).', v_user.email, v_user.id;
   END;
   $$;
   ```
3. Sign out and sign back in. You can now access `/admin` and assign/remove `moderator` roles from the **Users & Roles** tab.

---

## 12. Local Development Commands

```bash
# Run development server on http://localhost:3000
npm run dev

# Type-check with TypeScript
npm run lint

# Run pure logic unit tests
npx --yes tsx --test src/utils/bloodCompatibility.test.ts src/utils/validation.test.ts

# Build for production
npm run build
```

---

## 13. GitHub Upload Instructions

```bash
git init
git add .
git commit -m "Initial commit: Campus Blood Connect for Netrokona University"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/campus-blood-connect.git
git push -u origin main
```

---

## 14. Vercel Deployment Instructions

1. Go to [Vercel](https://vercel.com) and click **Add New → Project**.
2. Import your GitHub repository (`campus-blood-connect`).
3. Keep Framework Preset as **Vite** (`Build Command: npm run build`, `Output Directory: dist`).
4. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL` = your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon/publishable key
   - `VITE_UNIVERSITY_EMAIL_DOMAIN` = `neu.ac.bd`
5. Click **Deploy**. `vercel.json` is already configured to rewrite all routes to `/index.html` for React Router SPA navigation.
6. Finally, add your deployed `https://your-project.vercel.app/**` URL to **Supabase Authentication → URL Configuration → Redirect URLs** (authentication redirects automatically resolve via `window.location.origin`).
