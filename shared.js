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
          // The step indicator describes a form that is no longer on screen --
          // leaving it up reads as "you still have steps left" next to a
          // success message. Hidden alongside the form it belongs to.
          var progress = document.querySelector('.form-progress');
          if (progress) progress.style.display = 'none';
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

// Fades/slides in each major section once as it scrolls into view. Safe by
// construction: the CSS that hides .reveal elements is scoped under html.js
// (added by a capability-check script in each page's <head>), which is only
// ever added when prefers-reduced-motion is off AND IntersectionObserver
// exists -- so this either runs correctly, or the elements were never
// hidden in the first place. No-ops on pages with no .reveal elements.
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
  }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
  els.forEach(function (el) { obs.observe(el); });
})();


// Pricing tier accordion (/reports): click a card to expand its detail panel
// inline; the other cards stay visible and unexpanded so all three remain
// comparable side by side. Opening one closes any other that's open.
// No-ops on pages with no pricing cards.
(function () {
  var cards = document.querySelectorAll('.price-card[data-tier]');
  if (!cards.length) return;

  cards.forEach(function (card) {
    var trigger = card.querySelector('.price-card-trigger');
    if (!trigger) return;
    trigger.addEventListener('click', function () {
      var isOpen = card.classList.contains('is-open');
      cards.forEach(function (other) {
        other.classList.remove('is-open');
        var otherTrigger = other.querySelector('.price-card-trigger');
        if (otherTrigger) otherTrigger.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        card.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });
  });
})();

// FAQ accordion (/contact): same expand/collapse mechanics as the pricing
// tier accordion, but each question toggles independently since multiple
// answers may be worth comparing at once. No-ops on pages with no FAQ.
(function () {
  var items = document.querySelectorAll('.faq-item[data-faq]');
  if (!items.length) return;

  items.forEach(function (item) {
    var trigger = item.querySelector('.faq-trigger');
    if (!trigger) return;
    trigger.addEventListener('click', function () {
      var isOpen = item.classList.toggle('is-open');
      trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  });
})();

// Floating CTA pill: a second *instance* of the site's single call-to-action
// (Join the Program -> founding-program page), injected on every page that has
// the nav CTA and shown once the visitor scrolls past the hero. Reads its href
// from the existing .nav-cta so relative paths stay correct per page, and
// naturally no-ops on /founding-program (which has no nav CTA — you're already
// there). Never introduces a second CTA destination.
(function () {
  var navCta = document.querySelector('.nav-cta');
  if (!navCta) return;
  var pill = document.createElement('a');
  pill.className = 'float-cta';
  pill.href = navCta.getAttribute('href');
  pill.textContent = 'Join the Program →';
  document.body.appendChild(pill);
  var ticking = false;
  function update() {
    ticking = false;
    if (window.scrollY > 560) pill.classList.add('is-on');
    else pill.classList.remove('is-on');
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
})();

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
// Nav v2: exposed tab rail. Three independent pieces, each a no-op on pages
// that don't carry the v2 markup -- which now means only /founding-program,
// whose stripped header is deliberate. The old dropdown module is gone.
// ---------------------------------------------------------------------------

// 1. Signal Rail -- one indicator that slides and resizes to the hovered tab,
// resting under the current page's tab (or hidden, on pages with no tab of
// their own, e.g. the homepage). Only transform/width animate, so this stays
// on the compositor. Under prefers-reduced-motion the CSS drops the transition
// but the rail still tracks correctly -- it just moves instantly.
(function () {
  var tabs = document.querySelector('.nav-tabs');
  if (!tabs) return;
  var rail = tabs.querySelector('.nav-rail');
  if (!rail) return;
  var links = Array.prototype.slice.call(tabs.querySelectorAll('a'));
  if (!links.length) return;
  var active = tabs.querySelector('a.active');

  rail.innerHTML =
    '<svg viewBox="0 0 100 9" preserveAspectRatio="none" aria-hidden="true">' +
    '<path class="rail-base" d="M1 7 L99 7" vector-effect="non-scaling-stroke"/>' +
    '<path class="rail-line" d="M1 7 L42 7 C64 7 70 2.4 97 2" vector-effect="non-scaling-stroke"/>' +
    '<circle class="rail-halo" cx="97" cy="2" r="3.4" vector-effect="non-scaling-stroke"/>' +
    '<circle class="rail-node" cx="97" cy="2" r="1.9" vector-effect="non-scaling-stroke"/>' +
    '</svg>';

  function moveTo(el, show) {
    if (!el) {
      rail.classList.remove('is-on');
      return;
    }
    rail.style.width = el.offsetWidth + 'px';
    rail.style.transform = 'translateX(' + el.offsetLeft + 'px)';
    if (show !== false) rail.classList.add('is-on');
  }
  function rest() { moveTo(active, !!active); }

  links.forEach(function (a) {
    a.addEventListener('mouseenter', function () { moveTo(a); });
    a.addEventListener('focus', function () { moveTo(a); });
  });
  tabs.addEventListener('mouseleave', rest);
  tabs.addEventListener('focusout', function (e) {
    if (!tabs.contains(e.relatedTarget)) rest();
  });

  // Fonts land after first paint and change tab widths, so re-measure once
  // they're ready as well as on resize.
  rest();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(rest);
  var rafId = null;
  window.addEventListener('resize', function () {
    if (rafId) return;
    rafId = requestAnimationFrame(function () { rafId = null; rest(); });
  });
})();

// 2. Condensing header + scroll-depth bar. One class toggle drives every
// condensed-state property in CSS; the depth bar is a scaleX transform so it
// never triggers layout. Hysteresis (80 down / 40 up) keeps the header from
// flickering when a scroll lands right on the threshold.
(function () {
  var header = document.querySelector('header.hdr2');
  if (!header) return;
  var bar = header.querySelector('.nav-progress');
  var ticking = false;
  var condensed = false;

  function update() {
    ticking = false;
    var y = window.scrollY || document.documentElement.scrollTop;
    if (!condensed && y > 80) { condensed = true; header.classList.add('is-condensed'); }
    else if (condensed && y < 40) { condensed = false; header.classList.remove('is-condensed'); }
    if (bar) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(y / max, 1) : 0;
      bar.style.transform = 'scaleX(' + p + ')';
    }
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();
})();

// 3. Sheet (below 900px): icon-only trigger, no "Menu" label anywhere. Same
// interaction contract the old dropdown had -- click toggles, outside click
// and Escape close, Escape returns focus to the trigger, arrow keys move
// between items -- so nothing a returning visitor knew has been taken away.
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
// Scroll-linked spotlight (/sample-report): as a guide section scrolls into
// the reading zone, the part of the sticky report card it describes lights up.
// Hovering or keyboard-focusing an individual ratio card lights that one ratio.
//
// Driven by markup, not hardcoded selectors: any element with data-lights="a b"
// lights every [data-spot="a"], [data-spot="b"] inside the same container. No-op
// on pages with no [data-spot], so it costs nothing anywhere else.
// ---------------------------------------------------------------------------
(function () {
  var root = document.querySelector('.demo');
  if (!root) return;
  var spots = root.querySelectorAll('[data-spot]');
  var sources = root.querySelectorAll('[data-lights]');
  if (!spots.length || !sources.length) return;

  // Below this the card is static and sits above the guide, so lighting it
  // would highlight something already scrolled off screen.
  var wide = window.matchMedia('(min-width:1081px)');

  // Sections (the scroll-driven layer) vs cards (the hover-driven layer).
  var sections = [], cards = [];
  Array.prototype.forEach.call(sources, function (el) {
    (el.classList.contains('ratio-explain-card') ? cards : sections).push(el);
  });

  function keysOf(el) { return (el.getAttribute('data-lights') || '').split(/\s+/).filter(Boolean); }

  var scrollKeys = [], hoverKeys = null;

  // The card is capped to the viewport and scrolls internally, so a spot can be
  // lit while sitting outside the card's own visible area. Bring the first lit
  // spot into view within the card -- never via scrollIntoView, which would also
  // scroll the page and fight the reader.
  var scroller = root.querySelector('.demo-card-col');
  function revealInCard(el) {
    if (!scroller || !el) return;
    if (scroller.scrollHeight <= scroller.clientHeight + 1) return;
    var sr = scroller.getBoundingClientRect(), er = el.getBoundingClientRect();
    var pad = 24, delta = 0;
    if (er.top < sr.top + pad) delta = er.top - sr.top - pad;
    else if (er.bottom > sr.bottom - pad) delta = er.bottom - sr.bottom + pad;
    if (!delta) return;
    var target = scroller.scrollTop + delta;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !scroller.scrollTo) {
      scroller.scrollTop = target;
    } else {
      scroller.scrollTo({ top: target, behavior: 'smooth' });
    }
  }

  function paint() {
    var active = hoverKeys || scrollKeys;
    var first = null;
    Array.prototype.forEach.call(spots, function (s) {
      var on = active.indexOf(s.getAttribute('data-spot')) !== -1;
      s.classList.toggle('is-lit', on);
      if (on && !first) first = s;
    });
    revealInCard(first);
  }
  function clearAll() {
    Array.prototype.forEach.call(spots, function (s) { s.classList.remove('is-lit'); });
  }

  // The section whose top has most recently passed the reading line is the one
  // being read. Falls back to the first section before any has passed it.
  function recomputeScroll() {
    if (!wide.matches) { scrollKeys = []; return; }
    var line = window.innerHeight * 0.42;
    var chosen = null;
    sections.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top <= line && r.bottom > 0) chosen = el;
    });
    if (!chosen) {
      var first = sections[0];
      if (first && first.getBoundingClientRect().top > line) chosen = null;
    }
    scrollKeys = chosen ? keysOf(chosen) : [];
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      recomputeScroll();
      paint();
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  cards.forEach(function (card) {
    function enter() { if (!wide.matches) return; hoverKeys = keysOf(card); paint(); }
    function leave() { hoverKeys = null; paint(); }
    card.addEventListener('mouseenter', enter);
    card.addEventListener('focus', enter);
    card.addEventListener('mouseleave', leave);
    card.addEventListener('blur', leave);
  });

  wide.addEventListener('change', function (e) {
    if (!e.matches) { hoverKeys = null; clearAll(); }
    else onScroll();
  });

  recomputeScroll();
  paint();
})();

// ---------------------------------------------------------------------------
// Founding-program form progress. Pairs each .fp-step with the fields that sit
// between its .form-step heading and the next one, then derives:
//   done   -- every required field in that group passes checkValidity()
//   active -- the group holding focus, else the last group scrolled past
// "Done" is computed from the fields, never from scroll position, so the
// indicator can't tell someone a step is complete when it isn't.
// No-op on pages without .form-progress.
// ---------------------------------------------------------------------------
(function () {
  var bar = document.querySelector('.form-progress');
  var form = document.getElementById('founding-form');
  if (!bar || !form) return;

  var pips = Array.prototype.slice.call(bar.querySelectorAll('.fp-step'));
  var heads = Array.prototype.slice.call(form.querySelectorAll('.form-step'));
  if (!pips.length || heads.length !== pips.length) return;

  // Walk siblings after each heading until the next heading; collect fields.
  var groups = heads.map(function (head) {
    var fields = [], n = head.nextElementSibling;
    while (n && !n.classList.contains('form-step')) {
      if (n.matches('input,select,textarea')) fields.push(n);
      Array.prototype.push.apply(fields, n.querySelectorAll('input,select,textarea'));
      n = n.nextElementSibling;
    }
    return {
      head: head,
      fields: fields.filter(function (f) { return f.type !== 'hidden'; })
    };
  });

  function isDone(g) {
    var required = g.fields.filter(function (f) { return f.required; });
    if (!required.length) {
      // A group with no required fields counts as done once something in it
      // has been filled -- otherwise it could never register progress.
      return g.fields.some(function (f) { return String(f.value || '').trim() !== ''; });
    }
    return required.every(function (f) { return f.checkValidity(); });
  }

  function activeIndex() {
    var el = document.activeElement;
    if (el && form.contains(el)) {
      for (var i = 0; i < groups.length; i++) {
        if (groups[i].fields.indexOf(el) !== -1) return i;
      }
    }
    var line = window.innerHeight * 0.35, idx = 0;
    groups.forEach(function (g, i) {
      if (g.head.getBoundingClientRect().top <= line) idx = i;
    });
    return idx;
  }

  function update() {
    var act = activeIndex();
    groups.forEach(function (g, i) {
      var done = isDone(g);
      pips[i].classList.toggle('is-done', done);
      // Done wins over active: a completed step you're still sitting in should
      // read as complete, not as merely current.
      pips[i].classList.toggle('is-active', !done && i === act);
    });
  }

  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('focusin', update);
  form.addEventListener('focusout', update);

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; update(); });
  }, { passive: true });

  update();
})();

// ---------------------------------------------------------------------------
// Section rail (/intelligence): marks which section you're in and jumps to the
// others. Reads its targets from its own hrefs, so adding a section is a markup
// change only. No-op on pages without .sec-rail.
// ---------------------------------------------------------------------------
(function () {
  var rail = document.querySelector('.sec-rail');
  if (!rail) return;
  var links = Array.prototype.slice.call(rail.querySelectorAll('a[href^="#"]'));
  if (!links.length) return;

  var pairs = links.map(function (a) {
    return { link: a, section: document.querySelector(a.getAttribute('href')) };
  }).filter(function (p) { return p.section; });
  if (!pairs.length) return;

  var ticking = false;
  function update() {
    ticking = false;
    // The section that most recently crossed the reading line wins; before any
    // has, the first one is current rather than none.
    var line = window.innerHeight * 0.4, current = pairs[0];
    pairs.forEach(function (p) {
      if (p.section.getBoundingClientRect().top <= line) current = p;
    });
    pairs.forEach(function (p) {
      var on = p === current;
      p.link.classList.toggle('active', on);
      if (on) p.link.setAttribute('aria-current', 'true');
      else p.link.removeAttribute('aria-current');
    });
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();
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
