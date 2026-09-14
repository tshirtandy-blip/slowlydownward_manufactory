import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { generateOrderNumber } from "@/lib/money";
import { getShippingZones, zoneForCountry } from "@/lib/shipping";
import { releaseExpiredReservations } from "@/lib/edition-reservations";

const bodySchema = z.object({
  // Omitted when checking out signed in — the customer's session email is
  // used instead (see below). Required for a guest.
  email: z.string().email().optional(),
  country: z.string().length(2),
  // Identifies which browser's reservation hold(s) to honour — see
  // src/lib/edition-reservations.ts. Optional so an old cached page without
  // it still checks out, just without any specific number being honoured.
  token: z.string().optional(),
  items: z
    .array(
      z.object({
        printId: z.string(),
        quantity: z.number().int().min(1).max(20),
        requestedEditionNumber: z.number().int().nullable().optional(),
      })
    )
    .min(1),
});

// How long a requested edition number is locked down once checkout actually
// starts (a Stripe session is about to be created) — deliberately longer
// and independent of the site's general "browsing" hold length (Admin >
// Settings > Editions, a few minutes by default), since filling in card
// details and clearing any bank verification step can run past that.
const CHECKOUT_HOLD_MINUTES = 30;

export async function POST(req: Request) {
  // Everything below is wrapped in one try/catch so that whatever goes
  // wrong — bad JSON, a database hiccup, a Stripe error, a missing env
  // var — this route ALWAYS responds with a JSON body. Previously an
  // uncaught error here (e.g. from a misconfigured Stripe key) made Next.js
  // send back an empty response, which broke the cart page with a raw
  // "Unexpected end of JSON input" browser error instead of a real message.
  try {
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === "sk_test_placeholder") {
      return NextResponse.json(
        { error: "Stripe isn't set up yet — add a real STRIPE_SECRET_KEY to your .env file, then restart the server." },
        { status: 500 }
      );
    }
    if (!process.env.STORE_URL) {
      return NextResponse.json(
        { error: "STORE_URL is missing from your .env file — checkout can't build its return link without it." },
        { status: 500 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const { email, items, country, token } = parsed.data;
    const holderToken = token ?? "";

    // A signed-in customer checks out under their own account rather than
    // whatever (or nothing) is typed in the guest email field — this is
    // what makes "sign in" on the cart page actually mean something.
    const session = await getServerSession(authOptions);
    const sessionCustomerId =
      session?.user && (session.user as any).role === "CUSTOMER" ? (session.user as any).id : null;

    let customer;
    if (sessionCustomerId) {
      customer = await prisma.customer.findUnique({ where: { id: sessionCustomerId } });
      if (!customer) {
        return NextResponse.json({ error: "Your session has expired — please sign in again." }, { status: 401 });
      }
    } else {
      if (!email) {
        return NextResponse.json({ error: "Please enter your email address, or sign in." }, { status: 400 });
      }
      customer = await prisma.customer.upsert({
        where: { email: email.toLowerCase().trim() },
        update: {},
        create: { email: email.toLowerCase().trim() },
      });
    }

    const zones = await getShippingZones();
    const zone = zoneForCountry(zones, country);
    if (!zone) {
      return NextResponse.json({ error: "Sorry, we don't currently ship to that country." }, { status: 400 });
    }

    // A hold that's simply timed out shouldn't count as "unavailable" here,
    // nor should it still look "reserved" for the specific-number check
    // below — see src/lib/edition-reservations.ts.
    for (const printId of new Set(items.map((i) => i.printId))) {
      await releaseExpiredReservations(prisma, printId);
    }

    // Re-fetch prices & availability server-side — never trust the client's cart.
    const prints = await prisma.print.findMany({
      where: { id: { in: items.map((i) => i.printId) }, published: true },
      include: { editions: { where: { status: "AVAILABLE" }, select: { id: true } } },
    });

    const printMap = new Map(prints.map((p) => [p.id, p]));
    for (const item of items) {
      const print = printMap.get(item.printId);
      if (!print) {
        return NextResponse.json({ error: "One of the prints in your cart is no longer available." }, { status: 400 });
      }
      // Open editions (editionSize === null) aren't limited or numbered, so
      // there's no fixed pool of copies to run out of — skip the availability
      // check entirely for them. Likewise skip it for a specific-number
      // line: `print.editions` only counts plain AVAILABLE rows, but a
      // customer's own still-active hold on their chosen number sits as
      // RESERVED instead — so on a print with few copies left, this bulk
      // count could read as "none left" even though their exact number is
      // legitimately still theirs. That number gets its own precise check
      // (honouring an active hold, or falling back if it's really gone)
      // further down instead.
      if (
        print.editionSize !== null &&
        item.requestedEditionNumber == null &&
        print.editions.length < item.quantity
      ) {
        return NextResponse.json(
          { error: `Only ${print.editions.length} left of "${print.title}".` },
          { status: 400 }
        );
      }
    }

    // Expand quantity>1 into one OrderItem per physical copy — each gets its
    // own edition allocated at fulfillment time.
    const orderItemsData: {
      printId: string;
      unitPriceMinor: number;
      requestedEditionNumber: number | null;
      reservationToken: string | null;
    }[] = [];
    for (const item of items) {
      const print = printMap.get(item.printId)!;
      for (let i = 0; i < item.quantity; i++) {
        // Only honour a requested number for single-quantity purchases —
        // ambiguous otherwise — and never for an open edition, which has no
        // numbers to request in the first place.
        let requestedEditionNumber: number | null =
          print.editionSize !== null && item.quantity === 1 ? item.requestedEditionNumber ?? null : null;
        let reservationToken: string | null = null;

        if (requestedEditionNumber) {
          const edition = await prisma.edition.findUnique({
            where: { printId_number: { printId: print.id, number: requestedEditionNumber } },
          });
          const ownActiveHold =
            !!edition &&
            edition.status === "RESERVED" &&
            edition.reservationToken === holderToken &&
            !!edition.reservedUntil &&
            edition.reservedUntil > new Date();

          if (edition && (edition.status === "AVAILABLE" || ownActiveHold)) {
            // Lock this number down for the whole remaining checkout — not
            // just whatever's left of the original browsing hold (as short
            // as a few minutes), which can easily run out while someone's
            // still entering card details or clearing 3D Secure on Stripe's
            // page. This is a single atomic claim (only succeeds if the row
            // is still actually free, or already this exact hold), so it's
            // still safe if something else grabs it in the instant between
            // the read above and this write.
            const claim = await prisma.edition.updateMany({
              where: {
                id: edition.id,
                OR: [{ status: "AVAILABLE" }, { status: "RESERVED", reservationToken: holderToken }],
              },
              data: {
                status: "RESERVED",
                reservedAt: new Date(),
                reservedUntil: new Date(Date.now() + CHECKOUT_HOLD_MINUTES * 60_000),
                reservationToken: holderToken,
              },
            });
            if (claim.count > 0) {
              // Carried through to payment time so allocateEdition only ever
              // honours THIS order's own hold on the number, never someone
              // else's later, still-active one for the same number.
              reservationToken = holderToken;
            } else {
              // Genuinely lost the race in that instant — don't promise
              // something checkout can no longer guarantee. allocateEdition
              // falls back to the next available number at payment time
              // instead, same as always when a requested number is taken.
              requestedEditionNumber = null;
            }
          } else {
            // Held by someone else's still-active hold — not available to promise.
            requestedEditionNumber = null;
          }
        }

        orderItemsData.push({ printId: print.id, unitPriceMinor: print.priceMinor, requestedEditionNumber, reservationToken });
      }
    }

    const subtotalMinor = orderItemsData.reduce((sum, i) => sum + i.unitPriceMinor, 0);

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        customerId: customer.id,
        status: "PENDING_PAYMENT",
        subtotalMinor,
        shippingMinor: zone.priceMinor,
        totalMinor: subtotalMinor + zone.priceMinor, // corrected from Stripe's own totals by the webhook once paid
        items: { create: orderItemsData },
      },
      include: { items: { include: { print: true } } },
    });

    const line_items = order.items.map((item) => ({
      quantity: 1,
      price_data: {
        currency: item.print.currency.toLowerCase(),
        unit_amount: item.unitPriceMinor,
        product_data: {
          name: item.print.title,
          description: item.requestedEditionNumber ? `Requested edition #${item.requestedEditionNumber}` : undefined,
          images: item.print.primaryImageUrl ? [item.print.primaryImageUrl] : undefined,
        },
      },
    }));

    let stripeSession;
    try {
      stripeSession = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: customer.email,
        line_items,
        // The customer already told us which country they're shipping to
        // (they had to, to see a shipping price) — lock Stripe's own
        // address form to just that country, so what they pay for here can
        // never end up mismatched with where the address form lets them
        // actually enter an address.
        shipping_address_collection: {
          allowed_countries: [country],
        },
        shipping_options: [
          {
            shipping_rate_data: {
              type: "fixed_amount",
              fixed_amount: { amount: zone.priceMinor, currency: "gbp" },
              display_name: zone.label,
            },
          },
        ],
        metadata: { orderId: order.id },
        success_url: `${process.env.STORE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.STORE_URL}/checkout/cancel`,
        // Newer Stripe accounts have "Managed Payments" on by default, which
        // takes over shipping address collection itself and rejects the
        // classic shipping_address_collection/shipping_options params used
        // above. Turning it off for this session keeps our own zone-based
        // rates working. Cast to `any`: this param is newer than the pinned
        // `stripe` package's bundled TS types.
        managed_payments: { enabled: false },
      } as any);
    } catch (stripeErr: any) {
      // The order row is already created as PENDING_PAYMENT — leaving it
      // there is fine (it's just never paid), but the customer needs to see
      // why checkout didn't start.
      console.error("Stripe checkout session creation failed:", stripeErr);
      return NextResponse.json(
        { error: stripeErr?.message || "Stripe couldn't start checkout. Please try again." },
        { status: 502 }
      );
    }

    await prisma.order.update({ where: { id: order.id }, data: { stripeSessionId: stripeSession.id } });

    return NextResponse.json({ url: stripeSession.url });
  } catch (err: any) {
    console.error("Checkout failed:", err);
    return NextResponse.json({ error: "Something went wrong starting checkout. Please try again." }, { status: 500 });
  }
}
