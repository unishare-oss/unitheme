# UniTheme

Shared themes for UniCorp apps. Published as `@unishare-oss/unitheme` on GitHub Packages.
The twelve original UniShare palettes, theme IDs and token names are preserved. Layout,
fonts, spacing and app-specific preferences are deliberately not standardized here.

**Adding themes to another project?** Follow the
[step-by-step app integration guide](https://github.com/unishare-oss/unitheme/blob/main/docs/integrating-an-app.md)
for installation, React/Next.js, Tailwind, CI/Docker access and optional account synchronization.

## Install

Add to the consuming repo's `.npmrc` (never commit a token):

```ini
@unishare-oss:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Use a classic PAT with `read:packages` and access to the private package, or an authorized
GitHub Actions `GITHUB_TOKEN`. Then install `@unishare-oss/unitheme@0.2.0` using your package manager.
CI: grant the consuming repo access under the package's **Manage Actions access** settings,
or provide a `GH_PACKAGES_TOKEN` secret. Docker: pass that token as a BuildKit secret named
`npm_token`, never as a build argument or persistent image environment variable.

## React

```tsx
import '@unishare-oss/unitheme/themes.css'
import '@unishare-oss/unitheme/picker.css'
import { ThemeProvider, ThemePicker } from '@unishare-oss/unitheme/react'
import { createThemeAdapter } from '@unishare-oss/unitheme'

const adapter = createThemeAdapter('/api/theme') // Nest response envelope? second argument: true

function App({ user }: { user?: { id: string } }) {
  return <ThemeProvider account={user ? { id: user.id, adapter } : undefined}>
    <ThemePicker />
  </ThemeProvider>
}
```

Create adapters outside rendering so their identity stays stable. Pass only a verified
non-guest session user. Mount one provider. `useTheme()` exposes `theme`, `setTheme`,
`status`, `retry` and `syncEnabled`. The existing `synced` field is a compatibility
alias for `syncEnabled`; it indicates account sync is enabled, not that a save completed. The picker uses ordinary keyboard-accessible buttons,
pressed states and live save/error feedback. Its CSS is framework-independent.

CSS-only apps import `themes.css` and apply a catalogue class (e.g. `theme-nord`) on `html`.
All palettes expose the same semantic CSS variables and an appropriate `color-scheme`.
The React provider additionally sets `.dark` for existing Tailwind dark variants.
Use `isDarkTheme(id)` instead of maintaining a second list of dark palettes.

Next.js: read `THEME_COOKIE` with `await cookies()`, validate it with `isThemeId`, and
render the resolved theme class (plus `.dark` when appropriate) on `html`. Pass the same
validated `initialTheme` to the provider with `persistCookie`. No bootstrap script or
hydration-warning suppression is required. See the integration guide for complete code.

The host-only `unicorp-theme` cookie caches the last displayed theme for one year; it is
JavaScript-writable, SameSite=Lax, and Secure on HTTPS. It is not an identity/account
preference and cannot authenticate anyone. An absent/invalid cookie uses the default;
legacy localStorage preferences migrate on the first client mount. Account preferences
still resolve asynchronously and update the cookie when they arrive. Cookie-based root
layouts use request-time rendering: do not publicly cache cookie-personalized HTML.

Browser-only apps can still optionally use `THEME_BOOTSTRAP` before paint. With a strict
CSP, authorize that script using your nonce/hash. The new provider options are opt-in;
existing browser-only integrations are unchanged.

## Account synchronization

UniAuth owns the preference; there are no shared auth cookies or client-side OAuth secrets.

- UniAuth UI: `GET /api/preferences/theme` reads, `POST` with `{ theme }` writes. Requires
  a non-guest session; writes require a trusted `Origin`.
- Other apps: their backend obtains/refreshed access token from its OIDC account and POSTs
  `{ accessToken }` to UniAuth's `/api/preferences/theme/exchange` to read, or
  `{ accessToken, theme }` to write. Authenticate with OAuth client HTTP Basic credentials.
- UniAuth introspects the token through its own OAuth provider. Only active Bearer access
  tokens with `profile` scope from enabled first-party (`skipConsent`) clients are accepted.
  Dynamic third-party clients and guests cannot access these preferences. Subject IDs are
  resolved by UniAuth, never accepted from browser input.
- The app exposes a same-origin GET/POST endpoint returning `{ theme: ThemeId | null }`.
  Never expose the OAuth token or client secret in that response.

Account caches are isolated by user ID; guests use the old `theme` localStorage key.
Signing into an account with no preference uses the default rather than silently uploading
the previous visitor's preference. Users can select their old theme once to save it to
their account. Failed saves remain local with an explicit Retry action.
Refresh happens on mount, tab focus, visibility changes and every 60 seconds while visible.
This is eventual synchronization, not a push/realtime channel. Within one app, writes are
serialized and rapid selections coalesced; across devices the last server write wins.

## Theme store and non-React integration

`createThemeStore` owns theme precedence, account identity, pending selections and sync
status independently of React. `ThemeProvider` subscribes with `useSyncExternalStore`.
The existing provider and picker APIs remain compatible.

```ts
import {
  createThemeStore, createBrowserPersistence, connectThemeBrowser,
} from '@unishare-oss/unitheme'

const store = createThemeStore({ persistence: createBrowserPersistence() })
const disconnect = connectThemeBrowser(store, { persistCookie: true })
store.select('theme-nord')
// On session changes: store.setAccount({ id: verifiedUser.id, adapter })
// On logout: store.setAccount(undefined)
// On teardown: disconnect()
```

The browser binding starts the store, applies theme classes/cookies, and owns focus,
visibility, storage events and polling. Its cleanup removes subscriptions/listeners,
stops polling and disposes active requests. Mount one binding per document. A disposed
store can reconnect without resetting the displayed theme or losing pending intent.

Without that binding, call `start()` and `dispose()` yourself. Construction is inert,
so stores can be created during SSR without touching browser APIs. `getServerSnapshot()`
preserves the original seed; `getSnapshot()` returns a stable, immutable snapshot with
`theme`, `status`, `accountId`, `syncEnabled` and `pendingTheme`. `subscribe(listener)`
returns an unsubscribe function. `refresh()` and `retry()` delegate to account sync.
Custom persistence implements `read(key)` and `write(key, theme)`; storage failures do
not prevent an in-memory selection.

Precedence is explicit:

- A valid SSR seed wins on the first start; otherwise use the current identity's local
  cache, then the default.
- Switching identities uses the new identity's cache or the default immediately. It
  cancels old requests and drops the previous identity's pending intent.
- Account responses replace cached values; a null account preference means the default.
- A new local selection wins over an older in-flight read. Pending writes survive a
  lifecycle reconnect in the same store and are retried before fetching account state.
- Logout restores the guest cache. Changing the SSR seed prop later does not reset a
  selection. Unsaved intent is in memory and does not survive a full page reload.

## Development and releases

`palettes.json` is the only palette source of truth. `bun run build` generates metadata,
CSS, ESM/CJS core exports and React declarations. `bun test` exercises catalogue integrity
and the account-sync state machine. The importer is historical; don't run it again over
edits made here.

Update the version, test, commit, then push a matching `vX.Y.Z` tag. The publish workflow
checks the tag and publishes to GitHub Packages. Consumers pin releases and upgrade through
dependency PRs; a palette release never silently changes running apps.
