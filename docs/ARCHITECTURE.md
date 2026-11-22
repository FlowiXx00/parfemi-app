# Architecture

## Project layout

```
app/            Routing only (Next.js App Router). page.tsx / route.ts stay thin:
                checks (auth, validation) + a call into db/queries. No .from("...") here.

db/             Everything database (Supabase)
  clients/        browser.ts   client for client components
                  server.ts    server client with the user's cookies (respects RLS)
                  admin.ts     service-role client, bypasses RLS (server only)
                  public.ts    anon client without cookies, for the public catalog
                  proxy.ts     session refresh used by proxy.ts
  queries/        one file per table (or group of tables)
  migrations/     schema history (001–015), applied in order
  types.ts        `Db` type (any Supabase client)

features/       UI and logic per domain. Never writes SQL, calls db/queries.
  shop/ cart/ orders/ bundles/ quiz/ wishlist/ account/ auth/ admin/
  notifications/ analytics/ chat/ home/ about/ content/
    components/   React components (+ their .module.css)
    client/       browser-only code (fetch, localStorage, hooks)
    server/       server-only code
    lib/          pure logic, no React and no database
    types.ts

components/     Shared components that don't belong to one domain (header, footer, auth shell)
lib/            General helpers (format, http, validation, seo, company, site…)
tests/          unit/ (Vitest) and e2e/ (Playwright)
proxy.ts        Next proxy (must stay in the root); runs ONLY on routes that need a session
```

### Database rule

Every function in `db/queries` takes the client as its first argument, so the caller decides which
privileges a query runs with and the SQL lives in one place:

```ts
const { data } = await listOrdersByUser(supabaseAdmin, user.id); // server, service role
const { data } = await listAddresses(await createClient());       // server, RLS
```

## Performance

- **Cached catalog.** `getProducts`, `getProductById` and `getCatalogList` (`db/queries/perfumes.ts`) hit
  the database at most once per 5 minutes. Admin saves call `revalidateCatalog()` to invalidate right away.
- **Large catalog (1,000+ products).** PostgREST returns at most 1,000 rows per query, so `fetchAllPages`
  reads the catalog and the admin list in pages.
- **Static public pages.** `/`, `/shop` and the info pages are prerendered; the 60 most popular product
  pages are prebuilt and the rest render on first visit and are then cached.
- **Light shop page.** Only the first 24 products (in "recommended" order, `features/shop/lib/sort.ts`) are
  in the HTML; the browser fetches the full catalog from the CDN-cached `/api/catalog`, which is shared with
  header search, the quiz and the wishlist. Filter counts wait for the full catalog.
- **Image processing off the main thread.** `features/shop/lib/bottle-image.ts` removes white backgrounds,
  crops the bottle and estimates the liquid color. The pixel work (`bottle-pixels.ts`) runs in a Web Worker
  (`bottle-image.worker.ts`, OffscreenCanvas), with a main-thread fallback for older browsers.
- **Proxy only where needed.** Session refresh runs only on `/settings`, `/addresses`, `/orders`, `/admin`,
  `/auth` and private API routes. Add new authenticated routes to `proxy.ts`.

## Orders, coupons, stock

- **Server-side pricing.** `/api/orders` ignores prices sent by the browser; it reloads them, expands bundles
  into line items and computes discount, shipping and total itself.
- **Coupons** (`coupons` table, migration 013) are managed in Admin > Coupons. Only the server can read the
  table. The cart checks a code via `/api/coupons/check` (rate limited); the order redeems one use
  atomically (`redeem_coupon`) and releases it if the order insert fails (`release_coupon`).
- **Stock** (`perfume_stock`, server only) is tracked in ml per bottle. A volume is available only if enough
  ml are left (`variantAvailable`). Orders deduct atomically (`consume_perfume_stock`, all or nothing);
  cancelling in the admin returns the ml once (`restore_order_stock`). No row = manual "in stock" flag.
- **Shipping** price and free-shipping threshold live in `shop_settings` (Admin > Settings); rules are in
  `features/orders/lib/shipping.ts`.

## Bundles, quiz, similar perfumes

- **Discovery bundles** (`bundles` table): price = sum of current prices for the volume minus the discount
  (`priceBundle`), the same function on `/paketi` and in `/api/orders`. Cart line ID `paket:<id>`.
- **Build-your-own bundle**: 3–5 perfumes of 5 or 10 ml, discount 10/12/15%, cart line ID
  `mojpaket:<id1>+<id2>+…`; the server validates count, volume and stock.
- **Quiz** (`features/quiz`): six questions scored in the browser over the cached catalog.
- **Similar perfumes** (`features/shop/lib/similar.ts`): cosine similarity of accords (65%) + Jaccard of
  notes (35%), gender-aware, at most two per brand.

## Admin

- `app/admin/layout.tsx` → `features/admin/layout/shell`: sidebar (mobile drawer), always dark theme.
- Shared building blocks in `features/admin/ui` (`AdminPageHeader`, `StatusBadge`, `admin-ui.module.css`).
- **Products**: images are mirrored into Supabase Storage on save (`mirror-images.ts`, SSRF-safe fetch);
  cost-based price calculator (`perfume_costs`, service role only); optional "fill from screenshot" (Claude API).
- **Fragrantica ratings**: entered through a bookmarklet that reads the page the admin is viewing; a title
  check warns about flankers. Nothing is scraped automatically.
- **Demo role** (migration 015): full read access, every write is rejected server-side (HTTP 423) and
  customer data is masked (`features/admin/demo/mask.ts`). Only GET routes pass `{ allowDemo: true }`.

## Payments: IPS QR

`features/orders/lib/ips-qr.ts` builds the NBS IPS QR payload (account checked with MOD 97-10) and
`features/orders/server/ips-payment.ts` renders the QR as SVG. The customer sees it after placing an order
and the same details go into the confirmation email. Enabled with `IPS_ACCOUNT_NUMBER` and `IPS_PAYEE_NAME`.

## SEO

- Per-page title, description and canonical (`pageMetadata` in `lib/seo.ts`); private pages are `noindex`.
  No canonical in the root layout, since every page without its own would inherit it.
- Share images: `app/opengraph-image.tsx` and `app/(site)/shop/[id]/opengraph-image.tsx` (AVIF photos are
  converted with `sharp`).
- JSON-LD: Organization + WebSite on the home page, Product + AggregateOffer on product pages
  (third-party ratings are intentionally not emitted as `aggregateRating`).
- `app/sitemap.ts`, `app/robots.ts`, custom 404/500 pages and loading skeletons.

## Legal (Serbia)

- Seller details come from env (`NEXT_PUBLIC_COMPANY_*`, `lib/company.ts`).
- Terms, privacy policy, cookie policy and a returns page with the withdrawal form follow the Consumer
  Protection Act and the Personal Data Protection Act.
- Analytics load only after consent; "Cookie settings" in the footer reopens the choice and withdrawing
  consent deletes `_ga*` / `_fbp` cookies.

## Responsive layout

- Content widths are CSS variables in `app/globals.css` (`--section-width*`); they grow on large monitors.
- No `100vw` for widths (it includes the scrollbar on Windows); `overflow-x: clip` keeps `position: sticky` working.
- Shop grid: `repeat(auto-fill, minmax(210px, 1fr))`; cards and the quick view adapt via `@container`.

## Testing

- `npm test`: Vitest unit tests for pricing, coupons, shipping, bundles, IPS QR, rating matching, masking.
- `npm run test:e2e`: Playwright (search, full purchase flow, 404) on desktop and mobile; order and coupon
  endpoints are intercepted.
- CI (`.github/workflows/ci.yml`): lint, type check and unit tests on every push; build + E2E when Supabase
  secrets are configured.
