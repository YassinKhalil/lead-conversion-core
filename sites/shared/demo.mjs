// The interactive "Try it now" demo for a vertical site: markup plus one inline
// script (the sites ship no bundler). It talks to the same-origin /api/demo/turn,
// which runs the production questions on a stateless route: nothing is stored
// and nobody is notified. Copy comes from the site's `demo` block.

import { esc } from "./ui.mjs";

const arrow = `<svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg>`;

export function demoSection(d) {
  return `<section class="section section-tint try" id="${esc(d.id)}" aria-labelledby="try-h">
  <div class="wrap">
    <h2 id="try-h" class="try-h">${esc(d.h2)}</h2>
    <p class="lead">${esc(d.lead)}</p>
    <div class="demo">
      <div class="demo-chat" id="demo-chat">
        <div class="demo-head"><span class="demo-dot" aria-hidden="true"></span> ${esc(d.venue)} <span class="demo-tag">Demo</span></div>
        <div class="demo-thread" id="demo-thread" role="log" aria-live="polite" aria-label="${esc(d.threadLabel)}"></div>
        <div class="demo-options" id="demo-options"></div>
        <form class="demo-form" id="demo-form" autocomplete="off">
          <label class="sr-only" for="demo-input">${esc(d.inputLabel)}</label>
          <input class="demo-input" id="demo-input" type="text" maxlength="300" placeholder="${esc(d.placeholder)}" disabled>
          <button class="btn btn-primary" id="demo-send" type="submit" disabled>${esc(d.send)}</button>
        </form>
        <div class="demo-start" id="demo-start">
          <button class="btn btn-primary btn-lg" id="demo-begin" type="button">${esc(d.start)} ${arrow}</button>
        </div>
      </div>
      <div class="demo-result" id="demo-result" aria-live="polite">
        <h3 class="demo-result-h">${esc(d.resultHeading)}</h3>
        <p class="demo-empty" id="demo-empty">${esc(d.empty)}</p>
        <div class="demo-card" id="demo-card" hidden>
          <div class="demo-card-top">
            <span class="demo-temp" id="demo-temp"></span>
            <span class="demo-venue" id="demo-venue"></span>
          </div>
          <dl class="demo-answers" id="demo-answers"></dl>
          <p class="demo-next"><strong>${esc(d.nextLabel)}</strong> <span id="demo-next"></span></p>
          <button class="link-arrow demo-again" id="demo-again" type="button">${esc(d.again)}</button>
        </div>
      </div>
    </div>
    <p class="demo-note">${esc(d.note)}</p>
  </div>
</section>`;
}

export const demoScript = `<script>
(function () {
  'use strict';
  var ENDPOINT = '/api/demo/turn';
  var thread = document.getElementById('demo-thread');
  var optionsBox = document.getElementById('demo-options');
  var form = document.getElementById('demo-form');
  var input = document.getElementById('demo-input');
  var send = document.getElementById('demo-send');
  var start = document.getElementById('demo-start');
  var begin = document.getElementById('demo-begin');
  var empty = document.getElementById('demo-empty');
  var card = document.getElementById('demo-card');
  if (!thread || !begin) return;

  var state = '';
  var busy = false;
  var typingEl = null;

  function bubble(text, who) {
    var el = document.createElement('div');
    el.className = 'bubble bubble-' + who;
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

  function fillSummary(sum) {
    var badge = document.getElementById('demo-temp');
    badge.textContent = sum.status === 'confirmed' ? 'Table held' : 'Sent to the venue';
    badge.className = 'demo-temp demo-temp-' + (sum.status === 'confirmed' ? 'ok' : 'warm');
    document.getElementById('demo-venue').textContent = sum.venue;
    document.getElementById('demo-next').textContent = sum.nextStep;
    var r = sum.reservation;
    var rows = [['Party size', String(r.partySize)], ['Date', r.date], ['Shift', r.shift], ['Zone', r.zone],
      ['Guest language', sum.language], ['Deposit', sum.deposit]];
    var dl = document.getElementById('demo-answers');
    dl.textContent = '';
    for (var i = 0; i < rows.length; i++) {
      if (!rows[i][1]) continue;
      var dt = document.createElement('dt'); dt.textContent = rows[i][0];
      var dd = document.createElement('dd'); dd.textContent = rows[i][1];
      dl.appendChild(dt); dl.appendChild(dd);
    }
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
    fetch(ENDPOINT, {
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
  begin.addEventListener('click', function () { start.hidden = true; turn({}); });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = input.value.trim();
    if (!v || busy) return;
    input.value = '';
    turn({ text: v }, v);
  });
  document.getElementById('demo-again').addEventListener('click', reset);
})();
</script>`;
