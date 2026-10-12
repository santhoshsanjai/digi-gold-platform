import type { Rule } from 'antd/es/form'

/** Mirrors the API's password policy so mistakes show before submitting. */
export const passwordRules: Rule[] = [
  { min: 8, message: 'Use at least 8 characters' },
  { max: 128, message: 'Use at most 128 characters' },
  {
    pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/,
    message: 'Include at least one letter and one number',
  },
]

export const confirmPasswordRules = (field = 'new_password'): Rule[] => [
  { required: true, message: 'Confirm the new password' },
  ({ getFieldValue }) => ({
    validator: (_, value) =>
      !value || getFieldValue(field) === value
        ? Promise.resolve()
        : Promise.reject(new Error('The passwords do not match')),
  }),
]

export const indianPhoneRule: Rule = {
  pattern: /^(\+91[\s-]?)?[6-9]\d{9}$/,
  message: 'Enter a 10-digit mobile number',
}
