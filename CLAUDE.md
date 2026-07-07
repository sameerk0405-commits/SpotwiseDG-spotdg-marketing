# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Marketing site for SpotWise Data Group at `spotdg.com` — a static, no-build-step HTML/CSS/JS site (separate from the `neighborhood-momentum` app repo, which serves `app.spotdg.com`). Deployed via Netlify's GitHub integration: a push to `main` triggers an automatic redeploy, no manual build/deploy step.

## Structure

- `index.html` — homepage (founders, product overview, Founding Market Intelligence Program pitch)
- `request/index.html` — "Request a Market Signal Report" lead form
- `founding-program/index.html` — Founding Market Intelligence Program application form
- `shared.css` / `shared.js` — shared styling and form-submission logic used by both form pages

## Form Submission (`shared.js`)

Both `request/` and `founding-program/` forms are handled by `spotwiseHandleForm()` in `shared.js`:

- POSTs to a Formspree endpoint (`FORM_ENDPOINT` constant, set per-page in an inline `<script>` block) as `multipart/form-data` with `Accept: application/json`.
- Live endpoint: `https://formspree.io/f/mlgyvzvq` (shared by both forms, one Formspree form/inbox for both).
- On `res.ok`, hides the form and reveals `#form-success`. On any failure (non-OK response, network error, or if `FORM_ENDPOINT` still contains the literal string `YOUR_FORM_ID`), it falls back to a pre-filled `mailto:` to all three founders (`sameerkatwala@spotdg.com`, `josephlamonica@spotdg.com`, `andrewgiacomini@spotdg.com`) instead — this fallback only works if the visitor's browser has a default mail client configured to send.
- Each form has a hidden `<input type="hidden" name="_subject" value="...">` so Formspree notification emails arrive pre-labeled ("New Market Signal Report Request" / "New Founding Program Application") instead of a generic subject — Formspree only reads `_subject` from the actual POST body, the JS-side `opts.subject` value is used solely for the mailto fallback and is never sent to Formspree.
- The NDA checkbox (`id="nda"`, `required`, no `novalidate` on the `<form>`) is blocked from submitting by native browser HTML5 validation before the JS `submit` handler ever runs — this is standard browser behavior, not custom validation logic.

**Formspree recipients**: adding/removing notification recipients (e.g. adding Joseph/Andrew alongside Sameer) is done in the Formspree dashboard (Settings → Notifications), not in code — the free plan supports only one recipient per form, multi-recipient requires a paid plan.

**Verifying the endpoint is live** (no browser needed): `curl -sS -X POST https://formspree.io/f/mlgyvzvq -H "Accept: application/json" -F "name=test" -F "email=test@example.com" -F "nda=on"` should return `{"ok":true}`. This proves the backend accepts submissions but does not verify the client-side success-screen render or the checkbox's native-validation block — those require an actual browser.

## Known Gaps

- No automated tests; verification is done by curling the live Formspree endpoint and grepping the deployed HTML (see above), plus a manual browser click-through for anything purely visual/client-side.
- `personal`/other forks are not relevant here — this repo only has `origin`.
