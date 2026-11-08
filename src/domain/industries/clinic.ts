import type { CompiledConfig, CompiledQuestion, ConversationState } from '../types.js';
import type { IndustryHooks } from './types.js';

/**
 * Appointment booking for a dental clinic. The questions are linear: permission, the
 * kind of visit, new or existing patient, how soon, preferred time of day,
 * how they will pay, and whether to pick a slot now. Accepting the last one
 * offers real slots through the same appointment flow real estate uses for
 * site visits, so scoring, routing and the coordinator's notification run as
 * they do there.
 */

const PAUSE_ANSWERS = ['no', 'not now', 'مش دلوقتي'];
const BOOK_ACCEPTED = ['yes', 'نعم', 'أيوه', 'ايوه'];

function saveAnswer(state: ConversationState, question: CompiledQuestion, value: string): Record<string, string> {
  const answers = { ...state.answers };
  if (question.saveKey && question.saveKey !== 'q_permission') answers[question.saveKey] = value;
  return answers;
}

function qualificationPayload(answers: Record<string, string>): Record<string, string> {
  const payload: Record<string, string> = {
    service: answers.q_service || '',
    patient_type: answers.q_patient_type || '',
    urgency: answers.q_urgency || '',
    time_preference: answers.q_time_pref || '',
    coverage: answers.q_coverage || '',
    book_now: answers.q_book_now || '',
    notes: answers.qualification_notes || '',
  };
  const consumed = new Set([
    'q_service', 'q_patient_type', 'q_urgency', 'q_time_pref', 'q_coverage', 'q_book_now', 'qualification_notes',
  ]);
  for (const [key, value] of Object.entries(answers)) {
    if (!consumed.has(key)) payload[key.replace(/^q_/, '')] = value;
  }
  return payload;
}

function nextQuestionAfter(config: CompiledConfig, question: CompiledQuestion): CompiledQuestion | undefined {
  const index = config.questions.findIndex((candidate) => candidate.questionKey === question.questionKey);
  return index >= 0 ? config.questions[index + 1] : undefined;
}

export const clinicHooks: IndustryHooks = {
  // A patient who writes again after finishing goes to a person, as in real estate.
  startsNewRequest: () => false,
  saveAnswer,
  qualificationPayload,
  nextQuestionAfter,
  isPauseAnswer: (question, lowerValue) => question.saveKey === 'q_permission' && PAUSE_ANSWERS.includes(lowerValue),
  offersAppointment: (question, value) =>
    question.saveKey === 'q_book_now' && BOOK_ACCEPTED.includes(value.trim().toLocaleLowerCase()),
};
