/** Short names for the API's types. Regenerate with `npm run api:types -w @digigold/web-common`. */
import type { components } from '@digigold/web-common/api/schema'

type S = components['schemas']

export type Page<T> = { items: T[]; total: number; limit: number; offset: number }
export type PageParams = { limit?: number; offset?: number }

export type TokensOut = S['TokensOut']
export type PasswordChangeRequired = S['PasswordChangeRequiredOut']
export type Me = S['app__api__auth__MeOut']

export type Tenant = S['TenantOut']
export type TenantCreate = S['TenantCreate']
export type TenantUpdate = S['TenantUpdate']
export type Branding = S['Branding']
export type Features = S['Features']

export type WebsiteSettings = S['WebsiteSettings']
export type SitePageSummary = S['PageSummary']
export type SitePage = S['PageOut']
export type SitePageCreate = S['PageCreate']
export type SitePageUpdate = S['PageUpdate']
export type PageContent = S['PageContent']
export type Section = NonNullable<PageContent['sections']>[number]
export type SectionType = Section['type']
export type MediaAsset = S['MediaOut']
