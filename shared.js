// Shared submit handler for SpotWise marketing forms (/request, /founding-program).
// Attempts POST to a form backend (Formspree/Tally); falls back to a pre-filled
// mailto: to all three founders if no backend endpoint has been configured yet,
// or if the POST fails for any reason.
function spotwiseHandleForm(form, opts) {
  var MAILTO = 'sameerkatwala@spotdg.com,josephlamonica@spotdg.com,andrewgiacomini@spotdg.com';

  function buildMailtoUrl(data) {
    var lines = [];
    opts.fields.forEach(function (f) {
      var val = (data.get(f.name) || '').toString().trim();
      if (val) lines.push(f.label + ': ' + val);
    });
    var body = encodeURIComponent(lines.join('\n'));
    var subject = encodeURIComponent(opts.subject);
    return 'mailto:' + MAILTO + '?subject=' + subject + '&body=' + body;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = new FormData(form);
    var submitBtn = form.querySelector('button[type="submit"]');
    var endpoint = opts.endpoint;
    var noBackendYet = !endpoint || endpoint.indexOf('YOUR_FORM_ID') !== -1;

    if (noBackendYet) {
      window.location.href = buildMailtoUrl(data);
      return;
    }

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending...'; }

    fetch(endpoint, { method: 'POST', headers: { 'Accept': 'application/json' }, body: data })
      .then(function (res) {
        if (res.ok) {
          form.style.display = 'none';
          var success = document.getElementById('form-success');
          if (success) {
            success.style.display = 'block';
            var iconWrap = success.querySelector('.success-icon-wrap');
            if (iconWrap) iconWrap.classList.add('celebrate');
          }
        } else {
          window.location.href = buildMailtoUrl(data);
        }
      })
      .catch(function () {
        window.location.href = buildMailtoUrl(data);
      })
      .finally(function () {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = opts.submitLabel || 'Submit'; }
      });
  });
}

// ---------------------------------------------------------------------------
// Motion module (paper redesign, 2026-09-22). Every effect here honors
// prefers-reduced-motion (skipped outright -- the real value is already the
// element's rendered content/state, so nothing is left blank) and runs once
// per element, never in a loop. `SpotwiseMotion.once` is the shared "observe
// until first intersection, then disconnect" primitive that count-up below,
// and the page-specific chart/map setup in index.html, both build on.
// ---------------------------------------------------------------------------
var SpotwiseMotion = (function () {
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function once(el, threshold, fn) {
    if (!el || reduced) return;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { fn(); obs.disconnect(); }
      });
    }, { threshold: threshold });
    obs.observe(el);
  }

  // Number count-up: any element with data-target counts from 0 to that
  // value over 900ms the first time it's 40% in view. Optional data-prefix /
  // data-suffix / data-format="comma". Digits are tabular-nums via the
  // .mono-num CSS class, not set here. Reused by the home stat row and the
  // sample document's score -- any future number just needs the attribute.
  function countUp(root) {
    (root || document).querySelectorAll('[data-target]').forEach(function (el) {
      var target = parseFloat(el.dataset.target);
      if (isNaN(target) || reduced) return; // real value already sits in the markup
      once(el, 0.4, function () {
        var start = performance.now(), dur = 900;
        var prefix = el.dataset.prefix || '', suffix = el.dataset.suffix || '';
        function fmt(v) {
          var n = el.dataset.format === 'comma' ? Math.round(v).toLocaleString('en-US') : v.toFixed(1);
          return prefix + n + suffix;
        }
        function step(now) {
          var p = Math.min((now - start) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = fmt(target * eased);
          if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      });
    });
  }

  return { once: once, countUp: countUp, reducedMotion: reduced };
})();
SpotwiseMotion.countUp();

// Fades/slides in each major section once as it scrolls into view, when 15%
// of it has entered the viewport (12px rise, not the old 28px -- see
// shared.css .reveal). Safe by construction: the CSS that hides .reveal
// elements is scoped under html.js (added by a capability-check script in
// each page's <head>), which is only ever added when prefers-reduced-motion
// is off AND IntersectionObserver exists -- so this either runs correctly,
// or the elements were never hidden in the first place. No-ops on pages
// with no .reveal elements.
(function () {
  if (!document.documentElement.classList.contains('js')) return;
  var els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.15 });
  els.forEach(function (el) { obs.observe(el); });
})();

// FAQ accordion retired 2026-09-23: /faq was the only consumer of the old
// .faq-item[data-faq]/.faq-trigger JS-driven accordion, and it now uses plain
// <details open> (see shared.css .faq-item) -- native disclosure handles
// toggling with no script. No replacement needed.

// Floating CTA pill removed 2026-09-22: it was a second, pill-shaped instance
// of the nav CTA, and pills are gone sitewide in the paper redesign (see
// shared.css). The nav CTA and each page's in-page CTAs are the only calls
// to action now; no replacement was added.

// Footer mascot: wag + blink on click, plus an ambient idle blink so it reads as
// alive rather than purely reactive. No-ops on pages with no footer.
(function () {
  var spot = document.querySelector('.spot-interactive');
  if (!spot) return;
  var timer = null;
  spot.addEventListener('click', function () {
    spot.classList.remove('wagging');
    void spot.offsetWidth;
    spot.classList.add('wagging', 'blinking');
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () { spot.classList.remove('wagging', 'blinking'); }, 650);
  });

  // Ambient idle blink: every few seconds, on a randomized interval so it feels
  // natural. Purely decorative unprompted motion, so it's gated behind
  // !prefers-reduced-motion. Skips a beat whenever the mascot is mid-wag or
  // hovered (both already show the blink face) so ambient and interaction never
  // fight, and never strips .blinking out from under an in-progress click wag.
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    (function scheduleBlink() {
      setTimeout(function () {
        if (!spot.classList.contains('wagging') && !spot.matches(':hover')) {
          spot.classList.add('blinking');
          setTimeout(function () {
            if (!spot.classList.contains('wagging')) spot.classList.remove('blinking');
          }, 150);
        }
        scheduleBlink();
      }, 3200 + Math.random() * 2600);
    })();
  }
})();

// ---------------------------------------------------------------------------
// Nav (paper redesign, 2026-09-22): the current-page indicator is now a
// plain CSS underline (.nav-tabs a.active in shared.css) and the header is a
// static sticky style with no scroll-condense state, so the two modules that
// used to live here -- a sliding "signal rail" indicator, and a condense/
// scroll-depth-bar toggle -- were removed rather than re-themed. The one
// piece still needed below 1100px is the sheet (icon-only trigger, tabs
// slide down), unchanged from before.
// ---------------------------------------------------------------------------

// Sheet: icon-only trigger, no "Menu" label anywhere. Same interaction
// contract the old dropdown had -- click toggles, outside click and Escape
// close, Escape returns focus to the trigger, arrow keys move between items
// -- so nothing a returning visitor knew has been taken away.
(function () {
  var sheet = document.querySelector('.nav-sheet');
  if (!sheet) return;
  var trigger = sheet.querySelector('.nav-sheet-trigger');
  var panel = sheet.querySelector('.nav-sheet-panel');
  if (!trigger || !panel) return;

  function close() {
    sheet.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
  }
  trigger.addEventListener('click', function (e) {
    e.stopPropagation();
    var open = sheet.classList.toggle('is-open');
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.addEventListener('click', function (e) {
    if (!sheet.contains(e.target)) close();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var refocus = sheet.classList.contains('is-open') && sheet.contains(document.activeElement);
    close();
    if (refocus) trigger.focus();
  });
  sheet.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    if (!sheet.classList.contains('is-open')) return;
    var links = Array.prototype.slice.call(panel.querySelectorAll('a'));
    if (!links.length) return;
    e.preventDefault();
    var i = links.indexOf(document.activeElement);
    var next;
    if (e.key === 'ArrowDown') next = i < 0 ? 0 : (i + 1) % links.length;
    else next = i < 0 ? links.length - 1 : (i - 1 + links.length) % links.length;
    links[next].focus();
  });
  // Leaving the sheet breakpoint while it's open would otherwise strand the
  // open state on a layout that no longer shows the panel.
  window.matchMedia('(min-width:900px)').addEventListener('change', function (e) {
    if (e.matches) close();
  });
})();

// ---------------------------------------------------------------------------
// Copy-to-clipboard for email addresses. Pairs with the Gmail compose link
// beside it: the link covers webmail users, this covers everyone else, and
// between them nobody is left clicking a dead mailto:.
// Falls back to a hidden textarea + execCommand on browsers without the async
// clipboard API, and on insecure origins where navigator.clipboard is absent.
// No-op on pages with no copy buttons.
// ---------------------------------------------------------------------------
(function () {
  var buttons = document.querySelectorAll('.mail-copy[data-copy]');
  if (!buttons.length) return;

  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function flash(btn) {
    btn.classList.add('is-copied');
    if (btn._t) clearTimeout(btn._t);
    btn._t = setTimeout(function () { btn.classList.remove('is-copied'); }, 1600);
  }

  Array.prototype.forEach.call(buttons, function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var text = btn.getAttribute('data-copy');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { flash(btn); },
                                                 function () { if (legacyCopy(text)) flash(btn); });
      } else if (legacyCopy(text)) {
        flash(btn);
      }
    });
  });
})();
