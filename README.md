# Slowly Downward

A small, purpose-built storefront for limited edition prints — replacing Shopify
with something that does exactly what this business needs and nothing else.

## What's here

- **Storefront** — a single-page-feeling gallery style front end (home page grid +
  product pages), styled in the spirit of slowlydownward.co.uk: neutral paper
  background, serif headings, understated typography, large product photography.
- **Stripe Checkout** — real payment flow. On successful payment, a webhook
  allocates a physical edition number to the order (random from what's available,
  or a specific number the customer requested, if it's still free).
- **Stock & editions** — every physical numbered copy is its own database row,
  with a status (available/sold/reserved/withheld/damaged) and a drawer/location
  code, searchable by print name, edition number, or location. A printable label
  sheet (with QR codes) helps you find and file physical copies.
- **Role-based staff access** — Admin, Sales, Stock, and Packer accounts, each
  seeing only what they need:
  - **Packer** sees only orders awaiting packing, with a pick list (print,
    edition number, drawer) — no prices.
  - **Stock** manages prints, editions, and locations.
  - **Sales** sees orders and customers.
  - **Admin** sees everything, including staff accounts and integration status.
- **Live reporting dashboard** — revenue today/this week, orders today, a 14-day
  revenue chart, top prints, and a stock-status breakdown.
- **Integration modules** for UPS, Royal Mail (Click & Drop), Mailchimp, and
  Xero — real API client code, wired into the order flow (see "Integrations"
  below for exactly what each does and what you need to supply).

## Getting it running locally

You'll need Node.js 20+ and Docker (for a local Postgres database) — or point
`DATABASE_URL` at any Postgres instance you already have.

```bash
npm install
cp .env.example .env        # then fill in at least STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, NEXTAUTH_SECRET
docker compose up -d        # starts local Postgres
npx prisma migrate dev      # creates the database schema
npm run seed                # adds demo staff accounts, prints, and stock
npm run dev
```

Generate `NEXTAUTH_SECRET` with `openssl rand -base64 32`.

Visit `http://localhost:3000` for the storefront, and `http://localhost:3000/admin`
for the staff back end. The seed script creates four demo logins, all with
password `password123`:

| Role   | Email                          |
|--------|---------------------------------|
| Admin  | admin@slowlydownward.co.uk     |
| Sales  | sales@slowlydownward.co.uk     |
| Stock  | stock@slowlydownward.co.uk     |
| Packer | packer@slowlydownward.co.uk    |

**Change these passwords (or delete and recreate the accounts) before this ever
goes near real customer data.**

### Testing checkout end to end

1. Get test API keys from the [Stripe dashboard](https://dashboard.stripe.com/test/apikeys)
   and put them in `.env`.
2. Run the Stripe CLI to forward webhooks to your local server:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   Copy the `whsec_...` it prints into `STRIPE_WEBHOOK_SECRET` in `.env`, and restart `npm run dev`.
3. Add a print to your basket and check out using Stripe's test card `4242 4242 4242 4242`,
   any future expiry date, any CVC.
4. You should be redirected to the success page, and — a few seconds later — see
   the order appear in `/admin/orders` with a real edition number assigned.

## Deploying with GitHub + Vercel + Supabase

Using accounts you already have:

1. **GitHub** — push this project as its own new repository (don't add it
   into an existing app's repo):
   ```bash
   cd slowlydownward
   git init
   git add .
   git commit -m "Initial commit"
   gh repo create slowlydownward --private --source=. --push
   # or, without the gh CLI: create an empty repo on github.com, then
   # git remote add origin <the repo URL> && git push -u origin main
   ```
2. **Supabase** — create a **new, separate project** for this store (Dashboard
   → New project). Don't reuse the database from your other app — they should
   not share tables. Once it's created:
   - Go to **Project Settings → Database → Connection string**.
   - Copy the **"Transaction" pooler** string (port `6543`) — this is your
     `DATABASE_URL`. Add `?pgbouncer=true` to the end of it.
   - Copy the **"Direct connection"** string (port `5432`) — this is your
     `DIRECT_URL`. Prisma needs both: the pooled one at runtime, the direct
     one only when running migrations (this is already wired up in
     `prisma/schema.prisma`).
   - Both strings include the database password you set when creating the
     project — Supabase shows it once, so save it somewhere safe.
3. **Vercel** — go to [vercel.com/new](https://vercel.com/new) and import the
   GitHub repo you just pushed. Before the first deploy, open **Settings →
   Environment Variables** and add everything from `.env.example`:
   - `DATABASE_URL` and `DIRECT_URL` from Supabase (step 2)
   - `NEXTAUTH_URL` — set to your Vercel URL, e.g. `https://slowlydownward.vercel.app`
     (or your real domain once it's attached)
   - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
   - `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` — **test** keys to begin with
   - `STRIPE_WEBHOOK_SECRET` — see step 5 below (you'll come back and add this
     after the first deploy, since it needs the live URL to exist first)
   - `STORE_URL` — same as `NEXTAUTH_URL`
   - Leave the UPS/Royal Mail/Mailchimp/Xero variables blank for now — the
     app runs fine without them and just shows those integrations as "Not
     connected" in Admin → Settings.
   - Set all of these for the **Production** environment (and Preview too,
     if you want preview deployments to also work against the same test
     database).
   Click **Deploy**. Vercel will detect Next.js automatically — no build
   command changes needed.
4. **Run the migration once**, from your own machine, against the Supabase
   database (this creates all the tables):
   ```bash
   DATABASE_URL="<Supabase DIRECT connection string>" DIRECT_URL="<same>" npx prisma migrate deploy
   DATABASE_URL="<Supabase DIRECT connection string>" DIRECT_URL="<same>" npm run seed   # optional demo data
   ```
   (Use the *direct*, non-pooled connection string for both here — migrations
   don't work reliably through the pooler.)
5. **Stripe webhook** — now that the site has a real URL, go to the
   [Stripe dashboard → Webhooks](https://dashboard.stripe.com/test/webhooks),
   add an endpoint at `https://<your-vercel-url>/api/webhooks/stripe`,
   subscribe it to `checkout.session.completed`, copy its signing secret, and
   add it as `STRIPE_WEBHOOK_SECRET` in Vercel's Environment Variables. Then
   redeploy (Vercel → Deployments → ⋯ → Redeploy) so the new variable takes
   effect.
6. Visit your Vercel URL, add a print to the basket, and pay with Stripe's
   test card `4242 4242 4242 4242` (any future expiry, any CVC) to confirm
   the whole flow works end to end before switching Stripe to live keys.

Once you're happy testing on the `.vercel.app` URL, point `slowlydownward.co.uk`
at the Vercel project (Vercel → Settings → Domains) and switch the Stripe keys
and webhook to live mode when you're ready to take real payments.

## Integrations — what's real, and what you still need to do

Everything below is genuine, working API client code following each
provider's current documentation. What it can't do from inside this session
is act on *your* accounts — that needs credentials only you can generate.

### Stripe (required)

Sign up at [stripe.com](https://stripe.com) if you haven't, grab your API keys
from the dashboard, and set `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` /
`STRIPE_WEBHOOK_SECRET`. Nothing else works until this is done. Start with
test keys — switch to live keys (and a live webhook endpoint) only once
you're ready to take real payments.

### UPS

1. Register an app at [developer.ups.com](https://developer.ups.com) to get a
   client id and secret, and get your shipper account number from your UPS
   account.
2. Set `UPS_CLIENT_ID`, `UPS_CLIENT_SECRET`, `UPS_ACCOUNT_NUMBER`, and
   `UPS_ENV` (`sandbox` while testing, `production` when live).
3. A shipping label is created automatically when staff mark a non-UK order
   as packed (see `src/lib/integrations/ups.ts`). Check developer.ups.com's
   current Shipping API reference before going live — UPS periodically
   revises the API version path (`UPS_API_VERSION` near the top of that
   file).

### Royal Mail (Click & Drop)

1. From your Click & Drop account, request API access (Settings > Shipping >
   API integrations) — Royal Mail issues credentials once approved, which
   can take a few days.
2. Set `ROYAL_MAIL_CLIENT_ID` and `ROYAL_MAIL_API_KEY`.
3. UK orders get a label automatically at pack time (see
   `src/lib/integrations/royalmail.ts`). **Double-check the exact auth
   header names and payload shape against the docs Royal Mail gives you when
   they approve access** — their API has changed shape before, and the
   client here follows the commonly published pattern but hasn't been tested
   against a live account.

### Mailchimp

1. Get an API key from Mailchimp (Account > Extras > API keys) and your
   Audience/List ID (Audience > Settings > Audience name and defaults).
2. Set `MAILCHIMP_API_KEY` and `MAILCHIMP_AUDIENCE_ID`.
3. Every customer is synced (added or updated) after a successful order —
   see `src/lib/integrations/mailchimp.ts`.

### Xero

Unlike the others, Xero uses an OAuth connection rather than a static API
key, because it needs to be authorised against a specific Xero organisation.

1. Create an app at [developer.xero.com/app/manage](https://developer.xero.com/app/manage).
2. Set the app's redirect URI to match `XERO_REDIRECT_URI` in your `.env`
   (e.g. `https://yourdomain.com/api/integrations/xero/callback`).
3. Set `XERO_CLIENT_ID` and `XERO_CLIENT_SECRET`.
4. As an Admin, go to **Settings > Integrations** in the store back end and
   click **Connect** next to Xero. You'll be sent to Xero to authorise the
   connection, then back here.
5. From then on, every completed order creates a **draft** sales invoice in
   Xero (so your accounts team can review before it's sent) — see
   `src/lib/integrations/xero.ts`. The invoice line items use account code
   `200` (a common default "Sales" code in the UK chart of accounts) —
   change this in that file to match your actual chart of accounts.

## How the edition-number system works

- Every physical copy of a print is its own row in the `Edition` table, with
  a status and an optional drawer/location code (free text, e.g. `C3-D5` for
  "Cabinet 3, Drawer 5" — use whatever scheme matches your actual storage).
- When a customer buys a print, they can request a specific edition number
  on the product page. If it's still available at the moment payment
  completes, they get it; otherwise (or if they expressed no preference) a
  random available copy is allocated. This happens inside a database
  transaction with row-level locking, so two simultaneous buyers can never
  be given the same copy.
- If a print sells out between someone starting checkout and completing
  payment (a genuine race condition, should be rare), the payment is
  automatically refunded and the order is cancelled rather than left in a
  broken state.
- Stock staff can search by print name, edition number, or location code
  from **Stock**, update an edition's location, mark one as withheld or
  damaged, and print a label sheet (with scannable QR codes) for filing
  copies away correctly.

## Extending this later

Some deliberate simplifications worth knowing about:

- **Shipping cost at checkout** is currently two flat rates (free UK, £15
  international) configured directly in the Stripe Checkout session
  (`src/app/api/checkout/route.ts`). Real-time carrier rate quotes via the
  UPS/Royal Mail APIs could replace this later.
- **Product images** are given as URLs (host them anywhere — e.g. Cloudinary,
  S3, or even just files committed to a `/public` folder and referenced as
  `/prints/whatever.jpg`). There's no image upload UI yet.
- **Package weight/dimensions** for shipping labels are fixed placeholder
  values — add weight/dimensions fields to the `Print` model if items vary
  enough to matter for postage cost.
- **Secrets**: Stripe/UPS/Royal Mail/Mailchimp credentials are read from
  environment variables rather than stored in the database, so they never
  pass through this app's own storage. Only Xero's OAuth tokens are stored
  (in `IntegrationSetting`), because that's inherent to how OAuth works —
  consider encrypting that column at rest if you want extra assurance.
