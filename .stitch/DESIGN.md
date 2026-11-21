# Design System: Gcome SaaS Admin (Miss Sensuelle)
**Reference Source:** Stitch Workspace Guidelines (`.agents/skills/design-md`, `react-vite-dashboard`) + User Reference Mockup (`3-Screen Mobile Concept`)

## 1. Visual Theme & Atmosphere
- **Mood:** Bright, luminous, pearl-lavender mobile-first SaaS aesthetic ("Airy & Elevated" in light mode, midnight violet depth in dark mode).
- **Canvas Philosophy:** The central canvas stays crisp pearl-lavender white (`#F5F3FF` -> `#FFFFFF`) so elevated pure-white cards and interactive controls breathe effortlessly, while vibrant purple-violet and sun-gold organic ribbon curves remain confined to outer corner edges (top-left/top-right corner waves and the bottom framing wave cradling the floating dock).

## 2. Color Palette & Roles
- **Pearl Mist Canvas (`#F5F3FF`)** — Main screen center canvas background (light mode), subtle shift to **`#F8F7FF`** in upper content areas and **`#EFEAFF`** inside the open Menu drawer sheet for crisp card contrast.
- **Pure Elevated Surface (`#FFFFFF`)** — KPI cards, flux order cards, search capsule, date selector, menu item pills, and the floating bottom navigation dock.
- **Lavender Tint Surface (`#F6F3FF`)** — Recessed inner blocks (client detail box, product breakdown wrapper) inside order cards.
- **Royal Indigo Primary (`#5B21B6` to `#7C3AED`)** — Primary CTAs (`Confirmer la commande`, `+ Commande`, `+ Nouvelle commande`), active tab pills, call action capsule, and Gcome Pro card base.
- **Sun Gold Accent (`#FACC15` to `#F59E0B`)** — Secondary corner wave accents, Crown mark above Gcome brand, and golden hero/Pro CTA pills (`Découvrir Gcome`, `Découvrir`).
- **Warm Cream Alert (`#FEF3C7` / Text `#B45309`)** — `Nouvelle commande` amber badge and urgent triage sparkline wash.
- **Fresh Mint Confirmation (`#DCFCE7` / Accent `#10B981`)** — WhatsApp contact capsule, confirmed checkmark orb, and confirmation rate wave wash.
- **Alert Crimson (`#EF4444`)** — Unread transfer count badge on dock, abandoned cart count badge in menu, and location map pins.
- **Deep Slate Ink (`#0F102C` / Muted `#5B5F88`)** — Primary headings and readable body copy (never pure `#000000`).

## 3. Typography Rules
- **Font Family:** Crisp geometric sans-serif system stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`) for ultra-fast mobile rendering and numeric legibility.
- **Scale & Hierarchy:**
  - Localized uppercase date eyebrow: `11px`, bold `800`, tracked `.08em`, `#5B5F88`.
  - Mobile centered greeting: `clamp(20px, 5.6vw, 25px)`, heavy `900`, tight `-0.02em`.
  - KPI numerals: `clamp(17px, 4.5vw, 25px)`, heavy `900`, strictly `white-space: nowrap` inside `minmax(0, 1fr)` cards so numbers never wrap or overflow.
  - Menu row labels: `13.5px` heavy title / `11px` muted subtitle.

## 4. Component Stylings
- **Mobile Header Bar:** Non-sticky (`position: relative`) clean transparent top bar aligned over soft pastel pearl-lavender background — left side **brand text-only `Gcome` with centered floating gold crown directly over `"Gcome"`** and `"Vendez · Gérez · Suivez"` subtitle (zero shopping bag crowding the Dashboard bar); right side 3 balanced controls (`Dark` frosted white pill, `+ Commande` purple pill, `M` circular avatar with unread dot).
- **KPI Cards (2x2 Grid):** Pure white rounded (`22px`) cards with `40px` pastel circular/squircle 3D icon pills top-left, subtle `AlertTriangle` halo top-right on urgent card, and smooth `56px` translucent bottom-edge SVG sparklines fading from soft peak curve into tinted bottom rim glow.
- **Search & Filter Row:** Unified pill-shaped (`999px`) white search input (single outer ring, never double-bordered) paired with a compact left-aligned white date selector pill (`Calendar` icon + `Toutes les dates` + chevron). Immediately followed below by the Status tabs carousel and compact/full order cards.
- **Order Cards:** Elevated `24px` white surface, `⚡ Nouvelle commande` golden badge top-left, lavender client card (`50px` purple bag avatar + delivery pill + red map pin + equal 2-column Call/WhatsApp pills), `68px–74px` photo-left / stacked title+badges+price-right product box, full-width glossy purple `Confirmer la commande` pill (`46px` height), and clean secondary mini-pills.
- **Menu & Autres Espaces Drawer:** Top wave header featuring the large 3D purple+gold shopping bags, bold `"Gcome"` + `"Votre solution tout-en-un"` (no crown on Menu header), and circular settings gear `⚙️` backed by warm peach-gold & deep royal-violet right-edge curved ribbons; transitioning into a `30px`-top-rounded pale-lavender (`#F6F4FF -> #ECE7FF`) sheet containing uniform pure white (`#FFFFFF`) elevated cards with `42px` glossy pastel halo circular icons, a vivid `#EF4444` badge on abandoned orders, followed immediately by **Gcome Pro** (crown + `"Gcome Pro"` + `"Boostez votre business !"` + stacked gold `"Découvrir"` pill beside a large diagonal rocket SVG) above the permanently visible floating white bottom dock.

## 5. Layout & Responsive Guardrails
- **Strict Zero Horizontal Overflow (`scrollWidth <= clientWidth` down to `360px`):** All grid tracks use `minmax(0, 1fr)`, flex children use `min-width: 0`, card containers enforce `max-width: 100%; box-sizing: border-box; overflow-x: clip;`, and SVG art scales down gracefully below `420px`.
- **Safe Bottom Dock Clearance:** All content areas reserve bottom padding `calc(92px + env(safe-area-inset-bottom, 0px))` above the `z-index: 980` floating dock. Background bottom corner waves (`z-index: 910`) frame behind the dock without covering content or trapping child modals (`z-index: 1100+`).
