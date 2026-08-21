# Frontend Review — Arnab's Assistant

**Date:** 2026-08-21
**Scope:** `frontend/src` — 16 pages, 13 components, 2 contexts, 1 hook, 1 global stylesheet (~15k lines total)
**Method:** static read-only audit. No files were modified.
**Out of scope:** performance. That was covered separately in `OPTIMIZATION_PLAN.md` (code splitting, memoization, bundle chunking) and is already implemented — this review deliberately does not re-tread it.

---

---

## Status

**Tier A: implemented and committed** on branch `fix/frontend-error-handling` (2026-08-21), at `90d5c14`.

**Tier B: implemented** on branch `a11y/tier-b-accessibility` (2026-08-22), uncommitted pending
review. The branch is stacked on the Tier A commit rather than on `main`, because both tiers
touch `index.css` and the same nine pages; rebasing it onto `main` before Tier A lands would
produce conflicts for no benefit.

Tier C is **not** started.

The findings below are left in their original form as a record of what was audited. See
`## Tier A — implementation notes` and `## Tier B — implementation notes` at the end of this
file for what actually shipped, and for the places where implementation changed the analysis.

## Verdict

The foundation is better than the surface. The API client is small and clean, `AuthContext` is thoughtfully written (it hydrates from `localStorage` synchronously to avoid a flash-of-login on refresh), the CSS has a real design-token system, and only 4% of CSS classes are dead. This is not a codebase in trouble.

The weakness is concentrated in three places, in descending order of how much they actually hurt:

1. **Error handling is largely absent.** 26 of 74 API calls have no `try`/`catch` and no `.catch()`, and 7 of the 16 pages have no error state at all. When a request fails, the typical user experience is *nothing happens* — no message, no retry, no indication.
2. **Accessibility has systemic gaps**, not scattered ones. Zero dialog semantics across 5 pages of modals, zero keyboard handlers in the entire app, and drag-to-reorder with no keyboard alternative.
3. **Styling has drifted off the token system** — 1,128 inline `style={{…}}` objects bypass the stylesheet, concentrated in the largest pages.

---

## Tier A — Will actually bite a real user

### A1. 26 of 74 API calls have no error handling  *(highest impact)*

Every mutation in `pages/Debts.jsx` is unguarded — 8 of its 8 calls:

| Location | Function | Failure behavior |
|---|---|---|
| `Debts.jsx:46` | `refresh()` | throws to caller |
| `Debts.jsx:58` | `addDebt` | debt silently not added |
| `Debts.jsx:71` | `addDebtInModal` | silently fails, modal state cleared anyway |
| `Debts.jsx:82` | `settle` | silently fails |
| `Debts.jsx:87` | `unsettle` | silently fails |
| `Debts.jsx:92` | `removeDebt` | silently fails |
| `Debts.jsx:98` | `settleAllForPerson` | partial `Promise.all` failure, some settled some not |
| `Debts.jsx:105` | `submitPartialSettle` | silently fails, form resets |

These are wired directly to `onClick`/`onSubmit`, so a failure becomes an unhandled promise rejection that surfaces only in the console. The user taps "Settle", the row doesn't change, and nothing explains why.

`settleAllForPerson` (`Debts.jsx:98`) is the worst of these: `Promise.all` over N settle calls means one rejection leaves the set half-applied with no rollback and no report of which succeeded.

Also affected: `Todos.jsx:233,240,245,250,338`, `Finance.jsx:257,262,287,293,298`, `Attendance.jsx:117,119`, `Timetable.jsx:469,491`, `Grades.jsx:195`, `ExamTimetable.jsx:83`, `AuthContext.jsx:51,58`.

**Fix:** a single `useMutation`-style helper (or a thin wrapper in `api/client.js`) that catches, surfaces the message, and exposes in-flight state. This is one abstraction that fixes ~26 sites.

### A2. Seven pages have no error state at all

| Page | loading state | error state |
|---|---|---|
| Attendance | — | — |
| Debts | — | — |
| Finance | — | — |
| Pomodoro | — | — |
| Profile | — | — |
| Timetable | — | — |
| Todos | — | — |
| Dashboard | yes | — |
| Nptel | yes | — |
| Subscriptions | yes | — |
| Login / Register / Grades / ExamTimetable / ViewOnly | yes | yes |

The pages that *do* handle errors are the auth and view-only screens. Every core data page — the ones the user actually lives in — has no channel to display a failure even if it were caught. Fixing A1 requires fixing A2, since there is currently nowhere to put the message.

### A3. No 401 / token-expiry handling

`api/client.js:14-17` throws a generic `Error(data.error || "Something went wrong")` for every non-OK status. Nothing distinguishes 401. `AuthContext.jsx:25-48` validates the token exactly once, on mount.

Consequence: when a JWT expires mid-session, the app does not log the user out or redirect. Every subsequent action fails with "Something went wrong" until the user manually reloads. Given that this app is likely left open in a tab for long stretches, this is a routine occurrence, not an edge case.

**Fix:** in `request()`, detect `res.status === 401`, clear the stored token/user, and dispatch a logout so the router sends the user to `/login`.

### A4. No success feedback mechanism exists

Zero toast/snackbar occurrences in the entire codebase. Combined with A1, a mutation that succeeds and a mutation that fails are visually identical when the list doesn't obviously change. Adding an error channel (A2) and a success channel together is what makes the app feel trustworthy.

### A5. Load failures masquerade as empty data

`Debts.jsx:51` — `refresh().catch(() => {})`. A failed initial load is swallowed and the page renders its empty state, so "the network failed" is presented to the user as "you have no debts." That's actively misleading in a money-tracking feature.

### A6. No request timeout or cancellation on the client

The backend now aborts stalled AI calls (Tier 3), but `api/client.js` has no `AbortController` and no timeout. A hung request means an indefinite spinner on the pages that have one, and an indefinitely dead button on the pages that don't. `postStream` (`client.js:40`) also calls `res.body.getReader()` with no null guard and no way to cancel, so navigating away mid-stream leaves the reader running.

---

## Tier B — Accessibility barriers

These are real barriers, not lint nits. Counts are whole-codebase.

### B1. Modals have no dialog semantics — zero, across five pages

`Finance.jsx`, `Nptel.jsx`, `Pomodoro.jsx`, `Subscriptions.jsx`, `Todos.jsx` all render overlay/modal markup. Across all of them:

- `role="dialog"` — **0 occurrences**
- `aria-modal` — **0 occurrences**
- focus trap — none
- focus restoration on close — none
- Escape-to-close — none (the single `Escape` handler, `Pomodoro.jsx:149`, is a timer shortcut, not a modal close)
- body scroll lock — none

For a screen-reader user, opening a modal does not move or contain focus: they remain in the page behind it and cannot tell a dialog appeared. For a keyboard user, `Todos.jsx:37` closes only via a click on the backdrop `<div>`, which is not focusable — so there is no keyboard way out of that modal.

### B2. Drag-to-reorder has no keyboard alternative

`Subscriptions.jsx` and `Nptel.jsx` each have 7 drag handlers. The app contains **zero** `onKeyDown`/`onKeyPress`/`onKeyUp` handlers and only 2 `tabIndex` attributes. Reordering is therefore impossible without a pointer — the feature is entirely unavailable to keyboard and screen-reader users.

### B3. Icon-only buttons in pages are unlabeled

11 `aria-label` attributes against 165 `onClick` handlers — but the distribution matters. The shared components are actually done well: `FileUpload.jsx:155`, `MobileHeader.jsx:156`, `MobileNav.jsx:117,163`, `Sidebar.jsx:66`, and `ThemeToggle.jsx:77,88,107` are all properly labeled, and `ThemeToggle` even uses `role="group"`.

The gap is in the pages. `Todos.jsx` is the only page that labels its icon buttons (`:43`, `:401`, `:409`). Every other page — including the edit/delete/close buttons in Finance, Debts, Nptel, Subscriptions, Timetable and Grades — renders bare icons that announce as just "button". So the pattern is already established and understood in this codebase; it simply hasn't been applied to the page-level controls. That makes this a mechanical fix rather than a design question.

### B4. Nothing is announced to assistive tech

Zero `aria-live` regions and zero `role="status"`. Loading transitions, and any error messages added per A2, will be silent for screen-reader users.

### B5. Two controls destroy their focus ring with no replacement

There *is* a correct global rule at `index.css:225`:

```css
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```

But `.custom-checkbox` (`index.css:455`) and `.pomo-volume-slider` (`index.css:1734`) both set `outline: none` with no substitute focus style. Both are class selectors appearing *later* in the file than `:focus-visible` at equal specificity, so they win — these two controls are genuinely invisible when focused.

`.input` (`index.css:524`) also sets `outline: none`, but does supply a `:focus` box-shadow at `:528`, so it's acceptable. Worth switching to `:focus-visible` for consistency.

### B6. `prefers-reduced-motion` only covers transitions

`index.css:1294-1298` disables `transition` but not `animation`. Keyframe animations — the skeleton glow, spinners, chat loading dots — keep running for users who asked for reduced motion. Add `animation: none` (and consider `scroll-behavior: auto`) to that block.

---

## Tier C — Architecture & maintainability

### C1. 1,128 inline `style={{…}}` objects

| File | Count |
|---|---|
| `pages/Timetable.jsx` | 145 |
| `pages/Debts.jsx` | 132 |
| `pages/Finance.jsx` | 93 |
| `pages/Subscriptions.jsx` | 90 |
| `pages/Nptel.jsx` | 86 |
| `components/CGPATrendVisualizer.jsx` | 73 |
| `pages/ViewOnly.jsx` | 72 |
| `pages/Grades.jsx` | 72 |

This is the single largest maintainability drag. The stylesheet has a perfectly good token system (24 custom properties: `--accent`, `--panel`, `--text-muted`, `--radius-md`, …) and the pages route around it. Consequences: inline styles can't use media queries, so responsive behavior can't be expressed where the layout is actually defined; theme changes can't reach hardcoded inline colors; and there's no reuse between pages that render similar cards.

Worth noting the CSS itself is in decent shape — only **7 of 166 classes (4%)** are unreferenced, and most colors correctly go through tokens (15 hardcoded hex values remain outside token blocks, several as legitimate `var(--x, #fallback)` defaults). The problem isn't the stylesheet; it's how much markup ignores it.

### C2. Two pages are far too large

`Timetable.jsx` — 1,918 lines, 23 `useState` calls in one component.
`Finance.jsx` — 910 lines, 23 `useState` calls.
Also large: `Debts.jsx` (1,015), `Nptel.jsx` (943), `Subscriptions.jsx` (937), `Pomodoro.jsx` (790), `CGPATrendVisualizer.jsx` (745).

23 pieces of independent state in a single component means every interaction risks touching unrelated logic. The natural seams are the modal bodies, the row/card renderers, and the form state — each of which is already a self-contained concept.

### C3. Missing abstractions, ranked by duplication removed

| Abstraction | Replaces | Sites |
|---|---|---|
| `useFetch` / `useMutation` | fetch + loading + error triad, and the 26 unguarded calls | ~16 pages |
| `<Modal>` (with focus trap, Escape, `role="dialog"`) | hand-rolled overlay markup; fixes B1 wholesale | 5 pages, 32 modal state vars |
| `formatCurrency` | 17 hardcoded `₹` across 3 files, 13 `toFixed(2)` | 3+ pages |
| `formatDate` / `toISO` | `padStart(2,'0')` date math reimplemented 10 times | `Attendance`, `Finance`, `Nptel`, `Pomodoro`, `Subscriptions`, `Todos` |
| `<ConfirmDialog>` | 5 native `window.confirm` calls | 5 sites |

The `toISO` duplication is notable because the backend already has `utils/dateHelpers.js` with exactly this logic — the frontend reimplements it inline in six files, which is how date-handling bugs diverge between client and server.

### C4. Native `window.confirm` for destructive actions

5 occurrences, and they're inconsistent even with each other — `ViewOnlyLinkCard.jsx:26` and `Finance.jsx:432` use `window.confirm`, while `Nptel.jsx:344`, `Profile.jsx:130` and `Subscriptions.jsx:317` use the bare global `confirm`. All are unstyleable, block the main thread, and look jarring next to the app's own modals. `Profile.jsx:130` and `ViewOnlyLinkCard.jsx:26` also duplicate the same warning string verbatim.

### C5. Five inconsistent breakpoints

`380px`, `640px` (×2), `720px`, `768px`, `769px`. The `768`/`769` pair is a deliberate boundary, but `640` and `720` overlapping suggests ad-hoc growth. Promote these to a documented set (e.g. 380 / 640 / 768) and use them consistently.

### C6. 39 `!important` declarations

Concentrated in theme overrides (`index.css:422-424`, `:616`, `:1760-1761`) and inside media queries (`:946-949`, `:1263-1271`). Mostly a symptom of C1 — inline styles outrank stylesheet rules, so overriding them requires `!important`. Should largely dissolve if C1 is addressed.

---

## Suggested order of work

**First — correctness (Tier A).** Add a `useMutation`/error-surface abstraction plus 401 handling in `api/client.js`. This is a small, contained change that fixes 26 silent-failure sites and the expired-token trap. Highest value per line changed by a wide margin.

**Second — the `<Modal>` component (B1, C3).** One good accessible modal fixes five pages of dialog semantics, focus management, and Escape handling simultaneously, and deletes a pile of duplicated overlay markup.

**Third — keyboard support for reorder (B2) and `aria-label` sweep (B3).** Independent and mechanical.

**Fourth — inline-style migration (C1), page by page.** Highest total effort, no user-visible change. Best done opportunistically: whenever a page is touched for another reason, move its styles into the stylesheet. Starting with `Timetable.jsx` would also naturally force the C2 component split.

**Quick wins, any time:** `animation: none` in the reduced-motion block (B6), focus styles for the two controls in B5, and replacing `Debts.jsx:51`'s swallowed catch (A5).

---

## Caveats

This is a static audit — nothing was executed, and no browser, screen reader, or Lighthouse run was involved. The accessibility findings are derived from markup and CSS inspection, so contrast ratios and actual screen-reader output are unverified and worth a manual pass. Counts come from grep/AST scans and are accurate to the pattern matched, but a hand-written variant of a pattern could be missed. Every finding above cites file and line so each can be checked independently.

---

## Tier A — implementation notes

Implemented 2026-08-21 on `fix/frontend-error-handling`. 12 files changed, 2 added.

### What was built

Three new pieces carry the whole tier:

`context/ToastContext.jsx` is the app-wide surface for "that worked" / "that didn't".
It dedupes identical consecutive messages, gives errors a longer dwell (7s vs 4.5s) and
`role="alert"`, and cleans up its timers on unmount. It has to be mounted *above*
`AuthProvider` in `main.jsx`, because session-expiry notices are raised from inside auth
handling.

`hooks/useAsyncAction.js` exposes `run(fn, { errorMessage, successMessage })`, which
returns `{ ok, result, error }`, toasts on failure, tracks `pending`, and guards against
re-entrancy. Mutations became a uniform three lines: run it, bail if it failed, refresh.
Note the one place it is deliberately *not* used: handlers that already own a `disabled`
flag (`saveBudget`, the Finance bulk actions, the view-link regenerate) call `toast.error`
directly, because `run`'s extra guard would turn a second concurrent submit into a silent
no-op for no benefit.

`api/client.js` gained a 20s request timeout and a 30s stream-idle timeout (both via
`AbortController`), plus a global 401 handler registered by `AuthContext` through
`setUnauthorizedHandler`. The important subtlety: `/auth/login`, `/auth/register` and
`/auth/me` are exempt from the 401-means-logout rule. `routes/auth.js` returns 401 both
for a wrong password on login *and* for a wrong `currentPassword` on `PUT /me`, so a
naive global rule would log a user out for a typo. `postStream` also stopped throwing
and now routes every failure to `onError`; its single caller in `Dashboard.jsx` already
had both an `onError` callback and an equivalent outer `catch`, so that is
behaviour-preserving.

### Two real bugs surfaced

Both had been invisible *because* the calls were unguarded — which is the argument for
this tier in miniature.

`Attendance.jsx` called `api.delete(...)`, but the client only ever exported `del`.
Unmarking an attendance day or a holiday threw `TypeError: api.delete is not a function`
every single time, and nothing caught it, so the row just silently stayed marked.

`ViewOnlyLinkCard.jsx`'s regenerate handler used `try`/`finally` with no `catch`. On
failure the user was told nothing at all — immediately after being warned that their old
share link was about to stop working.

### Corrections to the A1 analysis

The original count of 26 was right about the code but wrong about the boundary in two ways.

`AuthContext.jsx:54,61` (login and register) are **false positives** and were left alone:
`Login.jsx` wraps both in `try`/`catch` and renders the message in `.error-text`. Fixing
them would have been a regression.

More significantly, the scan under-counted, because `try { … } finally { … }` with no
`catch` reads as "guarded" to an AST check but does not actually handle anything. Five
more sites fell into that shape (`saveBudget`, both Finance bulk handlers, and the view-link
regenerate), and a separate class of leak turned out to matter more: **a `try`/`catch`
does not catch the rejection of an un-awaited promise.** Nine bare `refresh()` calls sat
inside a caller's `try`/`catch` looking safe while their rejections escaped entirely.

Those nine are now awaited with their own handler rather than a plain `await`, so that a
stale-list failure reports itself as *"Imported, but the totals may be out of date"*
instead of being misattributed to the upload that actually succeeded.

A sweep for the same pattern across the rest of the app found `Nptel.jsx`,
`Subscriptions.jsx` and `Dashboard.jsx` clean on this point: their `loadNptelData`,
`loadSubscriptions`, `processImageFile` and `handleSend` wrap their whole bodies in
`try`/`catch`, so the returned promise never rejects and calling them bare is safe. No
changes were needed there.

### Also fixed, in passing

Nothing in the stylesheet targeted `:disabled`. Every pre-existing `disabled={saving}`
button — and every new `disabled={pending}` one — looked identical to a live button.
`.btn:disabled` / `.btn-ghost:disabled` now dim and drop the hover and active effects.

The toast entrance animation was originally exempted from motion explicitly, because the
global `prefers-reduced-motion` block only disabled `transition` and not `animation`. Tier B
(B6) widened that global block to cover `animation` with `!important`, so the local exemption
became dead weight and was removed.

### Still open in Tier A

`A2`'s per-page error *states* were addressed with a `.load-error` banner plus Retry on
the seven pages that had none, which covers the load path. What is not done is any form of
optimistic-update rollback — a failed mutation currently relies on the refresh to correct
the display rather than reverting locally. That was out of scope here and is worth its own
pass if it ever becomes visible in practice.

### Verification

`vite build` cannot run in the sandbox (Windows `node_modules` against a Linux host), so
verification was static: all 13 touched files parse as JSX/ESM via `@babel/parser` and pass
a custom Rules-of-Hooks check, the unguarded-call scan is down to its 14 known false
positives (the `api.get`s *inside* `refresh()` bodies, which are guarded at the call site a
lexical scan cannot see, plus the two `AuthContext` login calls), and the floating-promise
scan reports zero leaks. **A manual pass through the failure paths is still warranted** —
in particular unmarking attendance, which has evidently never worked.

---

## Tier B — implementation notes

Implemented 2026-08-22 on `a11y/tier-b-accessibility`, stacked on the Tier A commit `90d5c14`.
All six findings are addressed. Three new files, 22 modified, +426/−87.

### What was built

Three pieces of shared machinery, so that the per-page edits stayed mechanical:

`hooks/useDialog.js` gives a modal focus containment, Escape-to-close, focus restoration and
a body scroll lock, and returns the `role`/`aria-modal`/labelling attributes as a props object
to spread. `components/ReorderControls.jsx` is the keyboard path for the two drag-to-reorder
lists. `context/AnnouncerContext.jsx` is a single polite live region for the whole app, plus a
`useLoadAnnounce` hook that pages call with their loading flag.

### B1 — dialog semantics

The obvious move was a shared `<Modal>` component, and it was deliberately not taken. The nine
overlay sites have meaningfully different markup — different max-widths, one with a flex column
and `maxHeight: 85vh` for a scrolling body, one that is a confirm rather than a form — and
folding them into one component would have meant a prop for each difference plus a real risk of
visual drift. A hook that returns props leaves every overlay's markup exactly as it was; the
diff for a typical modal is one added line. B1 therefore ships with **zero intended visual
change**.

Two details in the hook are worth knowing about, because both are the kind of thing that looks
like a bug later:

Focus restoration cannot simply read `document.activeElement` when the effect runs. React
applies `autoFocus` during commit, *before* effects fire, so by the time the hook looks, focus
may already be inside the dialog and the trigger is lost. The hook instead keeps a
capture-phase `focusin` listener recording the last focus that landed *outside* any dialog, and
restores to that.

Escape and Tab are handled off a module-scope stack, not per-instance listeners, so that with
two dialogs open (Subscriptions can stack its import modal over its form modal) only the
topmost responds. The scroll lock is refcounted for the same reason — the naive version has the
inner dialog's cleanup unlock the body while the outer one is still open.

The hook takes `open` as an explicit argument rather than being mounted conditionally, because
two of these overlays render inline and would otherwise lock scrolling the moment the page
mounted.

Backdrop-click-to-dismiss was **not** added. Every one of these dialogs now has a labelled close
button and responds to Escape, and adding a click-outside handler to forms that hold unsaved
input is a data-loss risk, not an accessibility win.

### B2 — keyboard reorder

Each draggable row gained a visible pair of ↑/↓ buttons beside the existing grip. This is a
visible change, and the intended one — a keyboard-only affordance with no visual presence is
undiscoverable, and the alternative (arrow keys while a handle is focused) is not something a
user finds without documentation.

The buttons at the ends of a list use `aria-disabled`, not `disabled`. `disabled` removes a
button from the tab order, so walking an item down to the last position would delete the very
control the user was pressing from the tab order and drop focus onto `<body>` — stranding them.
`aria-disabled` keeps it focusable and announces the state; the handler guards instead. Focus
survives the move itself because React reorders keyed children by moving the existing DOM nodes
rather than recreating them.

Direction wording is a prop rather than hardcoded "up"/"down", because Subscriptions renders
into a wrapping grid where "up" would frequently be false. It uses "earlier"/"later".

After each move a live region announces `"{name} moved to position {n} of {m}"`, so the result
is confirmed without the user having to navigate back through the list to check.

### B3 — accessible names

42 controls gained an `aria-label`. Labels name the item, not just the verb — `Delete Netflix`
rather than `Delete` — so they still make sense when a screen reader lists a page's controls out
of context. Where a control already had a `title`, the `title` was kept as the visual tooltip
and the `aria-label` added alongside; `title` *is* used as a last-resort accessible name, but it
is not surfaced on touch and is skipped under some configurations, so it is not something to
rely on.

Three of these were more than labelling:

`Switch.jsx` used `<span role="switch">` with no `tabIndex` and no key handler, so the toggle
could not be reached or operated from a keyboard **at all** — it was not a labelling gap, it was
a control that keyboard users could not use. It is now a real `<button>`. That also fixes the
naming: a `<label>` only names *labelable* elements, so the wrapping label was never naming the
span. Same pixels, same inline styles, plus `border: none; padding: 0` to neutralise the user-agent
button defaults.

The `Login` and `Register` password-reveal buttons carried `tabIndex={-1}`, so a keyboard user
could never check what they had typed. Removed, and given `aria-pressed`.

The two screenshot upload areas are clickable `<div>`s that cannot become real buttons (they
wrap the file input and the whole area is a drop target), so they got `role="button"`, `tabIndex`
and an explicit Enter/Space handler — `role="button"` supplies the semantics but not the
activation behaviour, which is a common half-fix.

Modal backdrops and the mobile grab pill went the other way, to `aria-hidden`. They are
dismiss-on-tap conveniences duplicating a real close button, and without this they appear in the
accessibility tree as unnamed clickable regions.

One label is deliberately conditional. `Sidebar.jsx`'s logout button renders visible text when
the sidebar is expanded, so it is labelled only when collapsed. An `aria-label` that overrides
visible text breaks voice control, where users say what they can see.

### B4 — announcements

The live region is mounted once, above the routes, rather than per page. This is not tidiness —
it is the only arrangement that works here. A screen reader announces *mutations to a live region
already present in the document*; a region that appears with its message already inside it is
routinely missed. Seven of the nine data-loading pages `return` an entirely separate skeleton
tree while loading, so a region rendered inside a page would be unmounted and remounted at
precisely the loading→loaded transition — the one moment it has to survive.

`announce()` alternates an invisible zero-width space on the end of the message, because setting
identical text is a DOM no-op and no mutation means no announcement — which would silently drop
the second "Loading…" when a user retries a failed load.

`useLoadAnnounce` only announces completion if the page was actually busy first, so a cached
page does not report finishing something the user never saw start. Pages that track a load error
pass an empty ready message, so nothing claims success over the top of their `role="alert"`
banner. Counts are included where they are cheap and useful (`Planner loaded, 12 items`).

### Corrections to the Tier B analysis

**B1 undercounted, and included one page it shouldn't have.** The finding named five pages.
There are nine dialog sites across six files: `Debts.jsx` (2) and `Timetable.jsx` (2) were not
listed at all, and `Subscriptions.jsx` has two rather than one. `Pomodoro.jsx`, meanwhile, has no
dialog — its `pomo-fullscreen-overlay` early-returns as a full-screen *replacement* for the page
rather than layering over it, so there is no content behind it to hide from assistive tech and
`aria-modal` would be actively wrong. It also already closes on Escape. It was left alone.

**B4's premise had already shifted.** "Zero `aria-live`, zero `role="status"`" was true at audit
time, but Tier A's toast surface and its seven `role="alert"` load-error banners landed first, so
the error half of B4 was already satisfied before Tier B started. Only the loading half remained.

**B3's count was low.** The finding cited 11 `aria-label`s; the Tier A baseline had 13, and a
first pass at the sweep missed seven controls that had a `title` but no label. They were caught
by rerunning the scan without counting `title` as a name.

### Two real bugs surfaced

**Subscriptions' reorder was corrupting the stored order whenever a filter was active.** The old
code read indices from `filteredSubs` — the visible, filtered list — and spliced them into
`subscriptions`, the full list. With "Trials" or "Cancelled" selected those two index spaces do
not agree, so a drag moved a different card than the one under the cursor, or appeared to do
nothing while writing a scrambled order to the server. The whole path is now keyed by id rather
than index, and stepping "earlier"/"later" moves past the neighbouring *visible* card so a move
never silently hops a hidden row. Verified with a 13-case harness against a list with hidden rows
in the middle; the old code reproduces the bug on the same data.

**Both reorder-persist failures were swallowed.** `Subscriptions` and `Nptel` each did an
optimistic reorder and `console.error`'d the failure, leaving the visible order disagreeing with
the server until the next reload. Both now roll back to the previous order and raise a toast.

Separately, `Nptel.jsx` already had a `handleMoveCourse` function that nothing called — dead code
that B2 turned into the implementation for the new buttons.

### Flagged, not fixed

`Subscriptions.jsx` styles cancelled cards with `var(--border-color)`, which is not a variable
this stylesheet defines (`--border` and `--border-strong` are). Those cards get no border at all.
It is a real bug but a visual one, and this branch is deliberately visually inert outside B2.

Four inline styles write `justify: "space-between"` instead of `justifyContent`. Two of them, on
single-icon shrink-to-fit spans, were corrected in passing because the fix is provably inert
there. The other two would redistribute multi-child layouts if corrected — a visual change that
does not belong on an accessibility branch.

### Still open

The `role="alert"` load-error banners inherit the same insertion problem described under B4: the
banner element is itself inserted when the error appears, rather than mutating an
already-present container. `role="alert"` is handled more aggressively by screen readers than
`role="status"` and is usually caught, but it is not guaranteed. Routing errors through the
announcer as well would close the gap at the cost of double-announcing for the majority of users
who already hear the alert, so it was left alone. Restructuring the seven banners into
persistent containers is the correct fix if it ever proves to matter in practice.

`.input` still sets `outline: none` with a `:focus` box-shadow rather than `:focus-visible`
(noted under B5). It is visible when focused, so it was left as a consistency nit.

### Verification

`vite build` still cannot run in the sandbox, so verification was static and behavioural:

All 24 touched JS/JSX files parse via `@babel/parser`, pass a custom Rules-of-Hooks check — the
real risk this tier, since `useDialog` and `useLoadAnnounce` calls were inserted into components
that early-return skeletons — and resolve every relative import. Line endings were asserted CRLF
before and after every scripted edit, and every substitution asserted exactly one match.

The reorder logic was tested directly rather than read: 13 cases covering filtered and unfiltered
moves, both directions, clamping at both ends, drag across the full list, and walking an item
from top to bottom. All pass, and the harness confirms the old code fails the same cases.

The unnamed-control scan is down from 38 to 3, and all three are false positives: a wrapper
`<span>` whose only job is `stopPropagation`, an equivalent `<div>` in `Nptel.jsx`, and a submit
button in `Timetable.jsx` whose text lives inside a fragment the scanner does not read into.

**Not verified, and worth a manual pass:** actual screen-reader behaviour. Everything above
confirms the markup and the logic are right; none of it confirms NVDA or VoiceOver says
something useful. The focus-restoration path after closing a dialog, and the reorder
announcements, are the two places most likely to need adjustment once heard.
