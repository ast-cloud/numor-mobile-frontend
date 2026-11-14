# Numor mobile

React Native (Expo) app for Numor, rebuilt from the web frontend
([`numor-react-frontend`](https://github.com/ast-cloud/numor-react-frontend)) so that it looks
like the website's mobile layout and behaves the same on Android and iOS. It talks to the
same backend APIs as the website.

## Run it

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** (Android) or the Camera app (iOS).

The backend defaults to `https://backend.numor.app`. To point at another one, copy
`.env.example` to `.env` and change `EXPO_PUBLIC_BACKEND_HOST`.

## What is in the app

| Area | Screens |
| --- | --- |
| Auth | Login, sign up (with email OTP), forgot password, accept invitation |
| SME | Dashboard with chart widgets, Expenses (incl. receipt scan), Invoices (create, edit draft, preview, re-share, clone, status, PDF), Clients, Settings (profile, company, invoice fields, units, payment details, team & permissions) |
| Shared | Sidebar, light/dark theme, AI chatbot (behind the `FF_AI_CHATBOT` flag) |

Not included yet: marketing pages, CA dashboard / CA Connect, admin dashboard, Google sign-in.

## How it stays identical to the web (and across platforms)

- **Same tokens.** `src/theme/tokens.ts` holds the colours, radii and shadows from the web's
  `index.css` / `tailwind.config.ts`, for both light and dark themes.
- **Same class names.** `Box`, `Txt`, `Press` and friends (`src/components/ui`) take the
  Tailwind classes the web uses and resolve them with `twrnc`, so screens are ported
  class-for-class from the web's mobile breakpoint.
- **Same fonts.** Inter and Space Grotesk are bundled, one file per weight, so text renders
  the same on both platforms.
- **No platform widgets.** Dialogs, selects, menus, date pickers, toasts, switches and the
  sidebar are drawn in JS (`overlay.tsx`, `popper.tsx`, `calendar.tsx`) rather than with
  native Android/iOS controls, so they match the web's shadcn components on both.
- **Same logic.** `src/lib/api/*` and the data rules for invoices, income and settings are
  the web files with only browser-specific calls replaced. Invoices render through the same
  `invoice.html` template.

## Deliberate differences from the mobile website

- Line items (invoice dialog) and bill items (expense dialog) are stacked per item. The web
  puts six or seven columns in one row, which is unreadable at phone width.
- The invoice preview header stacks title, status and download instead of one overflowing row.
- Profile photo / logo cropping uses the system photo editor instead of the web crop dialog.
- "Download PDF" opens the PDF in the device browser.
- The app opens on Login (or the dashboard when signed in); the website's landing page is not part of it.

## Google sign-in

The buttons are present but Google sign-in is not wired up. It needs the backend to redirect
back to the app after OAuth (`numor://auth/callback#token=...`) instead of the website URL.

## Project layout

```
src/app          screens (expo-router): login, signup, sme/dashboard, sme/expenses, sme/income, sme/settings ...
src/components   shared components; ui/ is the design-system layer
src/hooks        auth, theme, feature flags, toast, invoice form
src/lib          API clients and helpers shared with the web
src/theme        design tokens and Tailwind config
```
