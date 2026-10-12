/** "Sri Lakshmi Jewellers" -> "sri-lakshmi-jewellers" */
export const slugify = (value: string, max = 63) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/, '')
