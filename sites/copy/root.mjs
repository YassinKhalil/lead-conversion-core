import { NO_GENERATIVE_LINE, VERTICALS } from "./shared.mjs";

export default {
  id: "root",
  lang: "en",
  title: "Kadensio | A conversation engine that cannot make things up",
  description:
    "Deterministic state machines on official WhatsApp and voice channels, with fixed arithmetic scoring. Built for real estate brokerages, hospitality groups and clinics.",
  nav: [
    { label: "Try it", href: "#try" },
    { label: "Architecture", href: "#architecture" },
    { label: "Guarantees", href: "#guarantees" },
    { label: "Verticals", href: "#verticals" },
  ],
  // The interactive demo: pick an industry, run the real questions on sample data.
  demo: {
    id: "try",
    h2: "Try it now. Pick your industry.",
    lead: "Choose real estate, hospitality or a dental clinic and answer the way a buyer, a guest or a patient would. It asks the same questions it asks on WhatsApp, then shows what your team receives.",
    pickLabel: "Choose an industry to start",
    verticals: [
      {
        id: "real-estate",
        endpoint: "/api/demo/real-estate",
        venue: "Palm Heights Estates",
        start: "Real estate",
        resultHeading: "What your agent receives",
        empty: "Finish the questions and the card appears here: temperature, score, the answers and the reason for each point.",
      },
      {
        id: "hospitality",
        endpoint: "/api/demo/hospitality",
        venue: "Cal Gràcia",
        start: "Hospitality",
        resultHeading: "What your host receives",
        empty: "Finish the reservation and the booking appears here: party size, date, shift, zone and whether the venue needs to confirm it.",
      },
      {
        id: "clinic",
        endpoint: "/api/demo/clinic",
        venue: "Nile Smile Dental",
        start: "Dental clinic",
        resultHeading: "What your front desk receives",
        empty: "Finish the booking and the card appears here: the booking priority, the answers, the slot the patient picked and the suggested next step.",
      },
    ],
    threadLabel: "Conversation with the Kadensio assistant",
    inputLabel: "Your answer",
    placeholder: "Type your answer",
    send: "Send",
    whyLabel: "Why this score",
    nextLabel: "Suggested next step.",
    again: "Run it again",
    note: "Sample data throughout. Real estate scoring is a fixed set of rules. In hospitality the demo uses a sample floor plan that always has room, while live bookings are checked against yours first. In the clinic demo the slots are samples and the priority only orders a queue: it is not a clinical assessment. Nothing from this demo is stored or sent to anyone.",
  },
  hero: {
    eyebrow: "Conversation infrastructure",
    h1: "A conversation engine that cannot make things up.",
    lead:
      "Deterministic state machines on official WhatsApp and voice channels. Fixed arithmetic scoring. " +
      "Nothing in the loop writes its own answers.",
    gatewayHeading: "Choose your industry",
    proof: ["Official Meta WhatsApp Business Platform", "Auditable scores", "Fastest verified run: 30 seconds"],
  },
  architecture: {
    id: "architecture",
    eyebrow: "Architecture",
    h2: "One engine. Six stages.",
    lead: "Every conversation moves through the same pipeline, whatever the industry.",
    steps: [
      ["Channel adapter", "Official WhatsApp Business Platform and dedicated voice trunks."],
      ["State machine", "A finite set of states. Each reply is a fixed template."],
      ["Scorer", "Weighted arithmetic out of 100. Same input, same score."],
      ["Router", "Sends the conversation to the matching person or team."],
      ["Integrations", "Calendar and booking systems, written to directly."],
      ["Shared inbox", "A human takes over any conversation in one tap."],
    ],
  },
  guarantees: {
    id: "guarantees",
    eyebrow: "Guarantees",
    h2: "What the engine will not do.",
    rows: [
      ["Invent data", "A price, a payment plan, a unit or a table slot is read from your inventory. One that does not exist cannot be sent."],
      ["Use unofficial routes", "Official APIs only. That removes the ban risk that unofficial WhatsApp automation puts on your main number."],
      ["Hide how a score is worked out", "Every score has an audit log: the inputs, the weights and the result."],
      ["Use a generative model", NO_GENERATIVE_LINE],
    ],
  },
  verticals: {
    id: "verticals",
    eyebrow: "Verticals",
    h2: "One primitive, three presentations.",
    lead: "The same engine runs all three. Only the vocabulary and the integrations change.",
    caption: "How the shared primitives appear in each vertical",
    head: ["Primitive", "Real Estate", "Hospitality", "Dental Clinics"],
    rows: [
      ["Entity", "Lead", "Guest", "Patient"],
      ["Outcome", "Viewing", "Reservation", "Appointment"],
      ["Key variables", "Budget, unit type", "Party size, zone", "Treatment, how soon"],
      ["Scheduler", "Google Calendar", "CoverManager / floor plan", "The clinic's own hours"],
      ["Inbox", "Team inbox", "Host dashboard", "Front desk dashboard"],
    ],
    cta: VERTICALS,
  },
  footer: {
    meta: "Conversation infrastructure for real estate, hospitality and clinics.",
    legal: [
      ["Privacy Policy", "https://kadensio.com/privacy.html"],
      ["Terms of Service", "https://kadensio.com/terms.html"],
      ["Data Processing Addendum", "https://kadensio.com/dpa.html"],
    ],
  },
};
