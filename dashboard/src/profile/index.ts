import { clinic } from './clinic';
import { hospitality } from './hospitality';
import { realEstate } from './real-estate';
import type { TenantProfile, VerticalId } from './types';

export type { FactSpec, ListCopy, ManageCopy, SummaryPart, TenantProfile, Terms, VerticalId } from './types';
export { clinic, hospitality, realEstate };

export const PROFILES: Record<VerticalId, TenantProfile> = {
  real_estate: realEstate,
  hospitality,
  clinic,
};

export const DEFAULT_VERTICAL: VerticalId = 'real_estate';

/**
 * Which vertical a tenant is in, by `clientKey`. Frontend configuration: the
 * backend does not carry a vertical and is not changed to. A tenant not listed
 * here is real estate, which is every tenant today.
 *
 * To put a tenant on the hospitality view: add its clientKey here and ship.
 */
export const CLIENT_VERTICALS: Record<string, VerticalId> = {};

export function isVertical(value: unknown): value is VerticalId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PROFILES, value);
}

export interface ProfileInput {
  clientKey?: string | null;
  /** Reserved. A future API may send this; today it is absent, and the registry decides. */
  vertical?: string | null;
}

/**
 * Order: an explicit override (preview builds only), a vertical the API sent,
 * the registry, then real estate. An unknown value never throws, it falls
 * through, so a bad config cannot blank the dashboard.
 */
export function resolveProfile(input: ProfileInput | null | undefined, override?: string | null): TenantProfile {
  if (isVertical(override)) return PROFILES[override];
  if (isVertical(input?.vertical)) return PROFILES[input.vertical];
  const fromRegistry = input?.clientKey ? CLIENT_VERTICALS[input.clientKey] : undefined;
  if (isVertical(fromRegistry)) return PROFILES[fromRegistry];
  return PROFILES[DEFAULT_VERTICAL];
}
