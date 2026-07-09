# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Marketing site for SpotWise Data Group at `spotdg.com` — a static, no-build-step HTML/CSS/JS site (separate from the `neighborhood-momentum` app repo, which serves `app.spotdg.com`). Deployed via Netlify's GitHub integration: a push to `main` triggers an automatic redeploy, no manual build/deploy step.

## Structure

- `index.html` — homepage (founders, product overview, Founding Market Intelligence Program pitch)
- `intelligence/`, `reports/`, `team/`, `sample-report/`, `disclaimer/` — content pages, each a self-contained `index.html` sharing `shared.css`/`shared.js`
- `founding-program/index.html` — Founding Market Intelligence Program application form; the single lead-gen form and the only CTA button anywhere on the site (top nav, every page — "Join Market Intelligence Program →")
- `shared.css` / `shared.js` — shared styling, nav-dropdown behavior, scroll reveals, and form-submission logic
- `_redirects` — Netlify redirect rules; `/request/*` and `/request` 301 to `/founding-program/` (the old "Request a Report" page was removed as a distinct entry point and consolidated into the single Founding Program CTA)

## Nav, Accordion, and Head Tags

- **Nav dropdown** (`shared.css` + `shared.js`): all page links live in a single "Menu" dropdown — a full-width panel that extends down from the header, identical at every viewport width (deliberately no separate mobile hamburger; this fixed a nav-wrap bug on narrow screens). Click toggles it; outside click or Escape closes it (Escape also returns focus to the trigger); Arrow keys move between items. "Join Market Intelligence Program" stays outside the dropdown as the always-visible CTA. The former standalone "How We Score" page/nav item was merged into `sample-report/index.html` (`#how-we-score` anchor).
- **Pricing tier accordion** (`reports/index.html`): the three tier cards (Targeted/Comparative/Portfolio) expand inline on click to show what's-included/who-it's-for/differentiation detail — single-open behavior in `shared.js` (`.price-card[data-tier]`), all three cards stay visible while one is expanded. Cards intentionally show no dollar amounts or pricing line.
- **Open Graph tags**: every page except `founding-program/` has per-page `og:title/description/url` plus a shared `og:image` (`assets/og-image.png`, 1200×630, generated from the mascot + brand fonts). Deliberately no `twitter:` tags — no Twitter/X presence.
- **Plausible analytics**: every page's `<head>` carries the exact proxied snippet (`plausible.io/js/pa-bX3k9X4nnLirx0EZjZW_5.js` + `window.plausible` init). Don't "simplify" it to the generic `plausible.io/js/script.js` + `data-domain` form — the custom-path script is what the account is configured for.

## Form Submission (`shared.js`)

The `founding-program/` form is handled by `spotwiseHandleForm()` in `shared.js` (the function still accepts a second form for historical reasons — the site now only wires up one):

- POSTs to a Formspree endpoint (`FORM_ENDPOINT` constant, set per-page in an inline `<script>` block) as `multipart/form-data` with `Accept: application/json`.
- Live endpoint: `https://formspree.io/f/mlgyvzvq`.
- On `res.ok`, hides the form and reveals `#form-success`. On any failure (non-OK response, network error, or if `FORM_ENDPOINT` still contains the literal string `YOUR_FORM_ID`), it falls back to a pre-filled `mailto:` to all three founders (`sameerkatwala@spotdg.com`, `josephlamonica@spotdg.com`, `andrewgiacomini@spotdg.com`) instead — this fallback only works if the visitor's browser has a default mail client configured to send.
- The form has a hidden `<input type="hidden" name="_subject" value="New Founding Program Application">` so Formspree notification emails arrive pre-labeled instead of a generic subject — Formspree only reads `_subject` from the actual POST body, the JS-side `opts.subject` value is used solely for the mailto fallback and is never sent to Formspree.
- The NDA checkbox (`id="nda"`, `required`, no `novalidate` on the `<form>`) is blocked from submitting by native browser HTML5 validation before the JS `submit` handler ever runs — this is standard browser behavior, not custom validation logic.

**Formspree recipients**: adding/removing notification recipients (e.g. adding Joseph/Andrew alongside Sameer) is done in the Formspree dashboard (Settings → Notifications), not in code — the free plan supports only one recipient per form, multi-recipient requires a paid plan.

**Verifying the endpoint is live** (no browser needed): `curl -sS -X POST https://formspree.io/f/mlgyvzvq -H "Accept: application/json" -F "name=test" -F "email=test@example.com" -F "nda=on"` should return `{"ok":true}`. This proves the backend accepts submissions but does not verify the client-side success-screen render or the checkbox's native-validation block — those require an actual browser.

## Known Gaps

- No automated tests; verification is done by curling the live Formspree endpoint and grepping the deployed HTML (see above), plus a manual browser click-through for anything purely visual/client-side.
- `personal`/other forks are not relevant here — this repo only has `origin`.
