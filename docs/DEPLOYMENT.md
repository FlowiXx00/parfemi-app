# Deployment

Vercel (hosting) + custom domain + Supabase + transactional email.

## 1. Vercel

1. Import the GitHub repository in Vercel (**Add New… → Project**). The Next.js preset needs no changes.
2. Add the environment variables before the first deploy:

   | Variable | Required | Notes |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | yes | |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | |
   | `SUPABASE_SERVICE_ROLE_KEY` | yes | server only, never exposed to the client |
   | `NEXT_PUBLIC_SITE_URL` | yes | production URL (email links, sitemap, share cards) |
   | `NEXT_PUBLIC_COMPANY_NAME`, `_ADDRESS`, `_PIB`, `_MB` | for selling | seller details shown in the footer and legal pages |
   | `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_NOTIFY_EMAIL` | recommended | order emails |
   | `IPS_ACCOUNT_NUMBER`, `IPS_PAYEE_NAME` | recommended | IPS QR payment after checkout |
   | `ANTHROPIC_API_KEY` | optional | shopping assistant and "fill from screenshot" |
   | `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_META_PIXEL_ID` | optional | analytics, loaded only after cookie consent |
   | `CRON_SECRET` | recommended | daily job (`vercel.json`): review requests, back-in-stock emails, cleanup |
   | `NEXT_PUBLIC_INSTAGRAM_URL`, `_TIKTOK_URL`, `_FACEBOOK_URL` | optional | footer icons and `sameAs` |
   | `NEXT_PUBLIC_TRACKING_URL` | optional | shipment tracking page (default: Pošta Srbije) |

3. Deploy. Every push to `main` deploys production; other branches get preview URLs.
4. **Firewall (bot protection, all plans, free):** project → **Firewall** → **Rules** → *Bot Management*:
   - **Bot Protection** → `Challenge`. Non-browser traffic has to pass a challenge; verified bots
     (Googlebot, Bingbot…) pass automatically, so search ranking isn't affected.
   - **AI Bots** → configure: *AI Crawlers* `Deny` (training), *AI Assistants* `Allow` (ChatGPT search,
     Perplexity can still recommend the shop).
   - Optional rate limit (Hobby has one rule): *Request Path* starts with `/shop/` or `/api/catalog`,
     120 requests per 60 s per IP, action `Challenge`. Shop cards don't prefetch product pages, so
     normal browsing stays well below it.
   - **Review Changes → Publish.** Mitigated (denied/challenged) requests don't count toward usage.
   - Under attack: Firewall → `⋯` → **Enable Attack Mode** (1/6/24 h; search engines still pass).

## 2. Domain

Add the apex and `www` domains under **Settings → Domains**, create the DNS records Vercel shows, then
update `NEXT_PUBLIC_SITE_URL` and redeploy. HTTPS certificates are issued automatically.

## 3. Supabase

1. Apply the SQL files in `db/migrations/` in order. Run a new migration **before** deploying the code that
   uses it (the catalog and orders tolerate a missing column, but new features stay off until then).
   After 017, open Admin → Podešavanja → "Slike bočica" once to process existing bottle images.
   018 removes direct reads with the anon key: deploy the code that reads the catalog with the service
   role (this version) first, or run 018 right after the deploy.
2. **Authentication → URL Configuration**: set the Site URL to the production domain and add
   `https://<domain>/auth/callback` and `https://*.vercel.app/auth/callback` to the redirect URLs.
3. **Authentication → Emails → SMTP**: use a real SMTP provider (e.g. Resend: `smtp.resend.com`, port 465,
   user `resend`, password = API key). The built-in sender is limited to a few emails per hour.
4. Free projects pause after 7 days without traffic; the Pro plan also adds daily backups.

## 4. Email (Resend)

Verify the sending domain in Resend (SPF/DKIM records), create an API key and set `RESEND_API_KEY`,
`EMAIL_FROM` and `ADMIN_NOTIFY_EMAIL`. A test order should send a confirmation to the customer and a
notification to the owner.

## 5. Read-only demo account

Register the demo user through the site, then assign the `demo` role:

```sql
insert into public.user_roles (user_id, role_id)
select id, 3 from auth.users where email = 'demo@example.com';
```

The admin then shows a "demo" banner, masks customer data and rejects every change.

## 6. CI secrets

Lint, type check and unit tests run on every push. For the build + E2E job, add
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` under
**Settings → Secrets and variables → Actions**. The E2E suite intercepts order and coupon requests.

## 7. Post-launch checklist

- [ ] Place a test order end to end (including the IPS QR screen)
- [ ] Sign up, sign in, password reset emails
- [ ] Change an order status in the admin and confirm the customer email (shipped: with the tracking number)
- [ ] Vercel → Settings → Cron Jobs shows `/api/cron/daily`; "Run" returns `ok: true`
- [ ] Firewall: Bot Protection on `Challenge`, AI Crawlers on `Deny`; `curl https://<domain>/api/catalog`
      returns 403
- [ ] Submit `/sitemap.xml` in Google Search Console
- [ ] Check a product page in the Rich Results Test and a product link in the Facebook Sharing Debugger
- [ ] Have the legal pages reviewed before selling
- [ ] If analytics is enabled, verify the cookie banner and the "Cookie settings" footer link
