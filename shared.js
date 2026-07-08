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

// Footer mascot: wag + blink on click. No-ops on pages with no footer.
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
})();
