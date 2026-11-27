# Architecture

## Project layout

```
app/            Routing only (Next.js App Router). page.tsx / route.ts stay thin:
                checks (auth, validation) + a call into db/queries. No .from("...") here.

db/             Everything database (Supabase)
  clients/        browser.ts   client for client components
                  server.ts    server client with the user's cookies (respects RLS)
                  admin.ts     service-role client, bypasses RLS (server only; also reads the public
                               catalog, which the anon key can't since migration 018)
                  proxy.ts     session refresh used by proxy.ts
  queries/        one file per table (or group of tables)
  migrations/     schema history (001–018), applied in order
  types.ts        `Db` type (any Supabase client)

features/       UI and logic per domain. Never writes SQL, calls db/queries.
  shop/ cart/ orders/ bundles/ quiz/ reviews/ wishlist/ account/ auth/ admin/
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
  header search, the quiz and the wishlist. Filter counts wait for the full catalog. The list has no notes
  and only the main image (`toListProduct`); the quick view loads one perfume's notes from
  `/api/catalog/[id]` (cached the same way).
- **Bottle images processed once, on the server.** The pixel code (`bottle-pixels.ts`: white background
  removed, bottle cropped, liquid color estimated) runs with `sharp` when a perfume is saved
  (`features/admin/perfumes/server/cutout.ts`, `lib/render-cutout.ts`). Results are WebP files in Storage
  (`<id>/cutout-384-<key>.webp`, `-828-`) and `perfumes.cutout` (migration 017); `readCutout` uses one only if
  it was made from the current main image with the current `CUTOUT_VERSION`. Existing perfumes are processed
  in batches from Admin > Podešavanja. Without a cutout the browser still does it (`bottle-image.ts`, Web
  Worker with a main-thread fallback), so nothing breaks before the batch has run.
- **Schema changes don't take the shop down.** Selects that name columns added by migration 017 retry
  without them on "column does not exist" (`db/queries/missing-column.ts`), so the catalog and orders keep
  working if the code is deployed before the migration is run.
- **Home screen icon.** `app/icon.tsx` (192/512), `app/apple-icon.tsx` and `app/manifest.ts`, drawn with
  `next/og` (`features/content/components/app-icon`), no image files to maintain.
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
- **Order steps** (`ADMIN_STATUS_TRANSITIONS`): pending → confirmed → shipped → received (delivered), or
  cancelled before shipping. The customer can confirm receipt themselves; the admin marks it once Post
  Express confirms delivery or pays out the cash on delivery. Each step stores its time
  (`confirmed_at`, `shipped_at`, `received_at`).
- **Tracking and payment** (migration 017): `tracking_number` (Post Express; normalized in
  `features/orders/lib/tracking.ts`) goes into the shipping email and the Orders page with a link to Pošta
  Srbije's tracking page (`NEXT_PUBLIC_TRACKING_URL`, `{broj}` placeholder if a direct link is known).
  `paid_at` = money received (IPS transfer or cash on delivery paid out).
- **Guest orders join the account**: `claim_guest_orders` attaches orders without a user to a signed-in
  customer with the same **confirmed** email (on sign-in callback, the Orders page and the review check).

## Emails and daily job

- `features/notifications/server`: order emails (new, confirmed, shipped with tracking, cancelled), review
  request, back in stock. All go through Resend and are skipped without `RESEND_API_KEY` / `EMAIL_FROM`.
- **Daily job** `/api/cron/daily` (schedule in `vercel.json`, protected by `CRON_SECRET`): review request
  3–30 days after delivery (once per order, `review_request_sent_at`; guests are invited to create an
  account), back-in-stock emails that are due, cleanup of old rate-limit counters.
- **"Javi mi kad bude na stanju"** (`stock_alerts`, migration 017): customers create/delete their own alerts
  from the browser (RLS). `notifyBackInStock` runs after an admin save, a stock change and a cancelled
  order, and daily; `dueNotifications` picks alerts whose volume (or any volume) is available, one email
  per customer and perfume, and only a sent email closes the alert.
- **Consent to news** (`profiles.marketing_opt_in`, time set by a trigger): Account settings; Admin >
  Podešavanja shows the count and exports a CSV (`lib/csv.ts`, formula-safe).

## Scraping protection

- **No direct database reads** (migration 018): the anon key that every page carries (sign-in needs it) can't
  read `perfumes`, `perfume_variants`, `bundles`, `shop_settings` or other people's reviews. The server
  reads them with the service role inside `unstable_cache`, so every public query filters `is_active`
  itself. The browser client only touches the customer's own rows (profile, addresses, wishlist, alerts,
  review).
- **Catalog JSON** (`/api/catalog`, `/api/catalog/[id]`): `proxy.ts` refuses requests that clearly aren't
  our pages in a browser (no `Mozilla/` user agent, known crawlers and HTTP tools, `Sec-Fetch-Site:
  cross-site`), see `lib/bot-guard.ts`. The proxy runs before the CDN cache, so this holds for cached
  responses too. Headers can be faked; the real wall is Vercel's Bot Protection (docs/DEPLOYMENT.md).
- **Crawlers**: `app/robots.ts` turns away AI-training and SEO crawlers; search engines and AI search
  assistants still see the shop.
- **Images**: `next.config.ts` lets the image optimizer serve only our Storage bucket (no free image proxy;
  an image still on another site renders `unoptimized`, `canOptimizeImage`). `ImageGuard` blocks
  right-click / long-press saving and dragging of shop images (casual copying only).
- **Shop cards** don't prefetch product pages (a click opens the quick view), so scrolling the shop doesn't
  look like a crawl to the firewall's rate limit.

## Rate limits

- `lib/request-security.ts`: same-origin check + an in-memory limit per server process (first line).
- `lib/shared-rate-limit.ts`: counters in Postgres (`hit_rate_limit`, one atomic upsert) shared by all
  instances, for what costs money or can be brute-forced: the AI chat (per visitor and a site-wide daily
  cap, `CHAT_DAILY_LIMIT`) and coupon checks. Keys use an HMAC of the IP, never the IP itself. If the
  counter isn't available, the routes fall back to the per-process limit.

## Bundles, quiz, similar perfumes

- **Discovery bundles** (`bundles` table): price = sum of current prices for the volume minus the discount
  (`priceBundle`), the same function on `/paketi` and in `/api/orders`. Cart line ID `paket:<id>`.
- **Build-your-own bundle**: 3–5 perfumes of 5 or 10 ml, discount 10/12/15%, cart line ID
  `mojpaket:<id1>+<id2>+…`; the server validates count, volume and stock.
- **Quiz** (`features/quiz`): six questions scored in the browser over the cached catalog.
- **Similar perfumes** (`features/shop/lib/similar.ts`): cosine similarity of accords (65%) + Jaccard of
  notes (35%), gender-aware, at most two per brand.
- **Brand pages** (`/brendovi`, `/brendovi/[slug]`, `features/shop/lib/brands.ts`): A–Z index and one
  prebuilt page per brand from the cached catalog, with metadata, breadcrumbs (JSON-LD) and sitemap entries.
  Product breadcrumbs and the home page brand chips link here.
- **Recently viewed** (`features/shop/lib/recently-viewed.ts`): the last 12 perfume IDs in localStorage,
  shown under the product page; nothing is sent to the server.

## Customer reviews

- **Who can review** (`product_reviews`, migrations 011 and 016): only a signed-in customer with a delivered
  order (`status = 'received'`) containing that perfume, one review per perfume. RLS enforces it; the API
  (`/api/reviews`) checks the same thing first only to give a clear message. Guest orders can't be reviewed.
- **Public name**: first name + initial of the last name ("Marko P."), set by a database trigger from the
  profile (migration 016), so it can't be chosen in the request. The trigger also keeps `updated_at`, locks
  `created_at`/`user_id`/`product_id` and accepts only a volume the customer received.
- **Caching**: `getProductReviews` (`db/queries/reviews.ts`) is cached per perfume (tag `reviews:<id>`); a
  customer's save/delete and an admin delete invalidate only that perfume. The product page stays static.
- **Product page** (`features/reviews`): average, per-star filter, sort, list. Whether the visitor may write a
  review (`/api/reviews/mine`) is fetched only when the section scrolls into view; a customer whose order is
  still "shipped" is told to confirm receipt first. Delivered orders link to the form ("Oceni parfem").
- **Admin > Recenzije**: newest reviews, search, rating filter, delete (the demo account can only read).
- **SEO**: the average and the newest reviews go into the Product JSON-LD (`reviewsStructuredData`).

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
- JSON-LD: Organization + WebSite on the home page, Product + AggregateOffer on product pages, plus
  AggregateRating and Review from this shop's verified customers (third-party Fragrantica ratings are
  intentionally not emitted as `aggregateRating`).
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

- `npm test`: Vitest unit tests for pricing, coupons, shipping, bundles, IPS QR, rating matching, masking,
  reviews.
- `npm run test:e2e`: Playwright (search, full purchase flow, 404) on desktop and mobile; order and coupon
  endpoints are intercepted.
- CI (`.github/workflows/ci.yml`): lint, type check and unit tests on every push; build + E2E when Supabase
  secrets are configured.
