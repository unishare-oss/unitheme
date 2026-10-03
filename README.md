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
`status`, `retry` and `synced`. The picker uses ordinary keyboard-accessible buttons,
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

## Development and releases

`palettes.json` is the only palette source of truth. `bun run build` generates metadata,
CSS, ESM/CJS core exports and React declarations. `bun test` exercises catalogue integrity
and the account-sync state machine. The importer is historical; don't run it again over
edits made here.

Update the version, test, commit, then push a matching `vX.Y.Z` tag. The publish workflow
checks the tag and publishes to GitHub Packages. Consumers pin releases and upgrade through
dependency PRs; a palette release never silently changes running apps.
