/** A WhatsApp chat link for a phone number in any format, or '' when there is none. */
export const waLink = (n: string) => {
  const digits = n.replace(/\D/g, '')
  return digits ? `https://wa.me/${digits}` : ''
}

export const telLink = (phone: string) => `tel:${phone.replace(/\s/g, '')}`
