/** Form rules shared by the sign-in, sign-up and password screens. They mirror the API's own
 * checks, which stay the authority; these only give feedback before a request is sent. */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MOBILE = /^[6-9]\d{9}$/

export const normaliseEmail = (v: string) => v.trim().toLowerCase()

export function emailError(v: string): string | null {
  if (!v.trim()) return 'Enter your email address'
  return EMAIL.test(v.trim()) ? null : 'Enter a valid email address'
}

export function mobileError(v: string): string | null {
  if (!v) return 'Enter your mobile number'
  return MOBILE.test(v) ? null : 'Enter a valid 10-digit mobile number'
}

export function nameError(v: string): string | null {
  return v.trim().length >= 2 ? null : 'Enter your full name'
}

/** The API's policy: 8 to 128 characters with at least one letter and one digit. */
export function passwordError(v: string): string | null {
  if (v.length < 8) return 'Use at least 8 characters'
  if (v.length > 128) return 'Use at most 128 characters'
  if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return 'Include at least one letter and one number'
  return null
}

export function confirmError(password: string, confirm: string): string | null {
  if (!confirm) return 'Enter the password again'
  return confirm === password ? null : 'The passwords do not match'
}

/** 0 (empty) to 4 (strong), for the meter under a new password. */
export function passwordStrength(v: string): 0 | 1 | 2 | 3 | 4 {
  if (!v) return 0
  let score = 0
  if (v.length >= 8) score++
  if (v.length >= 12) score++
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) score++
  if (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)) score++
  if (passwordError(v)) return 1
  return Math.max(2, Math.min(4, score)) as 2 | 3 | 4
}

export const STRENGTH_LABEL = ['', 'Too weak', 'Fair', 'Good', 'Strong'] as const
