# Architecture — Halden

## Principles
Native OS 2.0 only: Liquid + JSON templates + sections/blocks + section groups. No build step is required to run the theme; `package.json` exists only for dev tooling (Theme Check, tests, packaging) and is excluded from the ZIP via `.shopifyignore` / the package script.

## Directory map
| Path | Role |
| --- | --- |
| `layout/` | `theme.liquid` (skip link, section groups, cart drawer, search dialog, scripts), `password.liquid` |
| `config/` | Global settings + seeded `settings_data.json` (colour schemes) |
| `assets/` | `base.css` (tokens, reset, type, layout, buttons, forms, motion), `components.css`, `sections.css`, small vanilla ES-module-free scripts (custom elements) |
| `sections/` | One file per merchant-facing section; `main-*` for template content; `header-group.json`/`footer-group.json` |
| `snippets/` | Reusable partials (`icon`, `price`, `product-card`, `image`, `pagination`, …) |
| `templates/` | JSON templates (+ alternates), `gift_card.liquid`, customer templates |
| `locales/` | Storefront strings + schema (editor) strings |
| `tools/` | Dev-only validators, tests, packager |

## Design tokens
`snippets/css-variables.liquid` emits `:root` tokens from `settings` and a `.color-<scheme-id>` class per colour scheme. CSS only consumes variables (`--color-*`, `--space-*`, `--font-*`, `--radius-*`, `--dur-*`, `--ease-*`, `--z-*`). Each section picks a scheme (`color_scheme` setting) and adds the class.

## JavaScript
Custom elements, loaded with `defer`, no libraries.
- `global.js`: `window.Halden` helpers (focus trap fallback, debounce, fetch wrappers, announce), `<reveal-on-scroll>` behaviour (single shared IntersectionObserver), parallax, `<modal-dialog>` (native `<dialog>` with animated close), accordion enhancement.
- `header.js`: sticky/transparent state, mega-menu disclosure, mobile menu drawer, header height var.
- `cart.js`: `<cart-drawer>`, `<cart-items>`, quantity/remove, `<product-form>` add-to-cart. Uses `/cart/add.js`, `/cart/change.js`, `/cart.js` and the Section Rendering API (`sections=cart-drawer`).
- `product.js`: `<variant-picker>` (Section Rendering `?variant=&section_id=`), `<product-gallery>`, sticky bar, lightbox.
- `search.js`: `<predictive-search>` using `/search/suggest?section_id=predictive-search`.
- `facets.js`: `<facet-form>` progressive enhancement over real GET filter URLs via Section Rendering.
All server HTML is same-origin Shopify Section Rendering output, parsed with `DOMParser`; user-supplied strings are only ever inserted with `textContent`.

## Motion system
CSS-driven. `[data-reveal]` elements are visible by default; `html.js-anim` (set by an inline-free `theme.liquid` snippet-less class toggle in `global.js` *before* first paint is **not** used — instead elements start hidden only inside `@media (scripting: enabled)` and `body[data-animations="on"]`, so no-JS and JS-failure paths stay visible). Reduced-motion media query and the `animations` theme setting both neutralise decorative motion.

## Commerce correctness rules
- Variant id always from `name="id"` input; JS updates it from Section Rendering result.
- Cart mutations only via documented endpoints; UI rebuilt from server-rendered section HTML.
- Filtering/sorting only via `collection.filters` / `sort_by` URL params.
- Product JSON-LD only via `{{ product | structured_data }}`; no duplicates elsewhere.
