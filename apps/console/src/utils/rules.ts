import type { Rule } from 'antd/es/form'

/** Same pattern as the API's page slug. */
export const pageSlugRule: Rule = {
  pattern: /^(?:home|[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?)$/,
  message: 'Lowercase letters, numbers and hyphens',
}

/** Links the API accepts in website content. */
export const linkRule: Rule = {
  pattern: /^(?:$|https?:\/\/|\/|#|mailto:|tel:)/,
  message: 'Start with https://, / for a page on this site, #, mailto: or tel:',
}
