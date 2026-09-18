# Slowly Downward

A small, purpose-built storefront for limited edition prints — replacing Shopify
with something that does exactly what this business needs and nothing else.

## What's here

- **Storefront** — a single-page-feeling gallery style front end (home page grid +
  product pages), styled in the spirit of slowlydownward.co.uk: clean white
  background, serif headings, understated typography, large product photography
  that's never cropped — every product image scales to fit its frame exactly,
  with no forced aspect ratio and no empty space around it.
- **Self-serve page builder** — Admin → Pages lets you edit the home page, add
  new standalone pages (About, FAQ, a lookbook — anything at `/whatever-you-call-it`),
  and add extra content to any print's product page, all by dragging content
  blocks around in the browser — no code or deploy needed. See "Building &
  editing pages" below.
- **Stripe Checkout** — real payment flow. On successful payment, a webhook
  allocates a physical edition number to the order (random from what's available,
  or a specific number the customer requested, if it's still free).
- **Product management** — Admin → Product lists every print with a thumbnail,
  price, stock level, and published status; clicking one opens its own page for
  description, drag-and-drop photos, paper size, image size, and medium (a
  dropdown you manage yourself). See "Managing products & stock" below.
- **Stock & editions** — every physical numbered copy is its own database row,
  with a status (available/sold/reserved/withheld/damaged). All copies of one
  edition share a single drawer/location, set from that print's Stock details
  page and searchable from Admin → Product. Sold copies show who bought them.
  A printable label sheet (with QR codes) helps you find and file physical copies.
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
- **Campaigns & newsletter archive** — Admin → Campaigns composes and sends
  marketing email via Resend Broadcasts (Mailchimp's old campaign feature,
  replaced); every campaign sent from there is also public at `/archive`,
  so customers can browse past newsletters. See "Resend Broadcasts
  (campaigns)" below.

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

**If clicking "Checkout" shows an error instead of redirecting to Stripe** —
including a browser error like `Unexpected end of JSON input` — it almost
always means `STRIPE_SECRET_KEY` or `STORE_URL` is missing or still a
placeholder in `.env`. The checkout page now shows a plain-English message
telling you which one, instead of that cryptic error.

If instead you see a message about **"Managed Payments"** — some newer
Stripe accounts have this on by default, and it doesn't allow the site's own
shipping options (free UK / £15 international) to be set on the checkout
session. The code already turns Managed Payments off for each checkout
session so the site's own shipping rates keep working; nothing to change in
your Stripe dashboard.

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
   - `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — same Supabase
     project as `DATABASE_URL` (step 2); see "Image uploads" below. Without
     these the drag-and-drop image picker won't work on the live site, even
     if they're set correctly in your own local `.env` — Vercel keeps its
     own separate copy of every environment variable, so each one has to be
     added here too.
   - `RESEND_API_KEY`, `RESEND_FROM_EMAIL` — see "Resend" below. Without
     these, order confirmation/payment-link/welcome emails silently don't
     send (everything else still works).
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
3. Set your shipping-from address too — `STORE_ADDRESS_NAME`,
   `STORE_ADDRESS_LINE1` (and `_LINE2` if needed), `STORE_ADDRESS_CITY`,
   `STORE_ADDRESS_POSTAL_CODE`, `STORE_ADDRESS_COUNTRY`. This is what UPS
   rates and labels use as the "from" address — without it, the packing
   tab shows "Your shipping address isn't set" instead of a UPS quote.
   - **Rate quotes ask UPS for your account's negotiated (discounted) rate,
     not the published retail rate** — if a quote still looks too high,
     ask your UPS account rep to confirm "negotiated rates via the API" are
     switched on for your account.
   - **Sandbox rates are test data, not real numbers.** While
     `UPS_ENV=sandbox`, expect quotes that don't resemble your real pricing
     at all — that's normal for UPS's test environment. Getting a rate
     quote never creates a shipment or charges anything, so it's safe to
     point `UPS_ENV` at `production` with your live credentials just to
     check real pricing looks right, before you're ready to create actual
     labels.
4. On the packing tab, staff pick a carrier per order — a live UPS quote is
   fetched automatically when both of the above are set (see
   `src/lib/integrations/ups.ts`), and choosing UPS creates the label. The
   quote and label now use each print's real weight/dimensions (see
   "Shipping & customs details on products" below) rather than a flat guess.
   Check developer.ups.com's current Shipping/Rating API reference before
   going live — UPS periodically revises the API version path
   (`UPS_API_VERSION` near the top of that file).
5. Once a UPS order has a tracking number, "Refresh from carrier" on that
   order's detail page calls UPS's Track API for its current status —
   double-check that endpoint against developer.ups.com too, it hasn't
   been tested against a live shipment.
6. For any order shipping outside the UK (Europe or rest-of-world — the UK
   left the EU customs union, so this includes Europe, not just ROW), a
   commercial invoice is generated automatically and uploaded to UPS's
   Paperless Documents API before the label is created, so no printed
   invoice needs to travel inside the parcel. This needs your UPS account to
   be enrolled in the Paperless Invoice programme — if uploads are refused,
   ask your UPS account rep to enable it. If the upload fails for any
   reason, packing still goes ahead (the customs data is sent directly on
   the shipment instead, and you get a warning) so a hiccup here never blocks
   getting an order out the door. **Verify the Paperless Documents API path
   and payload shape against developer.ups.com** — same caveat as the other
   UPS endpoints, this hasn't been tested against a live account.

### Shipping & customs details on products

Each print's edit page (Admin → Product → open a print) now has a
"Shipping & customs" section: weight, packed dimensions, a customs value per
unit (defaults to the sale price if left blank), a customs description, and
an HS/commodity tariff code. These feed:

- the live UPS rate quote and shipment on the packing tab (previously a flat
  1kg placeholder for every print);
- the commercial invoice generated for international orders (see above and
  "Commercial invoice" below).

Nothing breaks if these are left blank — a generic weight, size, and HS code
are used instead — but the packing tab flags an order with a warning when it's
relying on placeholders, so you know which prints still need real numbers.
The default HS code used is `9702.00` ("original engravings, prints and
lithographs"), a reasonable starting point for limited-edition prints but
**not a substitute for checking the correct code for a specific print** —
use HMRC's Trade Tariff tool or your customs broker, then set it per print to
override the default.

### Commercial invoice

Every order with a shipping address has a downloadable commercial invoice at
**"View commercial invoice (PDF)"** on its order detail page — built from the
order's items, your store address (`STORE_ADDRESS_*`), and each print's
customs details. It's the same document sent to UPS electronically for
paperless customs, kept available here as your own record and as a manual
backup (print it and put a copy in the parcel, or attach it by hand in
another carrier's system) if the automatic upload ever fails.

### Royal Mail (Click & Drop)

1. From your Click & Drop account, request API access (Settings > Shipping >
   API integrations) — Royal Mail issues credentials once approved, which
   can take a few days.
2. Set `ROYAL_MAIL_CLIENT_ID` and `ROYAL_MAIL_API_KEY`.
3. Choosing Royal Mail on the packing tab creates a label (see
   `src/lib/integrations/royalmail.ts`) and, once there's a tracking
   number, "Refresh from carrier" on the order page pulls its current
   status. **Double-check the exact auth header names and payload/endpoint
   shapes against the docs Royal Mail gives you when they approve access**
   — their API has changed shape before, and the client here follows the
   commonly published pattern but hasn't been tested against a live
   account.
4. Royal Mail doesn't offer a live "shop for a rate" API the way UPS does —
   your cost is fixed by your contract to a published price per destination,
   package size, and weight band, not quoted per-shipment. So instead of
   guessing, set that price list up at **Admin > Settings > Shipping >
   Royal Mail price list**:
   - **Bulk import** (the practical option for a real price sheet, which can
     run to hundreds of rows): upload a CSV with columns `country_code,
     service, max_weight_g, max_length_cm, max_width_cm, max_height_cm,
     price_gbp` — download the "example CSV" link on that page to see the
     exact format expected. Leave `country_code` blank on a row for a
     catch-all "rest of world" rate used when nothing more specific matches.
     Dimension columns are optional — leave them blank to price by weight
     only. Uploading **replaces** the whole list, so re-upload to update it
     later too.
   - Or add/edit rows individually in the table below the upload box.
   The packing tab looks up the row that matches the order's real
   destination country (falling back to a catch-all row if no exact-country
   row exists), and whose weight/size limits the order's actual weight and
   dimensions fit under (from each print's own weight/size — see "Shipping
   & customs details on products") — picking the cheapest matching row if
   more than one fits. If nothing on file covers a parcel's real size or
   weight for that destination, the largest matching row's price is shown
   flagged as an estimate rather than refusing to quote.

### Resend (email)

Powers exactly one thing right now: the payment-link email sent when you
create a manual order (see **Manual orders**, below). General order/shipping
notification emails are a separate, later piece of work.

1. Sign up at [resend.com](https://resend.com) (the free tier is plenty for
   this).
2. Under **Domains**, add and verify a sending domain — follow their DNS
   instructions. While you're testing, you can skip this and send from their
   shared `onboarding@resend.dev` address instead, but that one can only
   send to your own account email, not real customers.
3. Under **API Keys**, create a key.
4. Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` (e.g.
   `"Slowly Downward <orders@yourdomain.com>"`) in `.env`, then restart the
   server. **Settings → Integrations** will show "Connected" once it's set.

### Mailchimp

1. Get an API key from Mailchimp (Account > Extras > API keys) and your
   Audience/List ID (Audience > Settings > Audience name and defaults).
2. Set `MAILCHIMP_API_KEY` and `MAILCHIMP_AUDIENCE_ID`.
3. Every customer is synced (added or updated) after a successful order —
   see `src/lib/integrations/mailchimp.ts`.
4. Being phased out — Admin > Campaigns (Resend Broadcasts, below) now
   covers the campaign-sending half of what Mailchimp was used for. This
   sync can be removed once you're confident you don't need it as a
   fallback any more.

### Resend Broadcasts (campaigns)

Powers **Admin > Campaigns** — composing and sending a newsletter/marketing
email, as a replacement for Mailchimp's campaign feature. Uses the same
`RESEND_API_KEY` / `RESEND_FROM_EMAIL` as transactional email above; nothing
extra to sign up for.

1. Nothing to configure to start composing and sending — the two audiences
   ("everyone opted in" and "customers") are created automatically the
   first time they're needed (see `getMarketingSegments` in
   `src/lib/integrations/resend-broadcasts.ts`) and kept in sync as people
   subscribe to the newsletter or place an order.
2. For opens/clicks to show up on a sent campaign, and for a hard bounce or
   spam complaint to automatically turn off that address's marketing email
   (the "auto cleaning" Mailchimp did for you) — once the site has a real
   URL, go to [Resend → Webhooks](https://resend.com/webhooks), add an
   endpoint at `https://<your-vercel-url>/api/webhooks/resend`, subscribe it
   to at least `email.opened`, `email.clicked`, `email.bounced` and
   `email.complained`, copy its signing secret, and set it as
   `RESEND_WEBHOOK_SECRET` in Vercel's Environment Variables (then redeploy).
   Campaigns can be composed and sent without this step — you'd just have no
   opens/clicks numbers and no automatic bounce cleanup until it's done.
3. **Newsletter archive** — every campaign sent from here is automatically
   public at `/archive` (and `/archive/<id>` for each one) — nothing extra
   to publish, it's reading the same `Campaign` row the send just created. A
   still-draft or scheduled campaign never shows there; only `SENT` ones. A
   link to it sits under the newsletter signup form in the footer.
4. **One-off historical import** — brings your existing Mailchimp campaign
   history into that same archive, so it isn't just Resend-forward from
   today. This is a deliberate one-time backfill (not something the app
   does automatically), and it needs your production database, not the
   local dev one:
   ```bash
   npx prisma migrate deploy   # if you haven't already run the latest migration
   MAILCHIMP_API_KEY="..." \
   DATABASE_URL="<Supabase DIRECT connection string>" \
   DIRECT_URL="<same>" \
   npm run import:mailchimp-campaigns
   ```
   Pulls every already-sent Mailchimp campaign (subject + HTML + send date)
   and upserts it into `Campaign` keyed on its Mailchimp id
   (`mailchimpCampaignId`) — safe to re-run, a second pass just updates
   rows it already imported rather than duplicating them. See
   `scripts/import-mailchimp-campaigns.ts`. Ask Claude to run this once
   both API keys are available if you'd rather not run it yourself.
   For syncing your subscriber *list* into Resend (rather than campaign
   history), see `upsertResendContact` — that's a separate concern from
   this script.

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

## Managing products & stock

**Admin → Product** (Admin and Stock roles) is where every print is listed —
a thumbnail, name, price, stock level, and published status, in that order.

- Click a product to open its own page: a rich-text description (bold,
  italic, links, lists — same small editor as the page builder), a primary
  image and a gallery of additional images (both drag-and-drop), price,
  year, edition size, paper size, print size, a **medium** dropdown
  (Screenprint, Giclée, Mug, Book, or whatever you've added — see below),
  and technique. **Save product** returns you to the product list.
  Publish/Unpublish lives here too.
- **Edition size** accepts either a number or the word **open**. A number
  creates (or trims) that many numbered copies to match — growing adds the
  new numbers, shrinking removes only unsold copies from the top of the
  numbering, and never touches one that's already sold, reserved, withheld,
  or damaged. Typing **open** instead marks it as an open edition — not
  limited or numbered (a mug or a book printed on demand, say) — and no
  edition numbers or remaining-copy counts are shown for it anywhere on the
  storefront, checkout, or admin; it also never shows as "sold out" and has
  no quantity limit at checkout.
- From a product's page, the **Stock** button opens its stock details — the
  full list of numbered copies, filterable by status (Available / Sold /
  Reserved / Withheld / Damaged).
- **Product mediums** — Admin → Settings → "Product mediums" is where you
  manage the options offered in that dropdown. Add new ones (e.g. "Etching")
  any time; nothing needs a code change.

## How the edition-number system works

- Every physical copy of a print is its own row in the `Edition` table.
  Because every copy of one edition is stored together, there's a single
  drawer/location for the whole print (free text, e.g. `C3-D5` for "Cabinet
  3, Drawer 5" — use whatever scheme matches your actual storage) rather
  than one per copy — set it at the top of that product's Stock details page.
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
- A sold copy's row shows who bought it (the name captured at Stripe
  checkout, or their email if no name was given) — so a print's Stock
  details page doubles as a record of which customer owns which numbered
  copy, ready for a future "my collection" view in the member area.
- Stock staff can search by product name, edition number, or drawer number
  from **Product**, update an edition's status (withheld/damaged/back to
  available), and print a label sheet (with scannable QR codes) for filing
  copies away correctly.
- **Open editions** (edition size set to "open") skip all of this — there
  are no Edition rows, nothing to allocate at checkout, and no numbers to
  search or label. Its Stock details page says so rather than showing an
  empty list.

## Building & editing pages

Everything a shop-runner needs to change day to day — wording, images, whole
new pages — lives in **Admin → Pages**, restricted to the Admin role. Nothing
here needs a code change or a redeploy.

- **The home page** is itself just a page (address `home`, created by
  `npm run seed`). Open it from Admin → Pages to edit its hero text and the
  grid of prints it shows.
- **New standalone pages** — click "New page" from Admin → Pages, give it a
  title and (optionally) an address, and it's live at `/<that address>` once
  you publish it. A seeded example lives at `/about`. The header itself only
  shows the logo, currency, account, and cart (see "Header & branding"
  below) — a new page isn't linked from the header automatically, so link to
  it from wherever makes sense (a text/button block on the home page, your
  footer, etc.).
- **Product page content** — Admin → Pages → "Edit product page content"
  lets you add extra blocks (more photos, a longer story, a quote) below the
  fixed photo/price/buy box on any print's page. The core details (price,
  technique, paper/print size, stock) are still edited from **Product**, not
  here.
- **Content blocks** are the building unit for all of the above: hero
  heading, text, image, image + text, image gallery, quote, button/link,
  spacer, and a print grid (all published prints, one collection, or a
  hand-picked list). Add, delete, duplicate, and drag to reorder them in the
  editor; hit **Save changes** when you're happy. A page can be left as a
  **Draft** — visible only to you, signed in — until you're ready to publish.
- Everything is stored as plain JSON (`Page.blocks` / `Print.contentBlocks`
  in the database) and validated against the schemas in `src/lib/blocks.ts`
  on save, so a future developer extending this — a new block type — has one
  place to start.
- **Image blocks** (hero banner, image, image + text, gallery) use drag-and-drop
  — drop a photo in, or click to browse for one, and it uploads automatically.
  This needs a one-time Storage setup; see "Image uploads" below.
- **Text blocks** (text, image + text) use a small rich-text editor — bold,
  italic, underline, links, and lists. It saves plain sanitized HTML, so
  there's nothing extra to configure.

### Image uploads

Uploaded images are stored in Supabase Storage (the same Supabase project
already used for the database), so there's no separate service to sign up
for.

1. In your Supabase project's dashboard, go to **Storage** and create a new
   bucket named exactly `site-images`, with **Public bucket** switched on
   (so the images can actually be shown on your site).
2. Go to **Project Settings > API** and copy two values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL` in `.env`
   - **service_role** secret key → `SUPABASE_SERVICE_ROLE_KEY` in `.env`
     (this is a powerful key — it's only ever used on the server, never sent
     to visitors' browsers, so keep it out of git same as your other secrets)
3. Restart `npm run dev` after saving `.env` so the new variables are picked up.

Without this set up, the drag-and-drop image picker will show an error
telling you what's missing — the "paste an image URL instead" option under
each image picker still works regardless, for images already hosted
elsewhere.

## Header & branding

**Admin → Settings → Header & branding** (Admin role only) controls the bar
shown at the top of every storefront page, with a live preview of your
actual header right there on the page.

- **Logo** — text (e.g. "Slowly Downward"), an uploaded/dragged-in image, or
  none at all. Switch between them any time without losing what you typed or
  uploaded — each is remembered even while a different option is selected.
  **Remove logo** clears it back to nothing in one click.
- **Logo position** — left, centre, or right.
- **Logo size** — use the **−** / **+** buttons to scale the logo down or up
  (25%–300% of its normal size), for either a text or an image logo.
- **Cart and account icons** — shown as simple default icons by default;
  upload your own image for either (e.g. a custom cart glyph) to replace it.
  Turn either off entirely with its checkbox. The account icon links to
  `/account` — sign in, create an account, or continue as a guest.
- **Currency selector** — see below. Turn it off if you'd rather the header
  only ever show your own currency.
- There are deliberately no text links (Prints / About / The Archive, etc.)
  in the header any more — the header is just branding + currency + account
  + cart. Link to other pages from content blocks or the footer instead (see
  "Building & editing pages" and "Footer" below).
- The header has no dividing line under it, and more vertical breathing room
  than a typical site header — both deliberate, not something to fix.

## Typography

**Admin → Settings → Typography** controls which typeface is used for two
roles across the whole site:

- **Headings & print titles** — the font print titles, page headings, and
  section titles are shown in (previously always a serif "Times New Roman"
  look, hardcoded).
- **Body text** — the font used everywhere else (paragraphs, labels,
  buttons).

Each is a dropdown of common, already-installed typefaces (Times New Roman,
Georgia, Garamond, Helvetica, Arial, Avenir, Courier) — no fonts to
upload or licence, and a live preview shows each choice before you save.
Changing either applies across the entire site immediately, no restart
needed.

## Footer

**Admin → Settings → Footer** controls everything shown at the bottom of
every storefront page — none of it is hardcoded any more.

- **Text** — both left-hand columns' headings and body text (the "The
  Archive" blurb and the "Excuse Me" newsletter blurb, by default), the
  "Information" column's own heading, the copyright name shown as "© [year]
  [this name]", and the small badge text bottom-right ("Stripe secure
  checkout" by default).
  - The email signup form under the second column isn't wired up to a
    mailing list yet — it's a placeholder, same as before.
- **Links** — the "Information" column is a list of links, each pointing to
  a page built in Admin → Pages. For each you can:
  - Edit its **label** — the text shown in the footer — independently of
    the page's own title.
  - **Reorder** it with the ▲/▼ buttons.
  - **Remove** it from the footer without deleting the underlying page (add
    it back later, or reach the page directly at its own address).
  - Jump straight to **editing its content**.
  - **Add a brand new page**, right from this screen — type a title, and it
    creates a published (initially empty) page, adds it to the end of the
    footer, and takes you straight to its content editor to fill in.
  Three links exist out of the box — Shipping & returns, Authenticity &
  care, Contact — each with placeholder content to replace with your own.

## Shipping

**Admin → Settings → Shipping** controls what customers pay for delivery.
There are three zones — UK, Europe, and Rest of world — each with:

- An editable **price**, charged in GBP.
- An editable **name**, shown to the customer at checkout.
- A list of **countries** it covers, via a dropdown next to every country
  ("Not shipped" / "United Kingdom" / "Europe" / "Rest of world"). A country
  left as "Not shipped" simply won't appear as an option at checkout at
  all — there's no need to remove it from anywhere else.

On the cart page, customers pick their country from a "Ship to" dropdown
before checking out — it only ever lists countries you've assigned to a
zone, each showing its price right there in the list, and the page's total
updates immediately. The price charged is always the current zone price, and
Stripe itself is locked to that one country when the customer gets there.

### Customer accounts (sign in / guest checkout)

The cart page now offers a choice between **guest checkout** (just an email
address, as before) and **sign in**, right there before the "Checkout with
Stripe" button. Customers create an account at `/account/register` — the
password lives on the same `Customer` row used for orders, so if they
register with the same email as a past guest order, that order history
becomes theirs automatically.

This is intentionally minimal for now: signing in mostly saves re-typing an
email address and is the foundation for a proper "my orders" / collection
page later (the account page has a placeholder for it — see "Extending this
later" below). It reuses the same sign-in machinery as staff login, just
with a separate customer-only credential type, so it can't be used to reach
`/admin`.

One thing worth knowing while testing: staff login and customer login share
one browser session, so signing into the storefront as a customer in the
same browser you're using for `/admin` will sign you out of the admin side
(and vice versa). Use a private/incognito window for one of them if you
want to be signed into both at once.

### Currency display

Visitors see prices converted to an estimated local currency, detected
automatically from their location, with a dropdown in the header to pick a
different one (or go back to "Auto"). This is **display only**: every price
shown this way is clearly still the store's own price underneath, and
**Stripe checkout always charges in the store's real currency** — nothing
about actual payment processing changes. The conversion uses live exchange
rates (refreshed every few hours, with a built-in fallback table if that
lookup is ever unreachable), so converted prices are a helpful estimate for
browsing, not a guarantee of the exact amount a customer's card will show
after their own bank's conversion.

Location detection reads Vercel's IP-geolocation header, so it only works
once deployed on Vercel — in local dev (or anywhere else) it simply falls
back to showing your own currency, which is the correct behaviour there.

## Live dashboard widgets

The dashboard's top row now updates on its own every 10 seconds, no page
refresh needed:

- **Visitors right now / last 24h / this week** — a count of distinct
  anonymous browsers that have had the storefront open recently. Every
  visitor gets a random id kept in their browser's local storage (no
  cookies, no personal data, nothing tied to an account) and a tiny beacon
  pings the server every ~45 seconds while they're on the site
  (`src/components/VisitorTracker.tsx`, `src/lib/analytics.ts`). Staff
  browsing `/admin` are excluded so the dashboard doesn't count itself.
- **Baskets with items** — visitors whose basket currently has something in
  it and who've been active in the last 2 minutes.
- **Checking out** — orders created in the last 20 minutes that haven't
  been paid yet (i.e. currently mid-way through Stripe, or abandoned there
  a few minutes ago — this can't tell the two apart).
- **Purchased — last 10 min** — a straightforward count of paid orders in
  that window, no approximation involved.

These are all deliberately rough, live-traffic gauges, not a substitute for
a proper analytics tool — there's no history kept beyond each visitor's
most recent activity, so nothing here answers "how many visitors did we
have last month," only "what's happening right now/today/this week." The
"Stock breakdown" chart that used to sit below these has been removed per
your request; `getStockBreakdown()` and `StockBreakdownBar` are still in
the codebase (`src/lib/reports.ts`, `src/components/admin/DashboardCharts.tsx`)
if you'd like that chart back somewhere, e.g. on the new stock report.

## Reports

**Admin → Reports** has four report types to start:

- **Sales by month** — orders, units, revenue, and shipping collected, one
  row per calendar month.
- **Sales by product** — units sold and revenue per print.
- **Sales by dispatch country** — orders, revenue, and shipping collected,
  grouped by the country each order shipped to (uses the shipping zones
  from Admin > Settings > Shipping).
- **Stock report** — a live snapshot of every print's edition breakdown
  (available/sold/reserved/withheld/damaged), no date range needed.

The sales reports all take a **From/To date range** (defaulting to the last
30 days), and every report has an **Export CSV** button that downloads
exactly what's on screen. **Save** a report with a name to add it to
"Saved reports" on the Reports home page — re-opening a saved report always
re-runs it against current data, it's a shortcut to the same
type+date-range, not a frozen snapshot.

Adding another report type later (e.g. by customer, by medium, by
collection) is a matter of adding one entry to the registry in
`src/lib/report-types.ts` — the list page, the run page, CSV export, and
saving all drive off that same list automatically.

## Orders — courier status

Each order's detail page now has a **Courier status** field — free text
(with suggestions for "Label created" / "Collected" / "In transit" /
"Delivered", but you can type anything a carrier actually says) that staff
can set directly, plus a timestamp of when it was last updated. It also
shows in a new column on the main Orders list.

Once an order has a tracking number, a **"Refresh from carrier"** button
appears next to the status field — it calls UPS's or Royal Mail's own
tracking API (whichever carrier that order shipped with) and fills the
status in automatically. This needs that carrier's credentials configured
(see the Integrations section above) and hasn't been tested against a real
shipment yet, so treat it as a head start rather than something guaranteed
to work first try — manual entry always works regardless.

## Manual orders — selling archive/unlisted prints

**Admin → Orders → "+ New manual order"** (Admin and Sales roles) lets you
sell a print that isn't published on the storefront at all — archive stock,
or a current print you're setting aside for one specific client — without
them ever visiting the site:

1. Enter the client's email and where it's shipping to.
2. Add one or more items. Any print can be picked, published or not. For a
   limited edition you choose the *exact* edition number yourself (only
   numbers currently AVAILABLE are offered); for an open edition, just a
   quantity.
3. Click **"Create order & send payment link"**. This immediately holds
   the edition number(s) you picked — unlike a storefront browsing hold,
   this one doesn't expire on its own; it's only released by the client
   paying or you cancelling the order — creates a Stripe payment link, and
   (if Resend is configured — see Integrations above) emails it to the
   client.

From there it behaves exactly like a storefront order: once they pay, the
same webhook marks it PAID and it appears in Orders and the packing queue
like any other sale. The order's own page shows the payment link (to copy
and send yourself if you'd rather not rely on the automatic email, or if it
didn't send), plus:

- **Generate new link** — Stripe payment links stop working after about 24
  hours; use this if a client says theirs doesn't work any more.
- **Resend email** — sends the current link again.
- **Cancel this order** — only while it's still awaiting payment; releases
  the held edition number(s) back to available and invalidates the link.

## Packing tab — choosing a carrier

The packing queue now shows, for each order, what Royal Mail and UPS would
cost before you pack it:

- **Royal Mail** shows the shipping amount the customer already paid (the
  zone rate from Admin > Settings > Shipping) — see the Royal Mail
  integration note above for why this isn't a separate live quote.
- **UPS** shows a genuine live quote from UPS's Rating API, once UPS
  credentials and your shipping address (`STORE_ADDRESS_*`) are both set —
  otherwise it explains which one's missing instead of a price.
- **Collection** is there for a customer picking the print up in person —
  no label, no cost.

Pick one and press **"Mark packed & create label"**: it creates a real
shipping label with whichever carrier you chose (if that carrier is
connected) and marks the order packed either way — a failed label doesn't
block packing, it just leaves a note so you can create the label manually
from the carrier's own site and add the tracking number afterwards.

## Extending this later

Some deliberate simplifications worth knowing about:

- **Shipping cost at checkout** is a flat rate per zone (Admin > Settings >
  Shipping — see below), not a real-time carrier quote. Real-time rate
  quotes via the UPS/Royal Mail APIs could replace this later.
- **Customer accounts** cover sign-in/registration and linking guest orders
  by email, but there's no "my orders"/collection page behind it yet — the
  account page just says so. That's the natural next step given the earlier
  request to let customers see their own collection.
- **Medium** is captured on each product but not yet shown on its storefront
  page — paper size and print size are now shown there (they replaced the
  old "Dimensions" field). Happy to add medium to the public page too if
  you'd like that.
- **Package weight/dimensions** for shipping labels are fixed placeholder
  values — add weight/dimensions fields to the `Print` model if items vary
  enough to matter for postage cost.
- **Secrets**: Stripe/UPS/Royal Mail/Mailchimp credentials are read from
  environment variables rather than stored in the database, so they never
  pass through this app's own storage. Only Xero's OAuth tokens are stored
  (in `IntegrationSetting`), because that's inherent to how OAuth works —
  consider encrypting that column at rest if you want extra assurance.
- **Live visitor/basket/checkout counts** (dashboard) come from a small
  anonymous beacon the storefront sends every ~45 seconds, not a full
  analytics platform — see "Live dashboard widgets" below for exactly what
  each number means and its limits.
- **Courier tracking status** is staff-entered by default, with a
  best-effort "Refresh from carrier" button that only works once UPS/Royal
  Mail tracking access is confirmed on your account — see "Orders — courier
  status" below.
- **Reports** only cover the report types already built (sales by month,
  by product, by dispatch country, and stock) — adding another is a matter
  of one new entry in `src/lib/report-types.ts`, not a rebuild, so just ask
  for whichever one you need next.
