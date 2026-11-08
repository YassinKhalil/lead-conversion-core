import { clinicHooks } from './clinic.js';
import { hospitalityHooks } from './hospitality.js';
import { realEstateHooks } from './real-estate.js';
import type { IndustryHooks } from './types.js';

export type { IndustryHooks } from './types.js';

/** Any industry other than hospitality and clinic runs the real-estate flow, as before. */
export function industryHooks(industry: string): IndustryHooks {
  if (industry === 'hospitality') return hospitalityHooks;
  if (industry === 'clinic') return clinicHooks;
  return realEstateHooks;
}
