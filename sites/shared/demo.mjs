// The interactive "Try it now" demo for a vertical site: markup plus one inline
// script (the sites ship no bundler). It talks to the same-origin /api/demo/turn,
// which runs the production questions on a stateless route: nothing is stored
// and nobody is notified. Copy comes from the site's `demo` block.

import { esc } from "./ui.mjs";

const arrow = `<svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg>`;

export function demoSection(d) {
  const first = d.verticals[0];
  const starts = d.verticals
    .map((v) => `<button class="btn btn-primary btn-lg demo-begin" type="button" data-vertical="${esc(v.id)}">${esc(v.start)} ${arrow}</button>`)
    .join("");
  return `<section class="section section-tint try" id="${esc(d.id)}" aria-labelledby="try-h">
  <div class="wrap">
    <h2 id="try-h" class="try-h">${esc(d.h2)}</h2>
    <p class="lead">${esc(d.lead)}</p>
    <div class="demo">
      <div class="demo-chat" id="demo-chat">
        <div class="demo-head"><span class="demo-dot" aria-hidden="true"></span> <span id="demo-venue-name">${esc(first.venue)}</span> <span class="demo-tag">Demo</span></div>
        <div class="demo-thread" id="demo-thread" role="log" aria-live="polite" aria-label="${esc(d.threadLabel)}"></div>
        <div class="demo-options" id="demo-options"></div>
        <form class="demo-form" id="demo-form" autocomplete="off">
          <label class="sr-only" for="demo-input">${esc(d.inputLabel)}</label>
          <input class="demo-input" id="demo-input" type="text" maxlength="300" placeholder="${esc(d.placeholder)}" disabled>
          <button class="btn btn-primary" id="demo-send" type="submit" disabled>${esc(d.send)}</button>
        </form>
        <div class="demo-start" id="demo-start">${d.pickLabel ? `<p class="demo-pick">${esc(d.pickLabel)}</p>` : ""}<div class="demo-starts">${starts}</div></div>
      </div>
      <div class="demo-result" id="demo-result" aria-live="polite">
        <h3 class="demo-result-h" id="demo-result-h">${esc(first.resultHeading)}</h3>
        <p class="demo-empty" id="demo-empty">${esc(first.empty)}</p>
        <div class="demo-card" id="demo-card" hidden>
          <div class="demo-card-top">
            <span class="demo-temp" id="demo-temp"></span>
            <span class="demo-venue" id="demo-venue" hidden></span>
            <span class="demo-score" id="demo-score-wrap" hidden><span id="demo-score"></span><span class="demo-of">/100</span></span>
          </div>
          <dl class="demo-answers" id="demo-answers"></dl>
          <div id="demo-why" hidden>
            <h4 class="demo-sub">${esc(d.whyLabel ?? "Why this score")}</h4>
            <ul class="demo-factors" id="demo-factors"></ul>
          </div>
          <p class="demo-next"><strong>${esc(d.nextLabel)}</strong> <span id="demo-next"></span></p>
          <button class="link-arrow demo-again" id="demo-again" type="button">${esc(d.again)}</button>
        </div>
      </div>
    </div>
    <p class="demo-note" id="demo-note">${esc(d.note)}</p>
  </div>
</section>`;
}

/** Client script. `d.verticals` carries each industry's endpoint and result copy; one entry means no picker. */
export function demoScript(d) {
  const config = JSON.stringify(
    d.verticals.map((v) => ({ id: v.id, endpoint: v.endpoint, venue: v.venue, resultHeading: v.resultHeading, empty: v.empty })),
  ).replace(/</g, "\\u003c");
  return `<script>
(function () {
  'use strict';
  var VERTICALS = ${config};
  var thread = document.getElementById('demo-thread');
  var optionsBox = document.getElementById('demo-options');
  var form = document.getElementById('demo-form');
  var input = document.getElementById('demo-input');
  var send = document.getElementById('demo-send');
  var start = document.getElementById('demo-start');
  var empty = document.getElementById('demo-empty');
  var card = document.getElementById('demo-card');
  if (!thread || !start) return;

  var current = VERTICALS[0];
  var state = '';
  var busy = false;
  var typingEl = null;

  function bubble(text, who) {
    var el = document.createElement('div');
    el.className = 'bubble bubble-' + who;
    el.dir = 'auto';
    el.textContent = text;
    thread.appendChild(el);
    thread.scrollTop = thread.scrollHeight;
  }
  function showTyping() {
    if (typingEl) return;
    typingEl = document.createElement('div');
    typingEl.className = 'bubble bubble-bot bubble-typing';
    typingEl.setAttribute('aria-label', 'Assistant is typing');
    typingEl.innerHTML = '<span></span><span></span><span></span>';
    thread.appendChild(typingEl);
    thread.scrollTop = thread.scrollHeight;
  }
  function hideTyping() {
    if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
    typingEl = null;
  }
  // A person takes a moment to read and type. Pace the reply to its length,
  // with a little jitter so it does not tick like a metronome.
  function replyDelay(text) {
    return 450 + Math.min((text || '').length * 7, 550) + Math.random() * 200;
  }
  function setBusy(on) {
    busy = on;
    var buttons = optionsBox.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) buttons[i].disabled = on;
  }
  function showOptions(list) {
    optionsBox.textContent = '';
    for (var i = 0; i < list.length; i++) {
      (function (opt) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'demo-opt';
        b.textContent = opt.label;
        b.dir = 'auto';
        b.addEventListener('click', function () { turn({ optionId: opt.id }, opt.label); });
        optionsBox.appendChild(b);
      })(list[i]);
    }
    var free = list.length === 0;
    input.disabled = !free;
    send.disabled = !free;
    form.hidden = !free;
    optionsBox.hidden = free;
    if (free) input.focus();
  }

  function money(n) {
    var v = Number(n);
    if (!isFinite(v) || v <= 0) return n || '';
    return v >= 1000000 ? (v / 1000000) + 'M' : v.toLocaleString('en-US');
  }
  function budgetText(a) {
    if (!a.budgetMax) return '';
    if (Number(a.budgetMax) >= 50000000) return 'Over ' + money(a.budgetMin) + ' EGP';
    if (Number(a.budgetMin) === 0) return 'Under ' + money(a.budgetMax) + ' EGP';
    return money(a.budgetMin) + ' to ' + money(a.budgetMax) + ' EGP';
  }

  var el = function (id) { return document.getElementById(id); };
  function fillRows(rows) {
    var dl = el('demo-answers');
    dl.textContent = '';
    for (var i = 0; i < rows.length; i++) {
      if (!rows[i][1]) continue;
      var dt = document.createElement('dt'); dt.textContent = rows[i][0];
      var dd = document.createElement('dd'); dd.textContent = rows[i][1];
      dl.appendChild(dt); dl.appendChild(dd);
    }
  }

  var RENDER = {
    'real-estate': function (sum) {
      var t = el('demo-temp');
      t.textContent = sum.temperature;
      t.className = 'demo-temp demo-temp-' + sum.temperature;
      el('demo-venue').hidden = true;
      el('demo-score-wrap').hidden = false;
      el('demo-score').textContent = sum.score;
      var a = sum.answers;
      fillRows([['Location', a.location], ['Unit', a.unitType], ['Budget', budgetText(a)],
        ['Payment', a.paymentPlan], ['Down payment', a.downPayment], ['Timeline', a.timeline],
        ['Purpose', a.purpose], ['Site visit', a.siteVisit]]);
      var ul = el('demo-factors');
      ul.textContent = '';
      for (var j = 0; j < sum.factors.length; j++) {
        var f = sum.factors[j];
        var li = document.createElement('li');
        var pts = document.createElement('span'); pts.className = 'demo-pts'; pts.textContent = '+' + f.points;
        li.appendChild(pts);
        li.appendChild(document.createTextNode(' ' + f.reason));
        ul.appendChild(li);
      }
      el('demo-why').hidden = false;
      el('demo-next').textContent = sum.nextStep;
    },
    'clinic': function (sum) {
      var t = el('demo-temp');
      var tag = { hot: 'Urgent', warm: 'Soon', cold: 'Routine' };
      t.textContent = tag[sum.temperature] || sum.temperature;
      t.className = 'demo-temp demo-temp-' + sum.temperature;
      var v = el('demo-venue');
      v.hidden = false;
      v.textContent = sum.clinic;
      el('demo-score-wrap').hidden = false;
      el('demo-score').textContent = sum.score;
      var a = sum.answers;
      fillRows([['Treatment', a.service], ['Patient', a.patientType], ['How soon', a.urgency], ['Time of day', a.timePreference],
        ['Paid', a.coverage], ['Appointment', sum.appointment || 'No slot picked: the team calls'], ['Patient language', sum.language]]);
      var ul = el('demo-factors');
      ul.textContent = '';
      for (var j = 0; j < sum.factors.length; j++) {
        var f = sum.factors[j];
        var li = document.createElement('li');
        var pts = document.createElement('span'); pts.className = 'demo-pts'; pts.textContent = '+' + f.points;
        li.appendChild(pts);
        li.appendChild(document.createTextNode(' ' + f.reason));
        ul.appendChild(li);
      }
      el('demo-why').hidden = false;
      el('demo-next').textContent = sum.nextStep;
    },
    'hospitality': function (sum) {
      var t = el('demo-temp');
      t.textContent = sum.status === 'confirmed' ? 'Table held' : 'Sent to the venue';
      t.className = 'demo-temp demo-temp-' + (sum.status === 'confirmed' ? 'ok' : 'warm');
      var v = el('demo-venue');
      v.hidden = false;
      v.textContent = sum.venue;
      el('demo-score-wrap').hidden = true;
      var r = sum.reservation;
      fillRows([['Party size', String(r.partySize)], ['Date', r.date], ['Shift', r.shift], ['Zone', r.zone],
        ['Guest language', sum.language], ['Deposit', sum.deposit]]);
      el('demo-why').hidden = true;
      el('demo-next').textContent = sum.nextStep;
    }
  };

  function fillSummary(sum) {
    RENDER[current.id](sum);
    empty.hidden = true;
    card.hidden = false;
    card.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  function fail(message) {
    bubble(message, 'error');
    setBusy(false);
  }

  function turn(payload, shown) {
    if (busy) return;
    if (shown) bubble(shown, 'you');
    setBusy(true);
    optionsBox.hidden = true;
    form.hidden = true;
    var body = {};
    if (state) body.state = state;
    if (payload.text !== undefined) body.text = payload.text;
    if (payload.optionId !== undefined) body.optionId = payload.optionId;
    var started = Date.now();
    var typingTimer = setTimeout(showTyping, 200);
    fetch(current.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().then(function (data) { return { res: res, data: data }; });
    }).then(function (r) {
      var ok = r.res.ok && r.data.ok;
      var wait = ok ? Math.max(0, replyDelay(r.data.reply.text) - (Date.now() - started)) : 0;
      return new Promise(function (resolve) { setTimeout(function () { resolve(r); }, wait); });
    }).then(function (r) {
      clearTimeout(typingTimer);
      hideTyping();
      if (!r.res.ok || !r.data.ok) {
        fail(r.res.status === 429 ? 'That is enough for the demo. Reload the page to start again.' : 'The demo is unavailable right now. Please try again in a moment.');
        return;
      }
      state = r.data.state;
      if (r.data.reply.text) bubble(r.data.reply.text, 'bot');
      setBusy(false);
      if (r.data.done) {
        showOptions([]);
        form.hidden = true;
        input.disabled = true; send.disabled = true;
        // Let the closing message be read before the result appears.
        if (r.data.summary) setTimeout(function () { fillSummary(r.data.summary); }, 500);
      } else {
        showOptions(r.data.reply.options || []);
      }
    }).catch(function () {
      clearTimeout(typingTimer);
      hideTyping();
      fail('The demo is unavailable right now. Please try again in a moment.');
    });
  }

  function choose(id) {
    for (var i = 0; i < VERTICALS.length; i++) if (VERTICALS[i].id === id) current = VERTICALS[i];
    el('demo-venue-name').textContent = current.venue;
    el('demo-result-h').textContent = current.resultHeading;
    empty.textContent = current.empty;
    state = '';
    start.hidden = true;
    turn({});
  }

  function reset() {
    state = '';
    hideTyping();
    thread.textContent = '';
    optionsBox.textContent = '';
    card.hidden = true;
    empty.hidden = false;
    start.hidden = false;
    form.hidden = true;
  }

  form.hidden = true;
  optionsBox.hidden = true;
  var begins = document.querySelectorAll('.demo-begin');
  for (var k = 0; k < begins.length; k++) {
    (function (btn) { btn.addEventListener('click', function () { choose(btn.getAttribute('data-vertical')); }); })(begins[k]);
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = input.value.trim();
    if (!v || busy) return;
    input.value = '';
    turn({ text: v }, v);
  });
  el('demo-again').addEventListener('click', reset);
})();
</script>`;
}
