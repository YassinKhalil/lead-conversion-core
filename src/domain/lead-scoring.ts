import { createHash } from 'node:crypto';

export const REAL_ESTATE_SCORING_VERSION = 'real_estate_v1';

export interface LeadScoringInput {
  leadStatus: string;
  currentStage: string;
  answers: Record<string, string>;
}

export interface LeadScoreFactor {
  key: string;
  points: number;
  value: string;
  reason: string;
}

export interface LeadScoreResult {
  scoringVersion: string;
  score: number;
  temperature: 'cold' | 'warm' | 'hot';
  inputHash: string;
  missingAnswers: string[];
  factors: LeadScoreFactor[];
  sourceSnapshot: LeadScoringInput;
}

const REQUIRED_ANSWERS = [
  'q_location',
  'q_unit_type',
  'q_budget_min',
  'q_budget_max',
  'q_payment_plan',
  'q_down_payment',
  'q_timeline',
  'q_purpose',
  'q_site_visit',
];

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function text(input: Record<string, string>, key: string): string {
  return String(input[key] || '').trim();
}

function numberValue(value: string): number {
  const cleaned = value.replace(/[^\d.]/g, '');
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function add(factors: LeadScoreFactor[], key: string, points: number, value: string, reason: string): void {
  factors.push({ key, points, value, reason });
}

function budgetPoints(maxBudget: number): number {
  if (maxBudget >= 10_000_000) return 25;
  if (maxBudget >= 5_000_000) return 20;
  if (maxBudget >= 3_000_000) return 14;
  if (maxBudget > 0) return 8;
  return 0;
}

function timelinePoints(value: string): number {
  const normalized = value.toLocaleLowerCase();
  if (normalized.includes('immediate') || normalized.includes('as soon')) return 20;
  if (normalized.includes('3')) return 16;
  if (normalized.includes('6')) return 10;
  if (normalized.includes('explor')) return 2;
  return 0;
}

function paymentPlanPoints(value: string): number {
  const normalized = value.toLocaleLowerCase();
  if (normalized === 'cash') return 12;
  if (normalized === 'flexible') return 8;
  if (normalized === 'installments') return 6;
  return 0;
}

function purposePoints(value: string): number {
  const normalized = value.toLocaleLowerCase();
  if (normalized === 'both') return 8;
  if (normalized === 'investment') return 8;
  if (normalized.includes('residence')) return 5;
  return 0;
}

function unitTypePoints(value: string): number {
  const normalized = value.toLocaleLowerCase();
  if (['villa', 'townhouse', 'commercial'].includes(normalized)) return 6;
  if (normalized === 'apartment') return 4;
  return value ? 3 : 0;
}

export function temperature(score: number): 'cold' | 'warm' | 'hot' {
  if (score >= 75) return 'hot';
  if (score >= 45) return 'warm';
  return 'cold';
}

export function scoreRealEstateLead(input: LeadScoringInput): LeadScoreResult {
  const answers = { ...input.answers };
  const factors: LeadScoreFactor[] = [];
  const missingAnswers = REQUIRED_ANSWERS.filter((key) => !text(answers, key));

  add(factors, 'base', 10, 'real_estate', 'Baseline score for a qualified real estate lead');

  const budgetMax = numberValue(text(answers, 'q_budget_max'));
  add(factors, 'budget', budgetPoints(budgetMax), text(answers, 'q_budget_max'), 'Higher declared budget increases urgency and routing priority');

  const timeline = text(answers, 'q_timeline');
  add(factors, 'timeline', timelinePoints(timeline), timeline, 'Near-term purchase timeline increases priority');

  const siteVisit = text(answers, 'q_site_visit');
  add(factors, 'site_visit', siteVisit.toLocaleLowerCase() === 'yes' ? 20 : 0, siteVisit, 'Site visit intent is a strong buying signal');

  const paymentPlan = text(answers, 'q_payment_plan');
  add(factors, 'payment_plan', paymentPlanPoints(paymentPlan), paymentPlan, 'Cash or flexible payment preference improves conversion readiness');

  const budgetMin = numberValue(text(answers, 'q_budget_min'));
  const downPayment = numberValue(text(answers, 'q_down_payment'));
  const downPaymentRatio = budgetMin > 0 ? downPayment / budgetMin : 0;
  const downPaymentPoints = downPaymentRatio >= 0.2 ? 12 : downPaymentRatio >= 0.1 ? 8 : downPayment > 0 ? 4 : 0;
  add(factors, 'down_payment', downPaymentPoints, text(answers, 'q_down_payment'), 'Down-payment capacity reduces financing risk');

  const purpose = text(answers, 'q_purpose');
  add(factors, 'purpose', purposePoints(purpose), purpose, 'Investment or dual-purpose buyers get modest priority');

  const unitType = text(answers, 'q_unit_type');
  add(factors, 'unit_type', unitTypePoints(unitType), unitType, 'Unit type contributes modest routing priority');

  const location = text(answers, 'q_location');
  add(factors, 'location_present', location ? 5 : 0, location ? 'present' : '', 'Known preferred location improves salesperson matching');

  add(
    factors,
    'qualified_state',
    input.leadStatus === 'qualified' || input.currentStage === 'qualified' ? 5 : 0,
    `${input.leadStatus}:${input.currentStage}`,
    'Completed qualification state is required before high-confidence routing',
  );

  const rawScore = factors.reduce((total, factor) => total + factor.points, 0);
  const score = Math.max(0, Math.min(100, rawScore));
  const sourceSnapshot: LeadScoringInput = {
    leadStatus: input.leadStatus,
    currentStage: input.currentStage,
    answers,
  };
  return {
    scoringVersion: REAL_ESTATE_SCORING_VERSION,
    score,
    temperature: temperature(score),
    inputHash: sha256Hex(stableJson({ scoringVersion: REAL_ESTATE_SCORING_VERSION, sourceSnapshot })),
    missingAnswers,
    factors,
    sourceSnapshot,
  };
}
