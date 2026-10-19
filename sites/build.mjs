// Builds the three marketing sites into sites/dist/<site>/. No dependencies.
//
//   node sites/build.mjs                 # noindex build, safe to preview
//   SITES_INDEXABLE=1 node sites/build.mjs   # launch build
//
// The host has no Node; run it in a container:
//   docker run --rm -v "$PWD":/app -w /app node:22-bookworm node sites/build.mjs

import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { CONTACT_EMAIL, ORIGINS } from "./copy/shared.mjs";
import { fingerprint } from "./fingerprint.mjs";
import { writeLlms } from "./llms.mjs";
import { LEGAL, lastCommitDate, realEstateFromLanding, rootLegalPages, sitemapXml } from "./landing.mjs";
import { fileURLToPath } from "node:url";

import root from "./copy/root.mjs";
import realEstate from "./copy/real-estate.mjs";
import hospitality from "./copy/hospitality.mjs";
import { demoScript, demoSection } from "./shared/demo.mjs";
import { bands, esc, closing, dataTable, faq, figure, gatewayBar, hero, ledger, mappingTable, page, pipeline, questions, section, rootHeader, verticalHeader } from "./shared/ui.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..");
const dist = join(here, "dist");
const indexable = process.env.SITES_INDEXABLE === "1";

// Launch gate: hospitality capabilities are not in the backend repo, so an
// indexable build needs the owner's confirmation (sites/CLAIMS.md).
if (indexable && !hospitality.claimsConfirmed) {
  console.error("Refusing an indexable build: hospitality.claimsConfirmed is false. Confirm the claims in sites/CLAIMS.md first.");
  process.exit(1);
}

/** Keep only nav links whose target id exists in the rendered main. */
const liveNav = (nav, main) => nav.filter((n) => !n.href.startsWith("#") || main.includes(`id="${n.href.slice(1)}"`));

function rootPage() {
  const s = root;
  const main = [
    hero(s, { gateways: true }),
    section({ ...s.architecture, body: pipeline(s.architecture.steps), tint: true }),
    section({ ...s.guarantees, body: ledger(s.guarantees.rows) }),
    section({ ...s.verticals, body: mappingTable(s.verticals), tint: true }),
  ].join("\n");
  return page(s, { indexable, header: rootHeader(s, liveNav(s.nav, main)), main, extraBody: gatewayBar(), bodyClass: "has-gateway-bar" });
}

const sub = (h, lead, body) => `<div class="sub"><h3>${esc(h)}</h3>${lead ? `<p class="lead">${esc(lead)}</p>` : ""}${body}</div>`;

function hospitalityMain(s) {
  const m = s.mechanics, v = s.voice, d = s.dashboard;
  return [
    hero(s),
    demoSection(s.demo),
    section({
      ...m,
      body:
        pipeline(m.steps) +
        sub(m.questionsHeading, m.questionsLead, questions(m.questions) + `<p class="note">${esc(m.zonesNote)}</p>`) +
        sub(m.exampleHeading, m.exampleLead, dataTable({ caption: m.exampleCaption, head: m.exampleHead, rows: m.example })),
      tint: false,
    }),
    section({ ...v, body: ledger(v.rows) + `<p class="lead" style="margin-top:1.5rem">${esc(v.note)}</p>`, tint: true }),
    section({ ...d, body: ledger(d.rows), tint: false }),
    section({ ...s.faq, body: faq(s.faq.items) }),
    closing({ ...s.closing, primary: { label: s.cta.label, href: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(s.cta.subject)}` } }),
  ].join("\n");
}

function realEstateMain(s) {
  const m = s.mechanics, sc = s.scoring, d = s.dashboard;
  const scoreRow = ["Score", String(sc.exampleScore), sc.exampleBand];
  return [
    hero(s),
    section({ ...m, body: pipeline(m.steps) + sub(m.questionsHeading, m.questionsLead, questions(m.questions)), tint: true }),
    section({
      ...sc,
      body:
        bands(sc.bands) +
        dataTable({ caption: sc.factorsCaption, head: sc.factorsHead, rows: sc.factors, num: 1 }) +
        `<p class="lead" style="margin-top:1.5rem">${esc(sc.capNote)}</p>` +
        sub(sc.exampleHeading, sc.exampleLead, dataTable({ caption: sc.exampleCaption, head: sc.exampleHead, rows: sc.example.map(([a, b, c]) => [a, String(b), c]), num: 1, foot: scoreRow })) +
        `<p class="lead" style="margin-top:1.5rem">${esc(sc.exampleClose)} <a class="link-arrow" href="${sc.fullLink.href}">${esc(sc.fullLink.label)}</a></p>`,
    }),
    section({ ...d, body: figure(d.image) + ledger(d.rows), tint: true }),
    section({ ...s.faq, body: faq(s.faq.items) }),
    closing({ ...s.closing, primary: { label: s.cta.label, href: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(s.cta.subject)}` } }),
  ].join("\n");
}

function verticalPage(s, mainFn = hero) {
  const main = mainFn(s);
  return page(s, { indexable, header: verticalHeader(s, liveNav(s.nav, main)), main, extraBody: s.demo ? demoScript : "" });
}

const sites = [
  ["root", rootPage()],
  ["real-estate", verticalPage(realEstate, realEstateMain)],
  ["hospitality", verticalPage(hospitality, hospitalityMain)],
];

/** Screenshots come from the live landing too; only the site that shows them gets them. */
const EXTRA_ASSETS = {
  "real-estate": ["product-queue-1280.jpg", "product-queue-2560.jpg"],
};

const cssFor = (id) => ["base.css", "components.css", ...(id === "hospitality" ? ["demo.css"] : [])]
  .map((f) => readFileSync(join(here, "shared", f), "utf8")).join("\n");

rmSync(dist, { recursive: true, force: true });
for (const [id, html] of sites) {
  const out = join(dist, id);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "index.html"), html);
  writeFileSync(join(out, "styles.css"), cssFor(id));
  // Fonts and logo marks come from the live landing, so there is one copy of the brand.
  cpSync(join(repo, "landing", "assets", "fonts"), join(out, "assets", "fonts"), { recursive: true });
  for (const f of ["kadensio-lockup.svg", "kadensio-lockup-reversed.svg", "kadensio-icon.svg", "kadensio-icon-small.svg"]) {
    cpSync(join(repo, "landing", "assets", f), join(out, "assets", f));
  }
  for (const f of EXTRA_ASSETS[id] ?? []) cpSync(join(repo, "landing", "assets", f), join(out, "assets", f));
  const base = ORIGINS[id];
  writeFileSync(
    join(out, "robots.txt"),
    indexable ? `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n` : "User-agent: *\nDisallow: /\n",
  );
  // lastmod is the date the page's own source last changed, never the build date.
  const own = lastCommitDate(repo, `sites/copy/${id === "root" ? "root" : id}.mjs`, "sites/shared");
  const urls = [
    { loc: `${base}/`, lastmod: own },
    ...(id === "root" ? LEGAL.map((f) => ({ loc: `${base}/${f}`, lastmod: lastCommitDate(repo, `landing/${f}`) })) : []),
  ];
  if (indexable) writeFileSync(join(out, "sitemap.xml"), sitemapXml(urls));
}

// The company-level legal pages stay on kadensio.com.
rootLegalPages({ repo, out: join(dist, "root") });

// real-estate.kadensio.com is the current landing, moved and linked back to the platform.
// (sites/copy/real-estate.mjs is an alternative page and is not published.)
realEstateFromLanding({ repo, out: join(dist, "real-estate-landing") });

// llms.txt / llms-full.txt, from the built pages. kadensio.com's full file carries the whole company.
const SITE_LLMS = {
  root: {
    name: "Kadensio",
    origin: ORIGINS.root,
    summary:
      "Kadensio builds conversation infrastructure on the official WhatsApp Business Platform and on voice: deterministic state machines that qualify, route and book, with fixed-arithmetic scoring and no generative model writing the answers. It runs two products, real estate lead qualification and hospitality reservations.",
    intro: [
      "One engine, six stages: channel adapter, state machine, scorer, router, integrations, shared inbox. Every reply is a fixed template and every score is deterministic and logged, so the engine cannot invent a price, a unit or a table. Only the vocabulary and the integrations change between industries.",
    ],
    pages: [
      { file: "index.html", label: "Kadensio platform", note: "the engine, its six stages, what it will not do, and how it maps to each vertical" },
      { file: "privacy.html", label: "Privacy Policy", note: "what data is processed and how" },
      { file: "terms.html", label: "Terms of Service", note: "terms of use" },
      { file: "dpa.html", label: "Data Processing Addendum", note: "data location (Frankfurt, Germany) and sub-processors" },
    ],
    related: [
      { label: "Kadensio for Real Estate", url: `${ORIGINS["real-estate"]}/`, note: "WhatsApp lead qualification, scoring, routing and viewing booking for brokerages" },
      { label: "Kadensio for Hospitality", url: `${ORIGINS.hospitality}/`, note: "calls and WhatsApp reservations checked against a live floor plan" },
    ],
    contact: "yassin@kadensio.com",
  },
  hospitality: {
    name: "Kadensio for Hospitality",
    origin: ORIGINS.hospitality,
    summary:
      "Kadensio for Hospitality answers phone calls and WhatsApp threads for hospitality groups and restaurants in English, Spanish and Catalan, and checks every reservation against the live floor plan (built for CoverManager) before confirming it. Voice is scripted: speech recognition and synthesis only, with no generative model deciding or writing anything.",
    intro: [
      "Everything on this site is the vendor's own product description. It publishes no customer names, venue counts, uptime or accuracy figures, and no prices; the sample reservation on the page is labelled sample data.",
    ],
    pages: [{ file: "index.html", label: "Kadensio for Hospitality", note: "how a reservation goes from first ring to booked table, how the scripted voice works, the host dashboard, and FAQ" }],
    related: [
      { label: "Kadensio platform", url: `${ORIGINS.root}/`, note: "the engine behind both products, and the company's legal pages" },
      { label: "Kadensio for Real Estate", url: `${ORIGINS["real-estate"]}/`, note: "the same engine for brokerages" },
    ],
    contact: "yassin@kadensio.com (book a demo)",
  },
  "real-estate": {
    name: "Kadensio for Real Estate",
    origin: ORIGINS["real-estate"],
    summary: "WhatsApp lead qualification for real estate brokerages, on the official Meta WhatsApp Business Platform, with fixed-arithmetic scoring and no generative model.",
    pages: [
      { file: "index.html", label: "Home", note: "what Kadensio does, how it works, and early access" },
      { file: "lead-scoring.html", label: "How the lead score works", note: "all ten scoring factors, their points, and a worked example" },
      { file: "official-vs-unofficial-whatsapp-automation.html", label: "Official vs unofficial WhatsApp automation", note: "what WhatsApp's terms say and three questions to ask a vendor" },
      { file: "speed-to-lead-real-estate.html", label: "Real estate lead response time", note: "the Harvard Business Review audit of 2,241 companies, its limits, and how to measure first-reply time" },
    ],
  },
};
const dir = (id) => join(dist, id);
writeLlms(dir("root"), SITE_LLMS.root, [
  { dir: dir("real-estate-landing"), origin: ORIGINS["real-estate"], pages: SITE_LLMS["real-estate"].pages.map((p) => p.file) },
  { dir: dir("hospitality"), origin: ORIGINS.hospitality, pages: ["index.html"] },
]);
writeLlms(dir("hospitality"), SITE_LLMS.hospitality);
writeLlms(
  dir("real-estate-landing"),
  { ...SITE_LLMS["real-estate"], intro: [], contact: "yassin@kadensio.com" },
  [{ dir: dir("root"), origin: ORIGINS.root, pages: LEGAL }],
  { keepShort: true },
);

// Hashed file names, last, once every file is in place.
for (const id of ["root", "real-estate", "real-estate-landing", "hospitality"]) fingerprint(join(dist, id));

console.log(`built ${sites.map(([id]) => id).join(", ")} (${indexable ? "indexable" : "noindex"}) -> sites/dist`);
