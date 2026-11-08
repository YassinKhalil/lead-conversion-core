import { realEstate } from '../profile/real-estate';
import type { TenantProfile } from '../profile/types';

/**
 * Labels come from the tenant profile. Every function takes the profile last
 * and defaults to real estate, so a caller that has not been given one (and the
 * tests that predate profiles) gets the labels the app always had.
 */

/** Question keys are stable identifiers from the conversation configuration. */
export function questionLabel(key: string, profile: TenantProfile = realEstate): string {
  return profile.questionLabels[key] ?? humanise(key.replace(/^q_/, ''));
}

/** A stored answer value in words, when the profile has words for it; otherwise the value as stored. */
export function valueLabel(key: string, value: string, profile: TenantProfile = realEstate): string {
  return profile.valueLabels?.[key]?.[value] ?? value;
}

export function factorLabel(key: string, profile: TenantProfile = realEstate): string {
  return profile.factorLabels[key] ?? humanise(key);
}

export function eventLabel(eventType: string, profile: TenantProfile = realEstate): string {
  return profile.eventLabels[eventType] ?? humanise(eventType.replace(/^[a-z]+\./, ''));
}

/** The pipeline stages accepted by PATCH /api/leads/:id/stage, in order. */
export const PIPELINE_STAGES = [
  'new',
  'in_progress',
  'site_visit_scheduled',
  'closed_won',
  'closed_lost',
  'ghosted',
] as const;

export function stageLabel(stage: string | null | undefined, profile: TenantProfile = realEstate): string {
  // A lead from an API build before pipeline_stage existed, or from a cached
  // response persisted before it, has no stage. Read it as the default rather
  // than throwing inside humanise.
  if (typeof stage !== 'string' || stage === '') return profile.stageLabels.new ?? 'New';
  return profile.stageLabels[stage] ?? humanise(stage);
}

/** Outbound delivery state, phrased the way a salesperson would read it. */
export function deliveryLabel(state: string): string {
  switch (state) {
    case 'queued':
      return 'Queued';
    case 'requested':
      return 'Queued';
    case 'processing':
      return 'Sending';
    case 'accepted':
      return 'Sent';
    case 'sent':
      return 'Sent';
    case 'delivered':
      return 'Delivered';
    case 'read':
      return 'Read';
    case 'failed':
      return 'Failed';
    case 'delivery_unknown':
      return 'Unconfirmed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return humanise(state);
  }
}

function humanise(value: string): string {
  const spaced = value.replace(/[_.]/g, ' ').trim();
  return spaced.length === 0 ? value : spaced[0]!.toUpperCase() + spaced.slice(1);
}
