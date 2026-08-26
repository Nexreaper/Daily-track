# Nexreaper Ledger

A self-contained, client-side web app for tracking daily habits, spiritual
practice, fitness, sleep, savings, and career progress — all in one place.
Built for Android smartphones, **100% offline**, no server, no accounts.

Per the PRD, the app is **pure static files — no build tools**:

| File | Purpose |
| --- | --- |
| `index.html` | Structure: onboarding, dashboard (Home / Sleep / Looks tabs), settings & check-in modals |
| `css/styles.css` | Theme (dark default + light), components — PRD §7 palette (`#0E1226` bg, `#E8A33D` gold accent) |
| `js/app.js` | All logic (vanilla ES6), localStorage persistence, notification engine, onboarding |
| `sw.js` | Service worker: reliable notifications (works backgrounded on Android) + offline cache |
| `icons/icon-192.svg` | Notification icon |

CDN dependencies (cached by the service worker after first load):
Tailwind CSS and Google Fonts (Inter + Fraunces).

## Run it

Any static file server works — e.g. from the repo root:

```bash
python3 -m http.server 8080
# → http://localhost:8080
```

Notes:
- The service worker (and therefore OS-level notifications) requires an
  `http(s)` origin — it won't register from `file://`. All other features
  still work.
- Data is stored in `localStorage` under the `profile` and `logs` keys
  (PRD §8 schema), so data from previous builds is picked up automatically.
- Use **Settings → Your data → Export JSON** to back up before clearing
  browser data, and **Import JSON** to restore.

## Features

- **Onboarding** — 5 steps (Welcome → About you → Beliefs → Goals →
  Future self) creating the profile + first day log.
- **Home** — sunrise completion arc, habit streak (with relapse/reset),
  prayer checklist (5 prayers with times) or single practice toggle,
  pushup counter with target, reading/writing toggles, 8-glass water
  tracker, 7-day completion chart, savings tracker (budgeted + custom
  contributions, time-to-goal estimate), collapsible career roadmap,
  random check-in log.
- **Sleep** — sleep timer ("I'm going to sleep" / "I just woke up"),
  adjustable nightly target (4–12h), last-7-nights chart with target
  line, session history.
- **Looksmaxing** — 10-task daily checklist, progress bar, 7-day chart,
  tips.
- **Notifications** — prayer alerts (checked every 30s against your
  custom prayer times) and a random "What are you doing right now?"
  check-in every 1–3 hours. Clicking a check-in notification opens the
  app with the logging modal. In-app toast reminders are the fallback
  when OS notifications are blocked (common on Android in background).
- **Settings** — edit profile, savings goal, prayer times, check-in
  toggle, test notification, dark/light theme, export/import/reset.

## PRD §10 known issues — fixed

1. **Notifications not sending** — notifications are now shown through
   the service worker (`sw.js`), with a direct `Notification API`
   fallback, a permission prompt on first visit, and an in-app toast
   fallback when the OS blocks them. The **Test notification** button
   reports exactly which path succeeded.
2. **Water glass counter** — glass buttons are rebuilt from state on
   every render and use a single **event-delegated** listener on the
   persistent `#waterGrid` container; `handleWaterClick()` is a global
   function, so re-renders can never detach the handler.
3. **Arc text alignment** — the percentage is an HTML overlay centered
   with flexbox instead of SVG `<text>`, so it stays perfectly centered
   at any scale.
4. **Roadmap arrow rotation** — expanded stages are tracked in
   `roadmapOpen` (a Set) and re-applied on every render, so chevrons
   keep their rotation.
5. **Savings budget button** — disabled (with an explainer) whenever
   monthly income − expenses ≤ 0 or the goal is already reached;
   contributions are capped at the remaining goal.

## Data model

`profile` and `logs` in `localStorage` follow PRD §8 exactly
(`religionPractice`, `savingsLog`, `sleepSessions`, `prayerTimes`,
daily logs with `prayers` / `looks` sub-objects, and a top-level
`checkins` array).

## Legacy

`src/` + `package.json` contain an earlier React/Vite/TypeScript
implementation of the same app. It is no longer the primary version —
the static build above is. The React version is only runnable via
`npm install && npm run dev` and is left in place for reference.
