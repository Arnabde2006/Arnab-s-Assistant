# Frontend Review — Arnab's Assistant

**Date:** 2026-08-21
**Scope:** `frontend/src` — 16 pages, 13 components, 2 contexts, 1 hook, 1 global stylesheet (~15k lines total)
**Method:** static read-only audit. No files were modified.
**Out of scope:** performance. That was covered separately in `OPTIMIZATION_PLAN.md` (code splitting, memoization, bundle chunking) and is already implemented — this review deliberately does not re-tread it.

---

---

## Status

**Tier A: implemented** on branch `fix/frontend-error-handling` (2026-08-21), uncommitted pending review.
Tier B and Tier C are **not** started. The findings below are left in their original
form as a record of what was audited; see `## Tier A — implementation notes` at the
end of this file for what actually shipped and what changed about the analysis.

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

The toast entrance animation is exempted from motion explicitly, because the global
`prefers-reduced-motion` block only disables `transition` and not `animation` (Tier B, B6).

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
