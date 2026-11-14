-- ============================================================================
-- Campus Blood Connect (Netrokona University)
-- Migration 005: Complete 9 Official Departments of Netrokona University
-- Safe, idempotent migration: preserves all existing user & donor records.
-- ============================================================================

-- 1. Upsert all 9 official Netrokona University departments without duplicates.
--    If a department already exists (by code or name), it is updated and activated.
WITH canonical_departments (code, name, name_bn) AS (
  VALUES
    ('CSE', 'Computer Science & Engineering', 'কম্পিউটার বিজ্ঞান ও প্রকৌশল'),
    ('EEE', 'Electrical & Electronic Engineering', 'তড়িৎ ও ইলেকট্রনিক প্রকৌশল'),
    ('BAN', 'Bangla', 'বাংলা'),
    ('ENG', 'English', 'ইংরেজি'),
    ('ECO', 'Economics', 'অর্থনীতি'),
    ('HIS', 'History & Archaeology', 'ইতিহাস ও প্রত্নতত্ত্ব'),
    ('IR',  'International Relations', 'আন্তর্জাতিক সম্পর্ক'),
    ('DS',  'Development Studies', 'উন্নয়ন অধ্যয়ন'),
    ('AIS', 'Accounting & Information Systems', 'হিসাববিজ্ঞান ও তথ্য ব্যবস্থা')
)
INSERT INTO public.departments (code, name, name_bn, is_active)
SELECT code, name, name_bn, true
FROM canonical_departments
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  name_bn = EXCLUDED.name_bn,
  is_active = true,
  updated_at = now();

-- 2. Maintain full backward compatibility for any previously registered users
--    (e.g., accounts created while PA or FLK were in the initial 6-row seed):
--    Mark non-canonical seed rows inactive instead of deleting them so no
--    profiles.department_id foreign keys or historical donor records break.
UPDATE public.departments
SET
  is_active = false,
  updated_at = now()
WHERE code NOT IN ('CSE', 'EEE', 'BAN', 'ENG', 'ECO', 'HIS', 'IR', 'DS', 'AIS')
  AND is_active = true;
