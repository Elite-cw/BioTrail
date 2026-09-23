# BioTrail

BioTrail is a fully static, browser-only "link-in-bio" website where anyone can claim a handle (for example **biotrail.me/you**), build a live profile page, and share it everywhere. There is no server and no database - everything runs in the browser and is stored in `localStorage`, so the whole project can be opened straight from disk or hosted on any static host.

## Quick start

BioTrail needs no build step and no dependencies.

1. Open `index.html` in a browser (double-click works; a local server such as `npx serve .` also works).
2. Type a username/handle in the home page claim box and press **Claim my link**.
3. If the handle is taken you are sent to `view/login.html`; otherwise to `view/signup.html`.
4. After sign-up you land in the dashboard (`app/dashboard.html`) where your page and links are managed.

All pages reference shared, versioned assets (`assets/css/style.css?v=52`, `assets/js/*.js`). Bump the `?v=` query string on any asset you change so browsers pick up the new file instead of a cached copy.

## Current prototype capabilities

The items below are working prototype capabilities. The final **one or two unique
features** for the project presentation have intentionally not been selected yet;
that decision will be made separately so the core product remains the priority.

Everything is still 100% static and stored in your own browser (`localStorage`). The
new version adds the requested link-page features on top of the original editor:

| Feature | LinkTree | BioTrail (before) | BioTrail (now) |
| --- | --- | --- | --- |
| Works offline / from `file://`, no server | No (cloud) | Yes | Yes |
| Claim a handle and build a live page | Yes | Yes | Yes |
| Template themes chosen at sign-up | Paid | No | Yes (7 presets) |
| Multiple pages per account | Limited | Yes (local) | Yes |
| Visual editor with live preview iframe | Yes | Yes | Yes |
| Animated page backgrounds | Some | No | Yes (gradient / waves / dots / aurora) |
| Built-in QR code generator | Integration | No | Yes (v1–10, level M, verified) |
| Downloadable trail / business card PNG | Link-in-bio only | No | Yes |
| Real page analytics (views/clicks per day) | Paid | Fabricated demo numbers | Real, local-first (`biotrail_stats`) |
| Schedule links to appear between times | Paid | No | Yes |
| Group links into tabs on the page | Paid | No | Yes |
| Countdown links ("starts in 00:12:34") | No | No | Yes |
| Embedded players (YouTube / Vimeo / Spotify…) | Paid | No | Yes |
| Auto-detects social links (icon + label) | Automatic | Manual selection | Yes |
| Referral greeting via `?ref=` / `?utm_source=` | Limited | No | Yes |
| Theme export / import (JSON) | No | No | Yes |
| No analytics pixels, fully private | No | Yes | Yes |

## Folder structure

```
BioTrail/
├── index.html              Home page (claim form, hero, marketing sections)
├── app/                    Logged-in application pages
│   ├── dashboard.html      Page editor with live preview iframe
│   ├── pages.html          Manage links, avatar and account
│   ├── profile.html        The live profile page (rendered, also used in preview)
│   └── payment.html        Checkout for paid plans (Paystack)
├── view/                   Marketing / auth pages
│   ├── learn.html          Guides and how-to content
│   ├── login.html          Sign in for existing accounts
│   ├── marketplace.html    Templates marketplace
│   ├── pricing.html        Free / Starter / Pro plans with billing toggle
│   ├── products.html       Feature overview
│   ├── signup.html         Create an account
│   ├── start.html          Plan-selection gateway for guests (create or log in)
│   └── templates.html      Template gallery
└── assets/
    ├── css/style.css       All styling (one stylesheet, ~50 responsive breakpoints)
    └── js/
        ├── account.js      Seed/migrate account data
        ├── dashboard-icons.js / dashboard-icons.json   Material-symbol icon paths
        ├── dashboard.js    Editor logic (links, avatar, live preview, autosave, QR trail card)
        ├── icon-paths.js   Shared icon helpers
        ├── pages.js        Marketing/auth logic (claims, signup, login, plan routing, template seeds)
        ├── pages-list.js   Pages dashboard renderer
        ├── payment.js      Checkout logic (Paystack inline)
        ├── qr.js           Zero-dependency QR encoder (byte mode, level M, v1–10)
        ├── script.js       Home-page logic
        ├── session.js      Logged-in nav, brand redirect, active-plan label
        └── stats.js        Local-first page analytics (views & link clicks per day)
```

## Site sections (page map)

- **Home (`index.html`)** – hero with the claim box, feature grid ("Trails"), audience, creator showcase, use cases, steps, platform list, stories slider, FAQ, and a closing claim section.
- **Products (`view/products.html`)** – deep dive into the builder, guided trails, freshness checks and the creator store.
- **Templates (`view/templates.html`)** – browse the template gallery and start from a template.
- **Marketplace (`view/marketplace.html`)** – searchable template marketplace.
- **Learn (`view/learn.html`)** – guides and tips.
- **Pricing (`view/pricing.html`)** – Free / Starter / Pro cards with a Monthly / Annual billing toggle. Plan buttons are wired to route by auth state.
- **Sign up / Log in (`view/signup.html`, `view/login.html`)** – account creation and sign-in; both accept `?plan=&billing=` query params to continue to checkout.
- **Start (`view/start.html`)** – for guests who pick a plan: shows the chosen package and offers **Create account** or **Log in**, carrying the plan forward.
- **Dashboard (`app/dashboard.html`)** – editor with link list, avatar upload, design tools and a live preview iframe of `app/profile.html`. Link editor supports icons with social auto-detection, groups/tabs, scheduling windows, countdowns and embeds; the appearance panel adds animated backgrounds plus theme export/import; a **QR trail card** (downloadable PNG) generates from your page link.
- **Pages (`app/pages.html`)** – manage your links, avatar and account, with a search box.
- **Payment (`app/payment.html`)** – checkout summary with **Card** and **Bank transfer** options (Paystack).

## Account & session flow

Everything is stored in `localStorage` on your own machine:

| Key                  | Purpose                                              |
| -------------------- | ---------------------------------------------------- |
| `biotrail_profile`   | `{ username, name, email, role, avatar }`            |
| `biotrail_auth`      | Browser-local demo email/password check               |
| `biotrail_pages`     | Array of pages `{ handle, title, links, theme, ... }` |
| `biotrail_stats`     | Per-page analytics `{ pageId: { views, clicks } }`   |
| `biotrail_session`   | `"active"` or `"signed_out"`                         |
| `biotrail_plan`      | Active plan record after a successful checkout       |

- Claiming an unclaimed handle signs you up; a claimed handle routes to login.
- Login only opens the account saved in the same browser and checks the demo password created during sign-up.
- The nav header becomes auth-aware when a session is active: "My dashboard" button plus your avatar/name chip, and plan CTAs point to your dashboard.
- The **Free plan** is forever; the badge/plan label in the dashboard sidebar updates to your active plan after an upgrade.

> **Prototype boundary:** this is not production authentication. The password
> check is stored locally to make the portfolio demo flow coherent. Never use a
> real password here. A production version requires a server, database, secure
> password hashing, sessions and account recovery.

## Upgrades & payments

Pricing routes by login state:

- **Not logged in** → picking a paid plan sends you to `view/start.html` (create account or log in first).
- **Logged in** → picking a paid plan sends you to `app/payment.html?plan=...&billing=...`.

### Payment API: Paystack (demo only)

> **Note:** This is a **demo/simulation of the Paystack checkout only**.
> No actual Paystack API key or account has been added, and **no real
> payments are processed** anywhere in this project.

The checkout page (`app/payment.html`) mimics a Paystack flow with two payment-method options:

- **Card** – debit/credit card checkout.
- **Bank transfer** – one-time payment directly from a bank account.

Because no API key is configured, the `PAYSTACK_PUBLIC_KEY` constant in `assets/js/payment.js` holds a placeholder (shown below), and the checkout always runs in **demo mode** - pressing the button shows a notice and simply simulates a successful payment:

```js
var PAYSTACK_PUBLIC_KEY = "pk_test_REPLACE_WITH_YOUR_PAYSTACK_PUBLIC_KEY";
```

On a simulated success, a `biotrail_plan` record is written to `localStorage` and the user returns to the dashboard. Nothing is ever charged and no request is sent to any payment provider.

**To make it a real integration later** (out of scope for now): register a Paystack account, paste your public key into the constant above, and add a small backend to create transactions and verify Paystack webhooks. Public keys are safe to embed in browser code, but **secret keys must never** be placed there.

## Editor & live preview

The dashboard preview iframe (`app/profile.html`) receives edits through a two-way message protocol:

1. On edit, `dashboard.js` posts `{ type: "biotrail:preview-update", pageId, title, handle, profile, links, theme }` to the iframe.
2. `app/profile.html` caches it (`previewStateCache`) and, when loaded, posts `biotrail:preview-request`.
3. The parent replies with the latest state via `syncPreview()`.

The profile page falls back to a default "BioTrail creator" template when no state is present, and honours your avatar image, design accent and link styles.

## Responsive behaviour

The single stylesheet targets the full range of screen sizes:

- **Large desktop (≥1440px)** – wider hero columns and larger type so layouts don't feel stretched on big monitors.
- **Small desktop / laptop (900–1180px)** – compact hero and reduced paddings.
- **Tablet (≈620–900px)** – nav collapses into the burger menu, hero stacks, grids go to 2 columns.
- **Phone (≤620px)** – single-column grids, stacked forms, taller touch targets.
- **Very narrow phones (≤420px)** – tighter paddings and smaller type for narrow/split-screen windows.
- **Phone landscape (`orientation: landscape`, ≤560px height)** – compact nav, shorter paddings, scrollable menus and vertically contained auth/checkout cards.
- **Notched devices** – `viewport-fit=cover` plus `env(safe-area-inset-*)` padding keeps content clear of the notch and home indicator.

All viewport-height-dependent layouts use `100svh` (with `100vh` fallbacks) so bars and keyboards on mobile browsers don't cause clipping.

## Customising

- **Colours / fonts** – design tokens live at the top of `assets/css/style.css` in `:root` (`--lime`, `--ink`, `--paper`, `--purple`, `--coral`, `--shadow`). Font: Plus Jakarta Sans from Google Fonts.
- **Icons** – Material Symbols paths are kept in `assets/js/dashboard-icons.js` and `assets/js/dashboard-icons.json`.
- **Plans & prices** – the plan catalogue for checkout lives in `assets/js/payment.js` (`PLANS`); the marketing numbers live in `view/pricing.html`.

## Notes for contributors

- Write UTF-8 **without BOM**. When scripting, use a `System.Text.UTF8Encoding($false)` writer - PowerShell's `Set-Content -Encoding UTF8` adds a BOM.
- Keep the existing style: script files are `var`-style IIFEs; `session.js`, `dashboard.js`, `pages.js` etc. avoid ES6 module syntax for maximum `file://` compatibility.
- After editing a cached asset, bump its `?v=` version everywhere it is referenced and sanity-check with `node --check` on JS and balanced braces in the stylesheet.
- Use `PRESENTATION.md` for the verified demo order, scope boundaries and short speaking notes.
