// Shared page shell: head, header, footer and the building blocks the three
// sites use. Plain functions returning strings; no framework, no dependencies.

import { CONTACT_EMAIL, ORIGINS, PLATFORM_LABEL, PLATFORM_URL, VERTICALS } from "../copy/shared.mjs";

export const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const ICONS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <symbol id="i-arrow" viewBox="0 0 256 256"><path d="M198,64V168a6,6,0,0,1-12,0V78.48L68.24,196.24a6,6,0,0,1-8.48-8.48L177.52,70H88a6,6,0,0,1,0-12H192A6,6,0,0,1,198,64Z"/></symbol>
</svg>`;
const arrowIcon = `<svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg>`;

// First-party analytics (self-hosted Umami, served through /_a/ on each Kadensio host).
const ANALYTICS = { root: "2ca5e8aa-a362-4730-8077-fbef2239586e", "real-estate": "b112ed47-fdf4-45ff-b8f7-50ab727c50ba", hospitality: "ac95c1a5-7983-439f-8d09-0117cbbec7f1", clinic: "9776f38b-81ba-41e7-94a8-0399ea1f0ce1" };

export function head(site, { indexable }) {
  const url = ORIGINS[site.id] + "/";
  return `<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(site.title)}</title>
<meta name="description" content="${esc(site.description)}">
<meta name="robots" content="${indexable ? "index, follow" : "noindex, nofollow"}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Kadensio">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(site.title)}">
<meta property="og:description" content="${esc(site.description)}">
<meta property="og:image" content="${ORIGINS[site.id]}/assets/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(site.title)}">
<meta name="twitter:description" content="${esc(site.description)}">
<meta name="twitter:image" content="${ORIGINS[site.id]}/assets/og.png">
<meta name="theme-color" content="#0C1F1A">
<link rel="icon" href="assets/kadensio-icon-small.svg" type="image/svg+xml">
<link rel="preload" href="assets/fonts/Geist-Variable.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="styles.css">
${ANALYTICS[site.id] ? `<script defer src="/_a/a.js" data-website-id="${ANALYTICS[site.id]}"></script>\n` : ""}</head>`;
}

const logo = (href, label, h = 26) => `<a class="logo" href="${href}" aria-label="${esc(label)}">
      <img class="logo-light" src="assets/kadensio-lockup.svg" alt="Kadensio" width="104" height="${h}" decoding="async">
      <img class="logo-dark" src="assets/kadensio-lockup-reversed.svg" alt="Kadensio" width="104" height="${h}" decoding="async">
    </a>`;

const navLinks = (items) =>
  items.length
    ? `<nav class="nav" aria-label="Primary">${items.map((n) => `<a href="${esc(n.href)}">${esc(n.label)}</a>`).join("")}</nav>`
    : "";

const demoHref = (site) =>
  `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(site.cta?.subject ?? "Kadensio")}`;

/** Root site: gateways live in the header (desktop) and a bottom bar (phone). */
export function rootHeader(site, nav) {
  return `<header class="site-header">
  <div class="wrap header-inner">
    ${logo("/", "Kadensio, home")}
    ${navLinks(nav)}
    <div class="header-gateways">
      ${VERTICALS.map((v, i) => `<a class="btn ${i === VERTICALS.length - 1 ? "btn-primary" : "btn-ghost"}" href="${v.url}">${esc(v.name)} ${arrowIcon}</a>`).join("\n      ")}
    </div>
  </div>
</header>`;
}

export function gatewayBar() {
  return `<div class="gateway-bar" role="navigation" aria-label="Industries" style="--n:${VERTICALS.length}">
  ${VERTICALS.map((v, i) => `<a class="btn ${i === VERTICALS.length - 1 ? "btn-primary" : "btn-ghost"}" href="${v.url}">${esc(v.name)}</a>`).join("\n  ")}
</div>`;
}

/** Vertical sites: the way back to the platform is the first row of the sticky header. */
export function verticalHeader(site, nav) {
  const siblings = VERTICALS.filter((v) => v.id !== site.id);
  return `<header class="site-header">
  <div class="parent-bar"><div class="wrap parent-bar-inner">
    <a class="parent-link" href="${PLATFORM_URL}"><span class="arrow" aria-hidden="true">←</span> ${esc(PLATFORM_LABEL)}</a>
    <span class="siblings">${siblings.map((s) => `<a class="sibling" href="${s.url}">${esc(s.name)} →</a>`).join("")}</span>
  </div></div>
  <div class="wrap header-inner">
    ${logo(`${ORIGINS[site.id]}/`, "Kadensio " + (VERTICALS.find((v) => v.id === site.id)?.name ?? ""))}
    ${navLinks(nav)}
    <a class="btn btn-primary header-cta" href="${demoHref(site)}">${esc(site.cta.label)}</a>
  </div>
</header>`;
}

export function hero(site, { gateways = false } = {}) {
  const h = site.hero;
  const gw = gateways
    ? `<div class="gateways" role="group" aria-label="${esc(h.gatewayHeading)}" style="--n:${VERTICALS.length}">${VERTICALS.map(
        (v) => `
      <a class="gateway" href="${v.url}">
        <span class="gateway-host">${esc(v.host)}</span>
        <span class="gateway-name">${esc(v.name)} ${arrowIcon}</span>
        <span class="gateway-line">${esc(v.line)}</span>
      </a>`,
      ).join("")}
    </div>`
    : "";
  const actions = site.demo
    ? `<div class="hero-actions"><a class="btn btn-primary btn-lg" href="#${esc(site.demo.id)}">Try it now ${arrowIcon}</a>${site.cta ? `<a class="link-arrow link-lg" href="${demoHref(site)}">${esc(site.cta.label)}</a>` : ""}</div>`
    : site.cta
      ? `<div class="hero-actions"><a class="btn btn-primary btn-lg" href="${demoHref(site)}">${esc(site.cta.label)} ${arrowIcon}</a></div>`
      : "";
  return `<section class="hero" id="top">
  <div class="wrap">
    <p class="eyebrow">${esc(h.eyebrow)}</p>
    <h1>${esc(h.h1)}</h1>
    <p class="lead">${esc(h.lead)}</p>
    ${gw}${actions}
    <ul class="proof">${h.proof.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
  </div>
</section>`;
}

export function section({ id, eyebrow, h2, lead, body, tint = false }) {
  return `<section class="section${tint ? " section-tint" : ""}" id="${esc(id)}">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">${esc(eyebrow)}</p>
      <h2>${esc(h2)}</h2>
      ${lead ? `<p class="lead">${esc(lead)}</p>` : ""}
    </div>
    ${body}
  </div>
</section>`;
}

export const pipeline = (steps) =>
  `<ol class="pipeline">${steps.map(([t, d]) => `<li><strong>${esc(t)}</strong><span>${esc(d)}</span></li>`).join("")}</ol>`;

export const ledger = (rows) =>
  `<dl class="ledger">${rows.map(([t, d]) => `<div class="ledger-row"><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join("")}</dl>`;

export function mappingTable({ caption, head, rows, cta }) {
  const link = (v) => `<a href="${v.url}">${esc(v.name)}</a>`;
  return `<table class="mapping">
    <caption>${esc(caption)}</caption>
    <thead><tr><th scope="col">${esc(head[0])}</th>${cta.map((v) => `<th scope="col">${link(v)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(([a, ...cells]) => `<tr><th scope="row">${esc(a)}</th>${cells.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>
  </table>`;
}

/** Ruled data table. `num` is the index of a right-aligned numeric column; `foot` is an optional total row. */
export function dataTable({ caption, head, rows, num = -1, foot }) {
  const cell = (tag, v, i) => `<${tag}${i === num ? ' class="num"' : ""}>${esc(v)}</${tag}>`;
  const row = (r, tag = "td") => `<tr>${r.map((v, i) => (i === 0 && tag === "td" ? `<th scope="row">${esc(v)}</th>` : cell(tag, v, i))).join("")}</tr>`;
  return `<div class="table-wrap"><table class="mapping data">
    <caption>${esc(caption)}</caption>
    <thead><tr>${head.map((v, i) => cell("th", v, i).replace("<th", '<th scope="col"')).join("")}</tr></thead>
    <tbody>${rows.map((r) => row(r)).join("")}</tbody>
    ${foot ? `<tfoot>${row(foot)}</tfoot>` : ""}
  </table></div>`;
}

/** Score bands as one three-cell strip. */
export const bands = (items) =>
  `<ul class="bands">${items.map(([n, r]) => `<li><strong>${esc(n)}</strong><span>${esc(r)}</span></li>`).join("")}</ul>`;

/** The nine questions, numbered, as a ruled grid. */
export const questions = (items) =>
  `<ol class="questions" style="--cols:${items.length % 3 === 0 ? 3 : items.length}">${items.map((q) => `<li>${esc(q)}</li>`).join("")}</ol>`;

export function figure({ base, alt, caption, width = 1280, height = 800, eager = false }) {
  return `<figure class="shot">
    <img src="assets/${base}-1280.jpg" srcset="assets/${base}-1280.jpg 1280w, assets/${base}-2560.jpg 2560w"
         sizes="(min-width: 1200px) 1104px, 92vw" width="${width}" height="${height}"
         ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" alt="${esc(alt)}">
    <figcaption>${esc(caption)}</figcaption>
  </figure>`;
}

export const faq = (items) =>
  `<div class="faq">${items.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</div>`;

/** Closing call to action: demo by email, or try the live number. */
export function closing({ id, eyebrow, h2, lead, primary, secondary }) {
  return `<section class="section section-tint" id="${esc(id)}">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">${esc(eyebrow)}</p>
      <h2>${esc(h2)}</h2>
      <p class="lead">${esc(lead)}</p>
    </div>
    <div class="hero-actions">
      <a class="btn btn-primary btn-lg" href="${esc(primary.href)}">${esc(primary.label)} ${arrowIcon}</a>
      ${secondary ? `<a class="link-arrow link-lg" href="${esc(secondary.href)}">${esc(secondary.label)}</a>` : ""}
    </div>
  </div>
</section>`;
}

export function footer(site) {
  const f = site.footer;
  const isRoot = site.id === "root";
  const platform = isRoot
    ? ""
    : `<a class="footer-platform" href="${PLATFORM_URL}"><span class="arrow" aria-hidden="true">←</span> Powered by ${esc(PLATFORM_LABEL)}</a>`;
  const siblings = (f.siblings ?? []).map(({ id, label }) => ({ label, v: VERTICALS.find((x) => x.id === id) })).filter((s) => s.v);
  const gateways = isRoot
    ? `<p class="footer-gateways">${VERTICALS.map((v) => `<a href="${v.url}">${esc(v.name)} →</a>`).join("")}</p>`
    : siblings.length
      ? `<p class="footer-gateways">${siblings.map((s) => `<a href="${s.v.url}">${esc(s.label)} →</a>`).join("")}</p>`
      : "";
  const legal = (f.legal ?? [
    ["Privacy Policy", `${ORIGINS.root}/privacy.html`],
    ["Terms of Service", `${ORIGINS.root}/terms.html`],
    ["Data Processing Addendum", `${ORIGINS.root}/dpa.html`],
  ])
    .map(([label, href]) => `<a href="${href}">${esc(label)}</a>`)
    .join("");
  return `<footer class="site-footer">
  <div class="wrap footer-inner">
    <p class="logo logo-footer"><img class="logo-light" src="assets/kadensio-lockup.svg" alt="Kadensio" width="88" height="22" decoding="async"><img class="logo-dark" src="assets/kadensio-lockup-reversed.svg" alt="Kadensio" width="88" height="22" decoding="async"></p>
    <div>
      ${platform}
      <p class="footer-meta">${esc(f.meta)} <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
      ${gateways}
      <p class="footer-legal">${legal}</p>
      <p class="footer-meta">Built by <a href="https://ykhalil.com/">Yassin Khalil</a></p>
    </div>
  </div>
</footer>`;
}

export function page(site, { indexable, header, main, extraBody = "", bodyClass = "" }) {
  return `<!DOCTYPE html>
<html lang="${site.lang}">
${head(site, { indexable })}
<body${bodyClass ? ` class="${bodyClass}"` : ""}>
${ICONS}
<a class="skip" href="#main">Skip to content</a>
${header}
<main id="main">
${main}
</main>
${footer(site)}
${extraBody}
</body>
</html>
`;
}
