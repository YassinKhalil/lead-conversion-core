// Facts every site agrees on. One place, so the four sites cannot drift.

export const ORIGINS = {
  root: "https://kadensio.com",
  "real-estate": "https://real-estate.kadensio.com",
  hospitality: "https://hospitality.kadensio.com",
  clinic: "https://clinic.kadensio.com",
};

export const CONTACT_EMAIL = "yassin@kadensio.com";

/** Where "Kadensio Platform Architecture" points, from the vertical sites. */
export const PLATFORM_URL = `${ORIGINS.root}/#architecture`;
export const PLATFORM_LABEL = "Kadensio Platform Architecture";

export const VERTICALS = [
  {
    id: "real-estate",
    name: "Real Estate",
    host: "real-estate.kadensio.com",
    url: ORIGINS["real-estate"],
    line: "Qualify buyers on WhatsApp. Book the viewing.",
  },
  {
    id: "hospitality",
    name: "Hospitality",
    host: "hospitality.kadensio.com",
    url: ORIGINS.hospitality,
    line: "Answer calls and threads. Seat real tables.",
  },
  {
    id: "clinic",
    name: "Dental Clinics",
    host: "clinic.kadensio.com",
    url: ORIGINS.clinic,
    line: "Answer every enquiry. Book dental appointments.",
  },
];

/**
 * Wording rule for every site. Voice needs speech recognition and speech
 * synthesis, so "no models anywhere" would be false. What is true: no
 * generative model decides, writes or prices anything.
 */
export const NO_GENERATIVE_LINE =
  "No generative model decides, writes or prices anything. Every state change and every score is deterministic.";
