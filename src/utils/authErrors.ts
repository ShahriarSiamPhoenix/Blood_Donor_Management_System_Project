export interface AuthErrorLike {
  message?: string;
  code?: string;
  status?: number;
}

/**
 * Maps raw Supabase Auth error payloads into clear, actionable user-facing messages.
 */
export function formatAuthErrorMessage(error: AuthErrorLike | null | undefined): string | null {
  if (!error) return null;

  const rawMessage = (error.message || '').trim();
  const normalized = rawMessage.toLowerCase();
  const code = (error.code || '').toLowerCase();

  if (
    error.status === 429 ||
    code === 'over_email_send_rate_limit' ||
    code === 'over_request_rate_limit' ||
    normalized.includes('rate limit') ||
    normalized.includes('too many requests')
  ) {
    return 'Email sending limit reached on the authentication server (Supabase default email allows only 2–3 emails per hour). Wait and retry later, or configure Custom SMTP / turn off "Confirm email" in Supabase Authentication settings.';
  }

  if (
    code === 'user_already_exists' ||
    normalized.includes('already registered') ||
    normalized.includes('already exists')
  ) {
    return 'An account with this email address is already registered. Please sign in instead.';
  }

  if (normalized.includes('database error saving new user')) {
    return 'Unable to create your profile. This Student ID or email may already be registered.';
  }

  if (code === 'email_not_confirmed' || normalized.includes('email not confirmed')) {
    return 'Your email is not confirmed yet. Check your inbox for the verification link before signing in.';
  }

  if (code === 'invalid_credentials' || normalized.includes('invalid login credentials')) {
    return 'Incorrect email or password. Please check your credentials and try again.';
  }

  return rawMessage || 'Authentication request failed. Please try again.';
}
