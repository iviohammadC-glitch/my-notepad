# DailyPad

A Persian-first, local-first personal productivity app built with React 19, TypeScript, Vite, Lucide and locally bundled Vazirmatn fonts. No remote fonts, analytics, account or API key required.

## Run

```sh
npm install
npm run dev
```

The development server listens on `0.0.0.0:5173`. Vite accepts `.e2b.app` preview hosts.

## Build and deploy

```sh
npm run build
```

Deploy the generated `dist/` folder to any static host, preferably over HTTPS (required for reliable browser notification permissions and secure-context APIs). No backend is required. The initial workspace is intentionally empty, with four editable starter categories; test data is never inserted into the user's workspace.

## Features

- Persian RTL and English LTR; Persian calendar in Farsi, Gregorian in English.
- Dashboard, daily plan, six task views, search and filters.
- Task CRUD, priorities, dates/times, reminders, completion, duplication, drag reorder and accessible move-up action.
- Rich notes with autosave, formatting, lists, checklists, links, undo/redo, pinning, colors and categories. Ctrl/Cmd-click a note link to open it safely.
- Calendar month/week/day views. Drag tasks to another date; use the date editor on touch devices.
- Categories with colors/icons, daily habits with historical check-ins and streaks, activity charts.
- Archive, soft deletion, restore and permanent-delete confirmations.
- Light, dark and system appearance. Search and keyboard shortcuts: `T`, `N`, `/`, `Escape`.
- JSON backup export, schema-validated merge/replace import, TXT note export. Replace and clear-data actions require explicit confirmation; clear requires typing `DELETE`.
- Locally bundled fonts; responsive drawer navigation and touch quick-add.

## Data architecture

`src/data.ts` contains the domain types, versioned persistence repository, validation, sanitization, dates, streak calculations and downloads. A future backend can replace the repository boundary. `src/main.tsx` contains app state, reusable UI components, views and dialogs. `src/style.css` contains design tokens, component styles, theme and responsive rules.

Data is saved under `dailypad-v1` in localStorage. Changes from another tab on the same origin are synchronized via storage events (last write wins; not collaborative editing). On an invalid existing backup, the original raw value is copied to `dailypad-recovery` when storage permits recovery. Import merges by item ID; imported records replace matching records, while existing user settings remain. Replace imports all settings too. Notes are sanitized on import/load and paste.

## Important boundaries

- This version is local-only: there is no cloud sync, account, server database or cross-device backup.
- Browser storage is tied to the origin/browser profile. Private browsing, clearing browser data, or changing the app URL can make data unavailable. Export regular JSON backups.
- Reminders are checked about every 10 seconds **while the app is open**. Background tabs may be throttled by the browser. Missed reminders are shown on a later open/check. Closed-app push notifications are not implemented.
- OS notifications depend on browser support and explicit permission. Embedded previews may deny permission; in-app reminders still work.
- Date fields use the browser's native date input (typically Gregorian); Farsi calendar and displayed dates are Persian.
- The rich editor uses browser editing commands, so undo/redo and formatting details can vary between browsers. This release was tested in Chromium; Safari/Firefox have not been independently verified.
- JSON imports are limited to 15 MB, and actual usable storage is subject to the browser's localStorage quota. Save errors are surfaced rather than claiming success.

## Tests

```sh
npx playwright install --with-deps chromium
# Start npm run dev in another terminal
npx playwright test --reporter=line --timeout=60000
```

Two passing browser workflows in `tests/app.spec.ts` cover task create/edit/complete/delete/restore/duplicate/reorder/archive, note creation/edit/autosave/search/formatting/pin/duplicate/archive/delete, task search and view filters, category creation, calendar views, reminder firing, mocked notification permissions, habits/streaks, theme persistence, refresh persistence, JSON export/merge, malformed import errors, clear-data and permanent-delete confirmations, language direction, keyboard shortcuts, and responsive widths (360, 390, 768, 1280, 1440). Native OS notification delivery is not asserted; its permission API is mocked in the notification test.

`npm run build` passes TypeScript checks and creates an optimized production bundle.

## LAN HTTP compatibility fix

Record IDs now use a UUID v4 fallback based on `crypto.getRandomValues()` when `crypto.randomUUID()` is unavailable. This fixes create-task/note/category/habit actions on non-secure LAN URLs such as `http://192.168.1.101:5173`. Browser notifications still require a secure context and permission. `tests/lan.spec.ts` checks creation and persistence on a real non-loopback HTTP address with `isSecureContext === false`. All three browser workflows pass after this fix. This patch does not add accounts or a backend.
