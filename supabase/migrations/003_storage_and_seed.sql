-- ============================================================================
-- Campus Blood Connect (Netrokona University)
-- Migration 003: Storage Buckets, Policies, and Initial Reference Seed Data
-- ============================================================================

-- 1. Storage Buckets (avatars: public read; verification-docs: private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('verification-docs', 'verification-docs', false, 5242880, ARRAY['image/jpeg', 'image/png', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS for avatars
DROP POLICY IF EXISTS "Public avatar read" ON storage.objects;
CREATE POLICY "Public avatar read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
CREATE POLICY "Users upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users update/delete own avatar" ON storage.objects;
CREATE POLICY "Users update/delete own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage RLS for verification-docs (only owner & moderators/admins)
DROP POLICY IF EXISTS "Owner or staff read verification docs" ON storage.objects;
CREATE POLICY "Owner or staff read verification docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'verification-docs'
    AND auth.uid() IS NOT NULL
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_moderator_or_admin()
    )
  );

DROP POLICY IF EXISTS "Users upload own verification docs" ON storage.objects;
CREATE POLICY "Users upload own verification docs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'verification-docs'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2. Netrokona University Departments (all 9 official departments)
INSERT INTO public.departments (code, name, name_bn, is_active) VALUES
  ('CSE', 'Computer Science & Engineering', 'কম্পিউটার বিজ্ঞান ও প্রকৌশল', true),
  ('EEE', 'Electrical & Electronic Engineering', 'তড়িৎ ও ইলেকট্রনিক প্রকৌশল', true),
  ('BAN', 'Bangla', 'বাংলা', true),
  ('ENG', 'English', 'ইংরেজি', true),
  ('ECO', 'Economics', 'অর্থনীতি', true),
  ('HIS', 'History & Archaeology', 'ইতিহাস ও প্রত্নতত্ত্ব', true),
  ('IR',  'International Relations', 'আন্তর্জাতিক সম্পর্ক', true),
  ('DS',  'Development Studies', 'উন্নয়ন অধ্যয়ন', true),
  ('AIS', 'Accounting & Information Systems', 'হিসাববিজ্ঞান ও তথ্য ব্যবস্থা', true)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  name_bn = EXCLUDED.name_bn,
  is_active = true;

-- 3. Default Platform Settings
INSERT INTO public.platform_settings (key, value, description, is_public) VALUES
  (
    'university_email_config',
    '{"allowed_domains": ["neu.ac.bd", "student.neu.ac.bd"], "enforce_domain": false}'::jsonb,
    'Configurable university email domain validation rules.',
    true
  ),
  (
    'donation_policy',
    '{"min_interval_days": 90, "max_bags_per_request": 10}'::jsonb,
    'Minimum days between whole blood donations (displayed as informational guidance only).',
    true
  ),
  (
    'campus_contact',
    '{"organization": "Netrokona University Blood Connect", "campus": "Netrokona University, Netrokona-2400, Bangladesh", "email": "bloodconnect@neu.ac.bd", "helpline": "Campus Medical Desk · Available 24/7 for Verified Emergencies"}'::jsonb,
    'Official campus blood network contact metadata.',
    true
  )
ON CONFLICT (key) DO NOTHING;

-- 4. Optional pg_cron schedule for automatic request expiration (enable pg_cron in Supabase Extensions first)
-- SELECT cron.schedule('expire-blood-requests-hourly', '0 * * * *', $$SELECT public.expire_past_due_blood_requests();$$);
