# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Marketing site for SpotWise Data Group at `spotdg.com` — a static, no-build-step HTML/CSS/JS site (separate from the `neighborhood-momentum` app repo, which serves `app.spotdg.com`). Deployed via Netlify's GitHub integration: a push to `main` triggers an automatic redeploy, no manual build/deploy step.

## Structure

- `index.html` — homepage (founders, product overview, Founding Market Intelligence Program pitch)
- `founding-program/index.html` — Founding Market Intelligence Program application form; the single lead-gen form and the only CTA button anywhere on the site (top nav, every page — "Join Market Intelligence Program →")
- `shared.css` / `shared.js` — shared styling and form-submission logic
- `_redirects` — Netlify redirect rules; `/request/*` and `/request` 301 to `/founding-program/` (the old "Request a Report" page was removed as a distinct entry point and consolidated into the single Founding Program CTA)

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
