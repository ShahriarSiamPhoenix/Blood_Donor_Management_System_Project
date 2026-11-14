import test from 'node:test';
import assert from 'node:assert/strict';
import { formatAuthErrorMessage } from './authErrors';

test('formatAuthErrorMessage formats Supabase email rate limit errors clearly', () => {
  const msg1 = formatAuthErrorMessage({
    message: 'Email rate limit exceeded',
    code: 'over_email_send_rate_limit',
    status: 429,
  });
  assert.ok(msg1 && msg1.includes('Email sending limit reached'));
  assert.ok(msg1.includes('Custom SMTP'));

  const msg2 = formatAuthErrorMessage({
    message: 'For security purposes, you can only request this after 45 seconds.',
    status: 429,
  });
  assert.ok(msg2 && msg2.includes('Email sending limit reached'));
});

test('formatAuthErrorMessage formats duplicate student ID / user errors clearly', () => {
  const dupEmail = formatAuthErrorMessage({
    message: 'User already registered',
    code: 'user_already_exists',
  });
  assert.ok(dupEmail && dupEmail.includes('already registered'));

  const dupStudent = formatAuthErrorMessage({
    message: 'Database error saving new user',
  });
  assert.ok(dupStudent && dupStudent.includes('Student ID'));
});

test('formatAuthErrorMessage passes through unknown messages and handles null', () => {
  assert.equal(formatAuthErrorMessage(null), null);
  assert.equal(
    formatAuthErrorMessage({ message: 'Unexpected network timeout' }),
    'Unexpected network timeout'
  );
});
