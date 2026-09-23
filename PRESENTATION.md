# BioTrail presentation walkthrough

## 1. What BioTrail is

BioTrail is a browser-based link-in-bio prototype that lets a creator claim a
handle, build a page and guide visitors toward their most important content.

## 2. Why it matters

Creators often spread their work across social profiles, shops, booking tools
and portfolios. BioTrail gathers those destinations into one branded page that
is easy to edit and share.

## 3. Problem

- Important links are scattered across several platforms.
- A long, unstructured link list makes visitors search for what they need.
- New creators need a simple page without setting up a full website first.

## 4. Core solution

- Claim a memorable BioTrail handle.
- Add, edit, order and enable links from one dashboard.
- Customise colours, link shapes and the page background.
- Preview the public page while editing it.
- Review local page-view and click activity.
- Compare plans and demonstrate the checkout route safely in demo mode.

The final one or two unique features will be selected and presented later.

## 5. Recommended live demo

1. Start on `index.html` and briefly show the navigation and homepage sections.
2. Enter a new handle in the claim field.
3. Create a browser-local demo account. Use a demo password, never a real one.
4. Add one link in the dashboard and show it appearing in the live preview.
5. Change an appearance option.
6. Open the public profile page and return to the editor.
7. Show the analytics panel and explain that its data is local to this browser.
8. Open Pricing, choose a paid plan and stop on the demo checkout explanation.
9. Resize to a phone width to show the responsive navigation and dashboard.
10. Sign out, then log back in with the same local demo credentials.

## 6. Build

- Semantic HTML pages
- One shared CSS design system with responsive breakpoints
- Plain JavaScript for forms, routing, editor state and interactions
- `localStorage` for the browser-only prototype data
- No framework, build step, server or database

## 7. Honest scope boundaries

- Accounts exist only in the current browser.
- Login is a local prototype check, not production authentication.
- Payments are simulated; no money is charged.
- Analytics show activity recorded in the current browser only.
- A real product would require a backend, database, secure authentication,
  verified payments and server-side analytics.

## 8. Outcome and learning

BioTrail demonstrates a complete frontend product journey rather than a single
static page: discovery, account creation, editing, publishing, plan selection
and return login. The main learning is how shared state and clear routing keep a
multi-page static project feeling like one connected product.

## Short closing line

"BioTrail turns scattered destinations into one clear, personal trail. This
prototype proves the full frontend journey; the next step is choosing one or two
distinctive features and supporting them with a real backend."
