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

// Nav menu dropdown: single trigger/panel used at every viewport width (no
// separate mobile hamburger). Toggles on click, closes on outside click,
// Escape, or when a menu item is chosen. No-ops on pages with no nav menu.
(function () {
  var menu = document.querySelector('.nav-menu');
  if (!menu) return;
  var trigger = menu.querySelector('.nav-menu-trigger');
  if (!trigger) return;

  function close() {
    menu.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
  }
  function toggle(e) {
    e.stopPropagation();
    var open = menu.classList.toggle('is-open');
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  trigger.addEventListener('click', toggle);
  document.addEventListener('click', function (e) {
    if (!menu.contains(e.target)) close();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var refocus = menu.classList.contains('is-open') && menu.contains(document.activeElement);
      close();
      if (refocus) trigger.focus();
    }
  });

  // Arrow-key navigation between menu items while the panel is open.
  menu.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    if (!menu.classList.contains('is-open')) return;
    var links = Array.prototype.slice.call(menu.querySelectorAll('.nav-menu-panel a'));
    if (!links.length) return;
    e.preventDefault();
    var i = links.indexOf(document.activeElement);
    var next;
    if (e.key === 'ArrowDown') next = i < 0 ? 0 : (i + 1) % links.length;
    else next = i < 0 ? links.length - 1 : (i - 1 + links.length) % links.length;
    links[next].focus();
  });

  // Cursor-follow spotlight on each menu item: sets --mx/--my (consumed by
  // shared.css's radial-gradient highlight) to the pointer position relative
  // to the hovered link. Pure direct-manipulation hover feedback, not an
  // autoplaying animation, so it isn't gated behind prefers-reduced-motion
  // (same treatment as the rest of the panel's colour/border hover states).
  var panelInner = menu.querySelector('.nav-menu-panel-inner');
  if (panelInner && window.PointerEvent) {
    panelInner.addEventListener('pointermove', function (e) {
      var a = e.target.closest ? e.target.closest('a') : null;
      if (!a) return;
      var r = a.getBoundingClientRect();
      a.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      a.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  }
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
// that don't carry the v2 markup, so pages still on the old .nav-menu dropdown
// are completely unaffected.
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

// 3. Sheet (below 860px): icon-only trigger, no "Menu" label anywhere. Same
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
  window.matchMedia('(min-width:860px)').addEventListener('change', function (e) {
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
