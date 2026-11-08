// Invariants for the four sites. Run after build.mjs; exits non-zero on failure.
//   docker run --rm -v "$PWD":/app -w /app node:22-bookworm sh -c 'node sites/build.mjs && node sites/check.mjs'

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import hospitality from "./copy/hospitality.mjs";
import clinic from "./copy/clinic.mjs";
import realEstate from "./copy/real-estate.mjs";
import { ORIGINS, PLATFORM_LABEL, PLATFORM_URL } from "./copy/shared.mjs";

const dist = join(dirname(fileURLToPath(import.meta.url)), "dist");
const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };
const read = (site) => readFileSync(join(dist, site, "index.html"), "utf8");

for (const site of ["root", "real-estate", "hospitality", "clinic"]) {
  const html = read(site);
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const [, target] of html.matchAll(/href="#([^"]+)"/g)) {
    check(ids.has(target), `${site}: dead anchor #${target}`);
  }
  check(/<meta name="robots"/.test(html), `${site}: missing robots meta`);
  check(/<h1>/.test(html) && (html.match(/<h1>/g) ?? []).length === 1, `${site}: needs exactly one h1`);
  check(existsSync(join(dist, site, "assets/fonts/Geist-Variable.woff2")), `${site}: font missing`);
}

// Every gateway on the root: header, hero, mobile bar, footer.
const root = read("root");
for (const v of ["real-estate", "hospitality", "clinic"]) {
  const n = root.split(`href="${ORIGINS[v]}"`).length - 1;
  check(n >= 4, `root: ${v} gateway appears ${n} times, expected at least 4`);
}

// Every vertical links back to the platform in the header and the footer.
for (const v of ["real-estate", "hospitality", "clinic"]) {
  const html = read(v);
  const header = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
  const footer = html.slice(html.indexOf("<footer"), html.indexOf("</footer>"));
  for (const [name, part] of [["header", header], ["footer", footer]]) {
    check(part.includes(`href="${PLATFORM_URL}"`) && part.includes(PLATFORM_LABEL), `${v}: ${name} backlink missing`);
  }
  // Vocabulary must not leak across verticals.
  const other = {
    "real-estate": /\b(reservation|guest|restaurant|table|patient|clinic)s?\b/i,
    hospitality: /\b(lead|broker|viewing|brokerage|patient|clinic)s?\b/i,
    clinic: /\b(lead|broker|viewing|brokerage|reservation|guest|restaurant|table)s?\b/i,
  }[v];
  const text = html.replace(/<(footer|header)[\s\S]*?<\/\1>/g, "").replace(/<[^>]+>/g, " ");
  check(!other.test(text), `${v}: other vertical's vocabulary in page body`);
}

// Claims we cannot make: voice needs speech models, official APIs do not make bans impossible.
for (const site of ["root", "real-estate", "hospitality", "clinic"]) {
  check(!/zero.hallucination|completely eliminate|no (llm|ai)s? anywhere/i.test(read(site)), `${site}: overclaim wording`);
}

// Real estate scoring: the page must agree with its own arithmetic.
{
  const sc = realEstate.scoring;
  const sum = sc.example.reduce((n, [, pts]) => n + pts, 0);
  check(sum === sc.exampleScore, `real-estate: worked example sums to ${sum}, page says ${sc.exampleScore}`);
  const maxes = sc.factors.map(([, pts]) => Math.max(...pts.match(/\d+/g).map(Number)));
  const total = maxes.reduce((a, b) => a + b, 0);
  check(total === 123, `real-estate: factor maximums sum to ${total}, page says 123`);
  check(sc.factors.length === 10 && sc.example.length === 10, "real-estate: expected ten factors");
  const exampleNames = sc.example.map(([n]) => n).join("|");
  check(exampleNames === sc.factors.map(([n]) => n).join("|"), "real-estate: example factors differ from the factor table");
  const html = read("real-estate");
  check(html.includes(">99<"), "real-estate: worked-example score missing from page");
  for (const [name, range] of sc.bands) {
    check(html.includes(`<strong>${name}</strong><span>${range}</span>`), `real-estate: band ${name} missing from page`);
  }
  check((html.match(/<li>/g) ?? []).length >= 9 + 6, "real-estate: questions or steps missing");
  check(existsSync(join(dist, "real-estate/assets/product-queue-1280.jpg")), "real-estate: screenshot missing");
}

// Hospitality: sections, languages, and the launch gate.
{
  const html = read("hospitality");
  for (const id of ["mechanics", "voice", "dashboard", "faq", "demo"]) check(html.includes(`id="${id}"`), `hospitality: section #${id} missing`);
  for (const lang of ["English", "Spanish", "Catalan"]) check(html.includes(lang), `hospitality: ${lang} not mentioned`);
  check(html.includes("Sala Interior") && html.includes("Terrace"), "hospitality: zones missing");
  check(html.includes("speech synthesis") && html.includes("speech recognition"), "hospitality: voice section must name the speech models");
  check(existsSync(join(dirname(fileURLToPath(import.meta.url)), "CLAIMS.md")), "hospitality: CLAIMS.md missing");
  if (!hospitality.claimsConfirmed) {
    const r = spawnSync("node", [join(dirname(fileURLToPath(import.meta.url)), "build.mjs")], { env: { ...process.env, SITES_INDEXABLE: "1" } });
    check(r.status === 1, "launch gate: an indexable build must be refused while claimsConfirmed is false");
    check(read("hospitality").includes("noindex"), "hospitality: must be noindex while unconfirmed");
  }
}

// Clinic: sections, languages, and the privacy promises the page makes. They are true of src/
// (config/seed-clinic.json asks no health question; the first message sends emergencies elsewhere), so a
// copy edit that drops them, or a seed edit that breaks them, fails here.
{
  const html = read("clinic");
  for (const id of ["mechanics", "privacy", "dashboard", "faq", "demo", "try"]) check(html.includes(`id="${id}"`), `clinic: section #${id} missing`);
  for (const lang of ["English", "Arabic"]) check(html.includes(lang), `clinic: ${lang} not mentioned`);
  check(/emergency/i.test(html), "clinic: the emergency advice must be on the page");
  check(!/\b(voice|phone call|calendar sync|reminder)s?\b/i.test(html.replace(/<(footer|header)[\s\S]*?<\/\1>/g, "").replace(/<[^>]+>/g, " ")), "clinic: claims a feature that is not built (voice, calls, calendar sync, reminders)");
  check(clinic.mechanics.questions.length === 7, "clinic: the page lists seven booking questions");
  const seed = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "config", "seed-clinic.json"), "utf8"));
  const asked = seed.questions.map((q) => q.fields["Question Key"]);
  check(asked.length === clinic.mechanics.questions.length, `clinic: seed asks ${asked.length} questions, page says ${clinic.mechanics.questions.length}`);
  check(!asked.some((k) => /symptom|reason|medication|condition|diagnos|history/i.test(k)), "clinic: the seed must not ask for health information");
  check(/emergency/i.test(seed.questions[0].fields.English) && seed.questions[0].fields.Arabic.includes("الطوارئ"), "clinic: the first message must send emergencies elsewhere, in both languages");
}

{
  const seed = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "config", "seed-clinic.json"), "utf8"));
  check(JSON.stringify(seed.languages) === '["English","Arabic"]', "clinic: the seed must offer exactly English and Arabic");
  const missing = [...seed.questions, ...seed.options, ...seed.messages].filter((r) => !r.fields.Arabic || !r.fields.English);
  check(missing.length === 0, `clinic: ${missing.length} seed records lack an English or Arabic text`);
}

// Caching: every local file a page loads resolves, and carries a content hash, so a
// cache can never pair new HTML with an old stylesheet or asset.
{
  const HASHED = /\.[0-9a-f]{10}\.[A-Za-z0-9]+$/;
  const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
  for (const site of ["root", "real-estate", "real-estate-landing", "hospitality", "clinic"]) {
    const dir = join(dist, site);
    for (const file of walk(dir).filter((f) => f.endsWith(".html"))) {
      const html = readFileSync(file, "utf8");
      const refs = new Set();
      for (const m of html.matchAll(/(?:src|href)="([^"#?]+)"/g)) refs.add(m[1]);
      for (const m of html.matchAll(/srcset="([^"]+)"/g)) for (const part of m[1].split(",")) refs.add(part.trim().split(/\s+/)[0]);
      for (const ref of refs) {
        if (/^(https?:|mailto:|tel:|\/cdn-cgi\/|\/_a\/|\/$)/.test(ref) || ref.endsWith(".html") || ref === "/") continue;
        const rel = ref.replace(/^\//, "");
        check(existsSync(join(dir, rel)), `${site}: ${file.slice(dir.length + 1)} references missing ${ref}`);
        if (/^assets\/|\.css$/.test(rel)) check(HASHED.test(rel), `${site}: ${file.slice(dir.length + 1)} loads unhashed ${ref}`);
      }
    }
    for (const css of walk(dir).filter((f) => /\.[0-9a-f]{10}\.css$/.test(f))) {
      for (const m of readFileSync(css, "utf8").matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
        if (/^(data:|https?:)/.test(m[1])) continue;
        check(existsSync(join(dir, m[1])), `${site}: ${css.slice(dir.length + 1)} url(${m[1]}) missing`);
        check(HASHED.test(m[1]), `${site}: ${css.slice(dir.length + 1)} url(${m[1]}) is unhashed`);
      }
    }
  }
}

if (failures.length) { console.error(failures.map((f) => `FAIL ${f}`).join("\n")); process.exit(1); }
console.log("sites: all checks passed");
