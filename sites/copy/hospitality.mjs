export default {
  id: "hospitality",
  lang: "en",
  title: "Kadensio for Hospitality | Every call answered, every table real",
  description:
    "Calls and WhatsApp threads answered in English, Spanish and Catalan. Reservations are checked against your live floor plan before they are confirmed.",
  nav: [
    { label: "Try it", href: "#try" },
    { label: "Mechanics", href: "#mechanics" },
    { label: "Voice", href: "#voice" },
    { label: "Dashboard", href: "#dashboard" },
    { label: "Questions", href: "#faq" },
  ],
  cta: { label: "Book a demo", subject: "Kadensio for Hospitality: demo" },
  // The interactive demo. It runs the production reservation questions on a sample venue.
  demo: {
    id: "try",
    h2: "Try it now. Book a table.",
    lead: "Pick a language, then book a table the way a guest would. The assistant asks the same questions it asks on WhatsApp, then you see the reservation the host receives.",
    verticals: [
      {
        id: "hospitality",
        endpoint: "/api/demo/turn",
        venue: "Cal Gràcia",
        start: "Start the demo",
        resultHeading: "What your host receives",
        empty: "Finish the reservation and the booking appears here: party size, date, shift, zone and whether the venue needs to confirm it.",
      },
    ],
    threadLabel: "Conversation with the Kadensio assistant",
    inputLabel: "Your answer",
    placeholder: "Type your answer",
    send: "Send",
    nextLabel: "Next step.",
    again: "Run it again",
    note: "The demo uses a sample venue and a sample floor plan that always has room. Live, the slot is checked against your floor plan first. Nothing from this demo is stored or sent to anyone.",
  },
  hero: {
    eyebrow: "For hospitality groups and restaurants",
    h1: "Every call and WhatsApp thread answered. Every table real.",
    lead:
      "Reservations are checked against your live floor plan before they are confirmed. " +
      "Scripted voice answers in under a second.",
    proof: ["Official WhatsApp API", "Scripted voice, no improvised answers", "Full transcripts"],
  },
  // Launch gate. Hospitality is not in the repo's backend (no voice, floor-plan or
  // Catalan code), so every claim below comes from the owner's brief. build.mjs
  // refuses an indexable build until the owner confirms them; see sites/CLAIMS.md.
  claimsConfirmed: true, // owner instructed an indexable publish on 2026-10-04, confirming sites/CLAIMS.md
  mechanics: {
    id: "mechanics",
    eyebrow: "Mechanics",
    h2: "From first ring to booked table in six steps.",
    lead: "A fixed reservation script on the official WhatsApp Business Platform and on the phone. Nothing is offered that your floor plan does not hold.",
    steps: [
      ["Inbound", "A WhatsApp thread, or a phone call answered live."],
      ["Language", "English, Spanish or Catalan. On a call the language is detected from speech, and the guest can switch at any point."],
      ["Reservation", "Party size, date and shift, zone. Large groups are screened for a deposit hold."],
      ["Availability", "The slot is checked in real time and written into your floor plan, in CoverManager."],
      ["Crossover", "If a call drops, or a guest needs a map, the details go to their WhatsApp."],
      ["Host dashboard", "Full call transcripts and chat context, for hosts and managers."],
    ],
    questionsHeading: "The reservation sequence",
    questionsLead: "Four steps, in your order. The engine records each answer and checks it against availability before moving on.",
    questions: ["Party size", "Date and shift", "Zone", "Deposit screening"],
    zonesNote: "Zones are yours: Sala Interior and Terrace, or whatever your floor plan calls them.",
    exampleHeading: "A sample reservation",
    exampleLead: "A guest rings on a Friday afternoon. Sample data.",
    exampleCaption: "One reservation, step by step",
    exampleHead: ["Step", "Detail"],
    example: [
      ["Party size", "4"],
      ["Date and shift", "Friday, dinner"],
      ["Zone", "Terrace"],
      ["Deposit", "Not required for a party this size"],
      ["Availability", "Terrace table free at the requested time"],
      ["Floor plan", "Reservation written to CoverManager"],
      ["WhatsApp", "Confirmation and map sent to the guest"],
    ],
  },
  voice: {
    id: "voice",
    eyebrow: "Voice",
    h2: "Scripted voice. Nothing improvised.",
    lead: "A phone call needs speech recognition and speech synthesis. Neither one decides anything. Here is exactly what does what.",
    rows: [
      ["Hears", "Speech recognition turns the call into text. It transcribes. It does not decide."],
      ["Decides", "A fixed state machine picks the next step. The same input always gives the same step."],
      ["Says", "Approved lines, in the guest's language, read out by speech synthesis. No generative model writes them."],
      ["Checks", "Availability is read from your floor plan before any slot is offered."],
      ["Records", "Every call is transcribed and kept with the reservation."],
      ["Falls back", "If a call drops, the reservation details go to the guest's WhatsApp."],
    ],
    note: "Replies on a call begin in under a second.",
  },
  dashboard: {
    id: "dashboard",
    eyebrow: "Dashboard",
    h2: "Every call and thread, in one place for the host.",
    lead: "The same dashboard real estate teams use. Only the labels change: guests, reservations, party size, zone.",
    rows: [
      ["Calls and threads together", "A guest who rang and then wrote on WhatsApp is one conversation."],
      ["Full transcripts", "Every call, word for word, next to the reservation it produced."],
      ["Chat context", "The whole WhatsApp thread is attached, so a host never asks a guest to repeat themselves."],
      ["Take over in one tap", "A host takes the conversation from the engine, and hands it back when done."],
      ["For managers", "One view across shifts and zones."],
    ],
  },
  faq: {
    id: "faq",
    eyebrow: "Questions",
    h2: "What hospitality teams ask first.",
    items: [
      ["Does it use a generative model?", "No. No generative model decides, writes or prices anything. Speech recognition transcribes calls and speech synthesis reads approved lines aloud. Every step in between is a fixed rule."],
      ["Can it offer a table that is full?", "No. Availability is checked against your floor plan before any slot is offered, so a table that does not exist cannot be offered."],
      ["Which floor-plan systems does it connect to?", "It is built for CoverManager. If you use another floor-plan tool, tell us which one."],
      ["Which languages does it speak?", "English, Spanish and Catalan."],
      ["What happens when a call drops?", "The reservation details go to the guest's WhatsApp, so the guest does not start again."],
      ["Can a host step in?", "At any point. Taking over stops the engine replying until someone hands the conversation back."],
      ["Does it work with the number we already use?", "WhatsApp runs on the Meta WhatsApp Business Platform, so the number is registered there. Calls use a dedicated voice trunk."],
    ],
  },
  closing: {
    id: "demo",
    eyebrow: "Demo",
    h2: "Tell us about your venue.",
    lead: "Your shifts, your zones and the floor-plan tool you use. We will walk through a reservation from call to floor plan.",
  },
  footer: {
    meta: "Reservations by phone and WhatsApp for hospitality groups and restaurants.",
    siblings: [
      { label: "Also built for real estate", id: "real-estate" },
      { label: "Also built for dental clinics", id: "clinic" },
    ],
  },
};
