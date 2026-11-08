// The live landing, split across the two hosts it now serves.
//
//   realEstateFromLanding()  the current landing becomes real-estate.kadensio.com
//   rootLegalPages()         the company-level legal pages stay on kadensio.com
//
// Source of truth stays landing/. Nothing there is edited; both functions
// read it and write into sites/dist.

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { ORIGINS, PLATFORM_LABEL, PLATFORM_URL } from "./copy/shared.mjs";

const ROOT = ORIGINS.root;
const RE = ORIGINS["real-estate"];
const LEGAL = ["privacy.html", "terms.html", "dpa.html"];
/** Product pages that move to the real estate host. */
const PAGES = ["index.html", "lead-scoring.html", "official-vs-unofficial-whatsapp-automation.html", "speed-to-lead-real-estate.html"];

const isLegalUrl = (u) => LEGAL.some((f) => u === `${ROOT}/${f}`);

/** Move a URL from the root host to the real estate host, unless it belongs to the company or the legal pages. */
function moveUrl(u) {
  if (typeof u !== "string" || !u.startsWith(`${ROOT}/`)) return u;
  if (isLegalUrl(u) || u.endsWith("#organization")) return u;
  return RE + u.slice(ROOT.length);
}

function moveJsonLd(node) {
  if (Array.isArray(node)) return node.map(moveJsonLd);
  if (node && typeof node === "object") {
    // The company stays at the root, with its own url and logo.
    if (node["@type"] === "Organization") return node;
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, moveJsonLd(v)]));
  }
  return moveUrl(node);
}

const PARENT_CSS = `
/* Parent bar and footer link back to the platform (added for real-estate.kadensio.com). */
html { scroll-padding-top: 8rem; }
.parent-bar { border-bottom: 1px solid var(--line-2); background: var(--bg-2); }
.parent-bar-inner { display: flex; align-items: center; justify-content: space-between; gap: 1rem; min-height: 2.5rem; font-size: .875rem; }
.parent-link { display: inline-flex; align-items: center; gap: .5rem; color: var(--ink); font-weight: 550; text-decoration: none; padding: .5rem 0; }
.parent-link .arrow { color: var(--accent); transition: transform .2s var(--ease-out); }
.parent-link:hover .arrow { transform: translateX(-3px); }
.parent-bar .sibling { color: var(--ink-3); text-decoration: none; }
.parent-bar .sibling:hover { color: var(--ink); }
.parent-bar .siblings { display: flex; gap: 1.25rem; }
@media (max-width: 559px) { .parent-bar .siblings { display: none; } }
.footer-platform { display: inline-flex; gap: .5rem; align-items: center; color: var(--ink); font-weight: 550; text-decoration: none; margin-bottom: .75rem; }
.footer-platform .arrow { color: var(--accent); }
`;

const PARENT_BAR = `  <div class="parent-bar"><div class="wrap parent-bar-inner">
    <a class="parent-link" href="${PLATFORM_URL}"><span class="arrow" aria-hidden="true">←</span> ${PLATFORM_LABEL}</a>
    <span class="siblings"><a class="sibling" href="${ORIGINS.hospitality}">Hospitality →</a><a class="sibling" href="${ORIGINS.clinic}">Dental Clinics →</a></span>
  </div></div>
`;
const FOOTER_LINK = `<a class="footer-platform" href="${PLATFORM_URL}"><span class="arrow" aria-hidden="true">←</span> Powered by ${PLATFORM_LABEL}</a>
      `;

function transformPage(html) {
  // JSON-LD, structurally.
  html = html.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g, (_, open, body, close) => {
    const data = moveJsonLd(JSON.parse(body));
    return `${open}\n${JSON.stringify(data, null, 1)}\n${close}`;
  });
  // Head tags that carry an absolute URL.
  html = html.replace(/<(link rel="canonical"|meta property="og:(?:url|image|image:secure_url)"|meta name="twitter:image")[^>]*>/g, (tag) =>
    tag.replace(/https:\/\/kadensio\.com\/[^"]*/, (u) => moveUrl(u)),
  );
  // Legal pages live on the root only.
  for (const f of LEGAL) html = html.split(`href="${f}"`).join(`href="${ROOT}/${f}"`);
  // Way back to the platform: first row of the header, and the footer.
  if (!html.includes('<header class="site-header">\n  <div class="wrap header-inner">')) throw new Error("landing header markup changed");
  html = html.replace('<header class="site-header">\n  <div class="wrap header-inner">', `<header class="site-header">\n${PARENT_BAR}  <div class="wrap header-inner">`);
  if (!html.includes('<p class="footer-meta">')) throw new Error("landing footer markup changed");
  html = html.replace('<p class="footer-meta">', `${FOOTER_LINK}<p class="footer-meta">`);
  // Credit line, same markup the shared footer uses on the other two sites.
  const legal = html.match(/<p class="footer-legal">[\s\S]*?<\/p>/);
  if (!legal) throw new Error("landing footer-legal markup changed");
  html = html.replace(legal[0], `${legal[0]}\n      <p class="footer-meta">Built by <a href="https://ykhalil.com/">Yassin Khalil</a></p>`);
  return html;
}

const moveText = (text) =>
  text.replace(/https:\/\/kadensio\.com\/[^\s)"'<]*/g, (u) => moveUrl(u));

export function realEstateFromLanding({ repo, out }) {
  const src = join(repo, "landing");
  mkdirSync(out, { recursive: true });
  cpSync(join(src, "assets"), join(out, "assets"), { recursive: true });
  for (const f of PAGES) writeFileSync(join(out, f), transformPage(readFileSync(join(src, f), "utf8")));
  writeFileSync(join(out, "styles.css"), readFileSync(join(src, "styles.css"), "utf8") + PARENT_CSS);
  // Crawler files point at this host. The legal pages are not here, so they are not listed.
  // lastmod stays what landing/sitemap.xml says (edited by hand with the copy); the
  // screenshots are added so image search can find them.
  const entries = [...readFileSync(join(src, "sitemap.xml"), "utf8").matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)]
    .map(([, loc, lastmod]) => ({ loc: moveUrl(loc), lastmod }))
    .filter((e) => !LEGAL.some((f) => e.loc.endsWith(`/${f}`)));
  for (const e of entries) if (e.loc === `${RE}/`) e.images = HOME_IMAGES.map((f) => `${RE}/assets/${f}`);
  writeFileSync(join(out, "sitemap.xml"), sitemapXml(entries));
  writeFileSync(join(out, "robots.txt"), moveText(readFileSync(join(src, "robots.txt"), "utf8")));
  writeFileSync(join(out, "llms.txt"), moveText(readFileSync(join(src, "llms.txt"), "utf8")));
}

/** Legal pages for the root. Their own stylesheet name avoids clashing with the root site's styles.css. */
export function rootLegalPages({ repo, out }) {
  const src = join(repo, "landing");
  cpSync(join(src, "assets"), join(out, "assets"), { recursive: true });
  writeFileSync(join(out, "legal.css"), readFileSync(join(src, "styles.css"), "utf8"));
  for (const f of LEGAL) {
    let html = readFileSync(join(src, f), "utf8");
    html = html.replace('href="styles.css"', 'href="legal.css"');
    // The landing's own sections now live on the real estate host.
    html = html.split('href="index.html#').join(`href="${RE}/#`).split('href="index.html"').join('href="/"');
    html = html.split('href="lead-scoring.html"').join(`href="${RE}/lead-scoring.html"`);
    writeFileSync(join(out, f), html);
  }
}

/** Screenshots shown on the real estate home page. */
const HOME_IMAGES = ["product-queue-1280.jpg", "product-detail-1280.jpg"];

/**
 * Date (YYYY-MM-DD) of the last commit that touched any of `paths`, so a page's
 * lastmod moves only when its own content does. Undefined when git cannot say:
 * a missing lastmod is honest, a made-up one is not.
 */
export function lastCommitDate(repo, ...paths) {
  try {
    const d = execFileSync("git", ["-C", repo, "log", "-1", "--format=%cs", "--", ...paths], { encoding: "utf8" }).trim();
    return d || undefined;
  } catch {
    return undefined;
  }
}

/** entries: [{ loc, lastmod?, images?: [absolute url] }] */
export function sitemapXml(entries) {
  const image = (u) => `<image:image><image:loc>${u}</image:loc></image:image>`;
  const url = ({ loc, lastmod, images = [] }) =>
    `  <url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}${images.map(image).join("")}</url>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${entries.map(url).join("\n")}\n</urlset>\n`;
}

export { LEGAL, existsSync };
