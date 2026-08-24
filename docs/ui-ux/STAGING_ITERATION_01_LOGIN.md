# Staging Iteration 01 — Login Experience

Date: 2026-08-24  
Status: Implemented locally; staging deployment pending visual acceptance workflow access

## 1. Summary

The Login surface now uses a restrained split-screen experience on desktop and a focused single-column experience on small screens. The left panel contains the official Academy brand, a compact sign-in heading, the existing authentication form, password visibility control, forgot-password link, and conditional Google sign-in. The right panel uses the supplied farm video as ambient brand media.

The video logo is intentionally small and top-center aligned, with a localized radial gradient and soft drop shadow to preserve contrast against changing footage. A large Indonesian serif quote rotates directly at the bottom of the video panel every nine seconds with a slow fade/blur/slide entrance; reduced-motion users see a static quote. A restrained lower gradient supports legibility without overpowering the footage. There is no badge, card, icon, or extra label around the quote.

## 2. Files changed

- `src/components/AuthLayout.jsx`
- `src/components/PasswordField.jsx`
- `src/index.css`
- `src/pages/Login.jsx`

## 3. Login architecture

- `AuthLayout` keeps the existing default layout for Register, Forgot Password, and Reset Password.
- Login opts into a dedicated `variant="login"` presentation.
- The desktop grid is approximately 44% form panel / 56% video panel.
- The form remains narrow (`420px` maximum) and uses the existing native API contract.

## 4. Video asset source

Source evidence was available at `.macro-ab-dist/assets/Video-Web_3.mp4`.

The application does not reference that build artifact at runtime.

## 5. Canonical video destination

The existing public asset is used as the runtime source:

`public/assets/Video-Web_3.mp4`

The Login page references it as:

`/assets/Video-Web_3.mp4`

## 6. Responsive behavior

- Desktop: 44/56 split-screen with full-height video.
- Tablet portrait and small mobile: video panel is hidden and authentication takes the full viewport.
- Mobile at `390x844`: no horizontal overflow; form controls remain within a `342px` content width.
- Video behavior: autoplay, muted, loop, plays inline, no controls, `object-fit: cover`.
- The bottom quote is direct text, large, centered, serif, and written in a professional Indonesian editorial tone; it has no badge, card, icon, or label.
- Reduced motion: video autoplay is disabled and insight rotation stops.

## 7. Authentication behavior preserved

- Native `/api/auth/login` endpoint unchanged.
- Session and redirect behavior unchanged.
- Safe `returnTo` handling unchanged.
- Existing forgot-password route unchanged.
- Google sign-in remains conditional on the server provider configuration.
- Password visibility remains a presentation-only control.

## 8. Validation results

- `npm run lint`: passed.
- `npm run build -- --outDir .iteration-01-dist`: passed.
- `git diff --check`: passed.
- Local runtime: no console errors; only existing React Router future-flag warnings.
- Desktop runtime: video source and media flags verified; video reached `readyState=4`.
- Mobile runtime: video hidden and document/body width remained `390px`.
- Password toggle: verified password changes to text and control label changes to “Sembunyikan password”.
- Invalid credentials: existing API error rendered in an alert region.
- Demo credentials: existing demo account successfully redirected to `/`.
- TypeScript comparison: the modified Login/AuthLayout surfaces emit no diagnostics. The repository-wide check remains non-zero because of pre-existing JavaScript typing diagnostics in legacy auth/primitives/data/tool surfaces; current output is 37 diagnostics versus the captured pre-Macro baseline of 56, with no new Login/AuthLayout diagnostic.

## 9. Deployment result

No commit or push was created for this iteration, following the instruction not to commit unless explicitly requested. No cPanel deployment was executed because the connected staging domain currently deploys from the remote `develop` HEAD and the active cPanel session was not available to this task.

The staging health endpoint is reachable and returns HTTP 200, but the staging Login currently serves the older LayerPro build until this iteration is deployed.

## 10. Staging URL

`https://staging.aapmlayeracademy.id/login`

## 11. Known limitations

- Staging is not yet serving this uncommitted Login iteration.
- Google sign-in remains hidden when the private Google OAuth settings are absent.
- The video is approximately 30 MB and is intentionally unchanged; later performance work may add a poster or alternate loading strategy.
- Repository-wide TypeScript cleanup is outside this Login iteration.

## 12. Visual decisions intentionally easy to change

- Desktop split ratio is controlled by the Login grid class in `AuthLayout.jsx`.
- Login heading/subtitle copy is passed from `Login.jsx`.
- The top-center logo size and padding are local to the video panel.
- The top-center logo contrast treatment is local to the video panel and uses a localized radial gradient plus soft drop shadow.
- Rotating quote copy, interval, and entrance animation are local to the `academyInsights` list, timer, and `.academy-insight` style.
- Video overlay opacity, insight treatment, and form spacing are presentation-only changes.
