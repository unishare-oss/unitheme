# Add UniTheme to a UniCorp project

Use `@unishare-oss/unitheme` rather than copying theme CSS from UniShare. This guide
targets **v0.2.0** and React 19+. CSS-only projects can use the palettes without React.

## Choose the integration level

| What you want | What you need |
| --- | --- |
| The same twelve palettes | Package + `themes.css` |
| A theme picker and browser-local preference | React provider + picker + their styles |
| One account theme across apps and devices | Everything above + OIDC login + a same-origin backend proxy to UniAuth |

OIDC is for login. UniTheme is for UI code. UniAuth's preference API stores the selected
theme. You do **not** need the deprecated `uniauth-sdk` or shared authentication cookies.

## 1. Configure private package access

Commit this `.npmrc` in your app repo. The token itself must **not** be committed:

```ini
@unishare-oss:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

For local installation, authenticate with a token that has `read:packages` and permission
to read this private package. If using GitHub CLI:

```sh
gh auth refresh -h github.com -s read:packages
```

Choose **one** installation command, matching the project's package manager:

```sh
# pnpm
NODE_AUTH_TOKEN="$(gh auth token)" pnpm add --save-exact @unishare-oss/unitheme@0.2.0

# Bun
NODE_AUTH_TOKEN="$(gh auth token)" bun add --exact @unishare-oss/unitheme@0.2.0

# npm
NODE_AUTH_TOKEN="$(gh auth token)" npm install --save-exact @unishare-oss/unitheme@0.2.0
```

Run this in the **consuming app workspace**, not automatically at the monorepo root.
If the backend also imports `isThemeId` or `ThemeId`, add the package to that workspace
too. Commit both the package manifest and the updated lockfile.

### GitHub Actions

In the [package settings](https://github.com/orgs/unishare-oss/packages/npm/unitheme/settings),
add the consuming repo under **Manage Actions access**, with **Read** permission.
Adding users/teams under **Manage access** is not the same thing.

The install job then uses its short-lived `GITHUB_TOKEN`:

```yaml
permissions:
  contents: read
  packages: read

steps:
  # Checkout and set up the project's Node/Bun/pnpm versions first.
  - name: Install dependencies
    run: pnpm install --frozen-lockfile
    env:
      NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Replace the install command for Bun (`bun install --frozen-lockfile`) or npm (`npm ci`).
Every job that installs dependencies needs package access. Untrusted fork PRs may lack
access; do not expose credentials to arbitrary fork code to work around that restriction.

### Docker

Copy `.npmrc` into the dependency-install stage. With modern BuildKit, mount the token
only for the install command:

```dockerfile
COPY .npmrc ./
# Copy package manifests and lockfiles before this step as usual.
RUN --mount=type=secret,id=npm_token,env=NODE_AUTH_TOKEN pnpm install --frozen-lockfile
```

In the `docker/build-push-action` step:

```yaml
with:
  secrets: |
    npm_token=${{ secrets.GITHUB_TOKEN }}
```

For a local image build, supply `NODE_AUTH_TOKEN` in your shell and pass
`--secret id=npm_token,env=NODE_AUTH_TOKEN` to `docker build`.
Never pass the token through a Docker `ARG` or persistent `ENV`. Multi-stage images with
another dependency install must mount the secret in that stage too.

## 2. Import the styles and use semantic colors

Import both styles once at the application's global entry point:

```tsx
import '@unishare-oss/unitheme/themes.css'
import '@unishare-oss/unitheme/picker.css'
```

The palette stylesheet supplies defaults even before JavaScript runs. The provider
applies a class such as `theme-nord` to `html` and sets `.dark` for dark palettes.

Components must use the palette variables for their surfaces, borders and text:

```css
body {
  background: var(--background);
  color: var(--foreground);
}

.panel {
  background: var(--card);
  color: var(--card-foreground);
  border: 1px solid var(--border);
}

.primary-button {
  background: var(--primary);
  color: var(--primary-foreground);
}
```

Remove old **palette** definitions from the app's `:root` and old theme stylesheets.
Otherwise import order/specificity can override the shared colors. Keep app-owned
tokens such as fonts, spacing, radii and font scaling. Importing the package alone
does not recolor components with hardcoded `#ffffff`, `bg-white`, etc.

### Tailwind 4

In your global CSS, map the tokens you use to Tailwind colors:

```css
@import 'tailwindcss';
@import '@unishare-oss/unitheme/themes.css';
@import '@unishare-oss/unitheme/picker.css';

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-ring: var(--ring);
}
```

You can now use `bg-background`, `text-foreground`, `bg-card`, `border-border`, etc.
If importing the package styles in CSS, don't import them again in JavaScript.
The picker ships its own CSS; it does not require Tailwind class scanning in `node_modules`.

## 3. Mount the provider and picker

Start with a browser-local integration. No backend is required:

```tsx
import { ThemeProvider, ThemePicker } from '@unishare-oss/unitheme/react'

export function App() {
  return (
    <ThemeProvider>
      {/* Existing app layout/content goes here. */}
      <ThemePicker />
    </ThemeProvider>
  )
}
```

Mount **one** provider around the whole app. Put the picker on an appearance/settings
page; it does not need to be visible on every page. Import the CSS separately as above.
Without an `account` prop, selections persist in this browser only.

### Next.js App Router

Server-render the last displayed theme from a validated, host-only cookie. Put the
provider in a client component and pass it the same initial theme:

```tsx
// components/app-theme-provider.tsx
'use client'

import type { ReactNode } from 'react'
import type { ThemeId } from '@unishare-oss/unitheme'
import { ThemeProvider } from '@unishare-oss/unitheme/react'

export function AppThemeProvider({ children, initialTheme }: {
  children: ReactNode
  initialTheme?: ThemeId
}) {
  return <ThemeProvider initialTheme={initialTheme} persistCookie>{children}</ThemeProvider>
}
```

Use it from the root layout. Cookie validation and class helpers come from the **core**
entry, not the client-only React entry:

```tsx
// app/layout.tsx
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { THEME_COOKIE, isThemeId, isDarkTheme, resolveTheme } from '@unishare-oss/unitheme'
import { AppThemeProvider } from '@/components/app-theme-provider'
import './globals.css' // Includes the shared CSS imports.

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieTheme = (await cookies()).get(THEME_COOKIE)?.value
  const initialTheme = isThemeId(cookieTheme) ? cookieTheme : undefined
  const theme = resolveTheme(initialTheme)
  return (
    <html lang="en" className={`${theme}${isDarkTheme(theme) ? ' dark' : ''}`}>
      <body><AppThemeProvider initialTheme={initialTheme}>{children}</AppThemeProvider></body>
    </html>
  )
}
```

No inline bootstrap, external script, or `suppressHydrationWarning` is needed. The server
and first client render use the same theme. The provider preserves that initial theme
even if localStorage disagrees, and updates the cookie whenever the displayed theme changes.
The package ships compiled JavaScript; no source-package transpilation setting is needed.

The `unicorp-theme` cookie is a **display cache**, not authorization or the canonical
account preference. It is host-only (no Domain), SameSite=Lax, and Secure on HTTPS.
It is deliberately JavaScript-writable so a local selection can update it immediately.
Never trust arbitrary cookie text as an HTML class; always use the catalogue allowlist.

Reading cookies in the root layout opts pages into request-time rendering. Do not
publicly cache the personalized HTML. On a first visit with no valid cookie, the server
renders the default; any legacy localStorage choice migrates on the first client mount.
On a new device or after a change in another app, the latest account theme may still
arrive asynchronously. This avoids a bootstrap, not the need to fetch account preferences.

`initialTheme` is a seed, not a controlled prop: router refreshes must not reset an active
selection. For browser-only apps, the old optional `THEME_BOOTSTRAP` remains available;
authorize it with a CSP nonce/hash when required. They do not need the SSR cookie flow.

## 4. Optional: synchronize through a UniAuth account

First integrate the app with UniAuth using the
[OIDC integration guide](https://github.com/unishare-oss/uniAuth/blob/main/docs/integrating-an-app.md).
The app needs an approved, enabled **confidential first-party client** (`skipConsent`)
and a user access token with `profile` scope. Use `offline_access` when supported to
obtain refresh tokens. UniAuth must already have its theme migration/endpoints deployed.

The request path is:

```text
Browser → app's /api/theme → UniAuth's /api/preferences/theme/exchange
           app session       client Basic auth + user's OAuth access token
```

Do **not** call UniAuth's exchange endpoint directly from the browser. Do not expose
OAuth client secrets/access tokens, share session cookies across domains, or accept a
user ID from the browser as proof of identity.

### Backend endpoint contract

Expose these routes on the app's own origin:

| Route | Browser request | Successful response |
| --- | --- | --- |
| `GET /api/theme` | App session cookie | `{ "theme": "theme-nord" }` or `{ "theme": null }` |
| `POST /api/theme` | App session cookie + `{ "theme": "theme-nord" }` | `{ "theme": "theme-nord" }` |

Both handlers must:

1. Verify the app session server-side and reject guests/unauthenticated requests.
2. Resolve that user's linked UniAuth account. App user IDs and UniAuth subjects need
   not match; never substitute one for the other.
3. Get a valid provider access token, refreshing it through the app's OIDC library.
4. Authenticate the exchange using the app's **server-only** OAuth client credentials.
5. Return only the validated theme payload, with `Cache-Control: no-store`.

For POST, also validate `isThemeId(body.theme)` and protect the cookie-authenticated
write against CSRF (for example, require an exact allowed frontend `Origin`). Return a
non-2xx status when saving fails; the picker uses that to show Retry instead of claiming success.

### Server-to-server exchange example

This helper is server-only. Call it **after** verifying the app session and obtaining
the linked account's valid access token:

```ts
import { Buffer } from 'node:buffer'
import { isThemeId, type ThemeId } from '@unishare-oss/unitheme'

export async function exchangeTheme(
  accessToken: string,
  config: { authOrigin: string; clientId: string; clientSecret: string },
  theme?: ThemeId,
): Promise<{ theme: ThemeId | null }> {
  const credentials = `${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`
  const response = await fetch(
    new URL('/api/preferences/theme/exchange', config.authOrigin),
    {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(credentials).toString('base64')}`,
      },
      body: JSON.stringify({ accessToken, ...(theme ? { theme } : {}) }),
    },
  )
  if (!response.ok) throw new Error('Could not sync your theme')
  const data = await response.json()
  if (!data || (data.theme !== null && !isThemeId(data.theme))) {
    throw new Error('Invalid theme response')
  }
  return { theme: data.theme }
}
```

Omit `theme` to read. Include it to write. UniAuth introspects the token and derives
the account subject itself. It rejects expired/revoked tokens, guests, disabled clients,
and non-first-party clients. Use your OIDC library for token management—not this helper.

**Better Auth 1.7.6 example:** once your verified session gives you `userId`, find its
account row with `providerId: 'uniauth'`, then call:

```ts
const { accessToken } = await auth.api.getAccessToken({
  body: { accountId: account.id, userId },
})
```

Here `account.id` is the app's local **account-row primary key**, not `account.accountId`
(the provider subject). This API varies by library/version; follow your installed version.

### Connect the React provider

Replace the browser-local wrapper with an account-aware one:

```tsx
'use client'

import type { ReactNode } from 'react'
import { createThemeAdapter, type ThemeId } from '@unishare-oss/unitheme'
import { ThemeProvider } from '@unishare-oss/unitheme/react'

// Keep this outside rendering; the adapter's identity must stay stable.
const adapter = createThemeAdapter('/api/theme')

type SessionUser = { id: string; isAnonymous?: boolean | null }

export function AppThemeProvider({ children, user, initialTheme }: {
  children: ReactNode
  user?: SessionUser | null
  initialTheme?: ThemeId
}) {
  // Supply `user` from the app's current session, never URL/localStorage input.
  const account = user && !user.isAnonymous ? { id: user.id, adapter } : undefined
  return <ThemeProvider account={account} initialTheme={initialTheme} persistCookie>{children}</ThemeProvider>
}
```

Wire `user` to your existing session hook/context so login/logout/account changes update
the prop. Backend verification is still mandatory; the frontend prop is not authorization.
For Next.js, keep passing `initialTheme` from the root layout. For a browser-only app,
omit `persistCookie` if you do not need a display cookie.

If the app wraps responses as `{ data: { theme }, ... }`, use
`createThemeAdapter('/api/theme', true)` instead. Other response shapes need a custom
`ThemeAdapter` implementing `load(signal)` and `save(theme, signal)`.

Account preferences refresh on mount, focus, visibility changes and every 60 seconds
while the tab is visible. This is eventual sync, not realtime push. Account caches are
separate by user ID; guest choices use the legacy `theme` localStorage key. An account
with no preference uses the default instead of silently uploading a prior visitor's choice.

## 5. Custom controls and non-React projects

For a custom React control, stay inside the shared provider:

```tsx
import { useTheme } from '@unishare-oss/unitheme/react'

export function NordButton() {
  const { theme, setTheme } = useTheme()
  return <button type="button" aria-pressed={theme === 'theme-nord'}
    onClick={() => setTheme('theme-nord')}>Nord</button>
}
```

Core exports include `THEMES`, `THEME_IDS`, `DEFAULT_THEME`, `isThemeId`, `isDarkTheme`
and the `ThemeId` type. Use those instead of duplicating theme/dark-mode lists.
For SSR, use `THEME_COOKIE`, `resolveTheme`, and optionally `serializeThemeCookie`.

For non-React projects, import `themes.css`, validate the selection with `isThemeId`,
remove the previous catalogue class, then apply the new class to `html`. If using
Tailwind dark variants, toggle `.dark` with `isDarkTheme`. For shared persistence and account synchronization, use `createThemeStore` with
`createBrowserPersistence` and `connectThemeBrowser` (see the README). Build custom
controls with `store.select()` and `store.subscribe()`. The CSS import alone does not
add persistence or synchronization.

## Acceptance checklist

- [ ] Local and CI installs use the published package; manifest and lockfile are committed.
- [ ] CI has package Actions access; Docker receives credentials through a build secret.
- [ ] No copied palette or dark-theme lists remain; components use semantic colors.
- [ ] All twelve themes display correctly, including inputs, popovers and third-party widgets.
- [ ] Keyboard focus and the picker's selected states work; guests restore browser-local choices.
- [ ] SSR HTML has the correct theme class; hydration preserves it and selection updates the host-only cookie.
- [ ] Signed-in selection appears in another app/device after focus or the next visible refresh.
- [ ] Guest/unauthenticated writes are rejected; account switching doesn't upload a prior user's theme.
- [ ] Network/save failures show Retry and don't claim the account preference was saved.
- [ ] No client secret or provider token appears in frontend bundles, API responses or logs.
- [ ] UniAuth's migration/endpoints are deployed before deploying a syncing consumer.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Registry 401/403 | Token scope, package permission, and **Manage Actions access** for the install job's repo. |
| Theme class changes but colors don't | Hardcoded component colors or old `:root` palette overrides. |
| Picker works but doesn't sync | An `account` prop and a working same-origin theme endpoint are both required. |
| Exchange returns 401/403 | Confidential client credentials, valid user token, `profile` scope, approved first-party client, and a non-guest subject. |
| Local save keeps showing Retry | Failed token refresh, missing UniAuth migration, incorrect endpoint, CSRF Origin rejection, or wrong response envelope. |
| Wrong SSR theme | Validate the cookie, pass the same `initialTheme` to the provider, and remove any old bootstrap. An absent cookie/new-device account still needs client resolution. |

New palette releases do not automatically change apps that pin a version. Upgrade through
a focused dependency PR and rerun the acceptance checks. Keep authentication and theme
changes in separate logical commits where practical.
