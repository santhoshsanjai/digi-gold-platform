/** Short names for the API's types. schema.d.ts is generated: run `npm run api:types`. */
import type { components } from './schema'

type S = components['schemas']

export type Page<T> = { items: T[]; total: number; limit: number; offset: number }
export type PageParams = { limit?: number; offset?: number }

export type PublicConfig = S['PublicConfig']
export type Branding = S['Branding']
export type Features = S['Features']
export type TokensOut = S['TokensOut']
export type PasswordChangeRequired = S['PasswordChangeRequiredOut']
export type Me = S['app__api__auth__MeOut']
export type MenuItem = S['MenuItemOut']

export type SchemeSettings = S['SchemeSettings-Output']
export type SchemeSettingsIn = S['SchemeSettings-Input']

export type StaffUser = S['UserOut']
export type StaffUserCreate = S['UserCreate']
export type StaffUserUpdate = S['UserUpdate']
export type Role = S['RoleOut']
export type RoleIn = S['RoleIn']
export type RoleUpdate = S['RoleUpdate']
export type PermissionCatalogue = S['CatalogueOut']
export type Store = S['StoreOut']
export type StoreIn = S['StoreIn']
export type StoreUpdate = S['StoreUpdate']
export type AuditEntry = S['AuditOut']

export type Purity = S['RateIn']['purity']
export type GoldRate = S['app__api__crm_rates__RateOut']
export type CurrentRates = S['CurrentRatesOut']
export type RateIn = S['RateIn']

export type Customer = S['CustomerOut']
export type CustomerDetail = S['CustomerDetailOut']
export type Lot = S['LotOut']
export type LedgerEntry = S['LedgerOut']
export type Payment = S['PaymentOut']
export type PaymentStatus = 'created' | 'pending' | 'paid' | 'failed'

export type Redemption = S['RedemptionOut']
export type RedeemIn = S['RedeemIn']
export type RedemptionSlip = S['SlipOut']
export type ExpiringLot = S['ExpiringLotOut']
export type Dashboard = S['DashboardOut']
