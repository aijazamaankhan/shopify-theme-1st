# Testing Plan

Honest scope: no Shopify store, Shopify CLI or shopify.dev access in the build environment. Anything needing live Shopify data is listed as **manual** and is not claimed as tested.

| # | Check | Method | Automatable here |
|---|---|---|---|
| 1 | Theme structure | `tools/validate-theme.mjs` (required files, templates ↔ sections) | yes |
| 2 | Liquid / Theme Check | `@shopify/theme-check-node` w/ official docs data | yes |
| 3 | JSON validity | validate script parses all `.json` | yes |
| 4 | Settings/section schema | Theme Check `ValidSchema*` rules + official `theme-liquid-docs` JSON schemas | yes |
| 5 | Missing assets/snippets/sections | validate script + Theme Check `MissingAsset`, `UnknownFilter` etc. | yes |
| 6 | Translations | Theme Check `TranslationKeyExists`, `UnusedTranslation`; validate script (schema `t:` keys) | yes |
| 7 | JS logic | `node --test` unit tests for pure helpers (debounce, price/qty clamp, section-HTML parsing via jsdom-free fakes) | yes |
| 8 | JS syntax / console errors | `node --check`; Playwright loads assets in a stub page and records console errors | partial |
| 9 | Responsive/overflow | Playwright on a static stub page of the CSS (tokens + components) at 320…1920 px | partial |
| 10 | Reduced motion | Playwright `reducedMotion: 'reduce'` on the stub page | partial |
| 11 | Variant change, add to cart, cart update/remove, search, filters, pagination, sold-out, forms, Theme Editor | Requires live store | **manual** |
| 12 | Lighthouse / CWV | Requires deployed theme | **manual** |

Results are recorded in `TESTING.md` only after being run.
