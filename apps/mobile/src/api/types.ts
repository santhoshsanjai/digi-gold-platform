/** Short names for the API's types. Regenerate with `npm run api:types`. */
import type { components } from './schema'

type S = components['schemas']

export type Page<T> = { items: T[]; total: number; limit: number; offset: number }

export type Tokens = S['CustomerTokensOut']
export type PublicConfig = S['PublicConfig']
export type Branding = S['Branding']
export type Me = S['app__api__app_gold__MeOut']
export type Rate = S['app__api__app_gold__RateOut']
export type Order = S['OrderOut']
export type Lot = S['LotOut']
export type LedgerEntry = S['LedgerOut']
export type RedemptionCode = S['RedemptionCodeOut']
