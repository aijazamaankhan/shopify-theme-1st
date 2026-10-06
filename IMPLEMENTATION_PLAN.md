# Implementation Plan — Halden (premium Shopify OS 2.0 theme)

Status legend: [x] done · [~] in progress · [ ] planned

## Phase 1 — Inspection & planning
- [x] Repo was empty (single-line README). Greenfield build, theme lives at repo root.
- [x] Tooling found: Node 22, npm, Ruby, Chromium + Playwright. Shopify CLI and a dev store are **not** available; `shopify.dev` is network-blocked, `raw.githubusercontent.com` (Shopify/theme-liquid-docs) is reachable.
- [x] Validation approach: `@shopify/theme-check-node` (same engine as Shopify CLI `theme check`) against the official `theme-liquid-docs` data, plus custom structural checks (`tools/validate-theme.mjs`), plus Playwright smoke tests against a **static Liquid-less harness only where meaningful** (see TESTING_PLAN.md).

## Phase 2 — Foundation
- [ ] `layout/theme.liquid`, `layout/password.liquid`
- [ ] `config/settings_schema.json`, `config/settings_data.json` (colour schemes, type, layout, motion, cards, cart, social)
- [ ] `snippets/css-variables.liquid` design tokens, `assets/base.css`
- [ ] `locales/en.default.json` + `en.default.schema.json`
- [ ] Header (+ mega menu, mobile drawer, search, cart count), announcement bar, footer, header/footer groups
- [ ] Core JS: `global.js` (a11y helpers, dialog, reveal, parallax), `header.js`

## Phase 3 — Homepage & motion
- [ ] Hero, collection list, featured collection, editorial, collage, banner, split, marquee, values, comparison, testimonials, logos, rich text, video, before/after, blog, newsletter, FAQ, custom liquid, spacer, recently viewed
- [ ] Reveal / parallax / hero intro via IntersectionObserver + CSS; reduced-motion + theme switch

## Phase 4 — Commerce
- [ ] Product (gallery, variants, buy buttons, sticky bar, accordions, recommendations), collection (filters/sort/pagination), search + predictive, cart page + drawer, account templates, blog/article/page/404/password/gift card

## Phase 5 — Customisation
- [ ] Settings review, presets, block types, templates (alt layouts)

## Phase 6 — QA
- [ ] Theme Check, JSON/schema validation, reference checks, translation checks, JS unit tests, browser checks that are possible without a store

## Phase 7 — Packaging & docs
- [ ] Docs set, release checklist, ZIP via `npm run package`

## Risks / unknowns
| Risk | Mitigation |
| --- | --- |
| No Shopify store/CLI → Liquid cannot be rendered with real data | Theme Check static analysis; Liquid parse check; clearly report as untested against a live store |
| Font handles cannot be verified offline | Use common library handles; document |
| `:has()`-based sticky/transparent header | Progressive enhancement; degrades to static header |
| Theme Store requirements unreadable (shopify.dev blocked) | Do **not** claim compliance; checklist lists items to verify manually |
