import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { generateOrderNumber } from "@/lib/money";

const bodySchema = z.object({
  email: z.string().email(),
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

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { email, items } = parsed.data;

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
    if (print.editions.length < item.quantity) {
      return NextResponse.json(
        { error: `Only ${print.editions.length} left of "${print.title}".` },
        { status: 400 }
      );
    }
  }

  const customer = await prisma.customer.upsert({
    where: { email: email.toLowerCase().trim() },
    update: {},
    create: { email: email.toLowerCase().trim() },
  });

  // Expand quantity>1 into one OrderItem per physical copy — each gets its
  // own edition allocated at fulfillment time.
  const orderItemsData = items.flatMap((item) => {
    const print = printMap.get(item.printId)!;
    return Array.from({ length: item.quantity }).map(() => ({
      printId: print.id,
      unitPriceMinor: print.priceMinor,
      // Only honour a requested number for single-quantity purchases —
      // ambiguous otherwise.
      requestedEditionNumber: item.quantity === 1 ? item.requestedEditionNumber ?? null : null,
    }));
  });

  const subtotalMinor = orderItemsData.reduce((sum, i) => sum + i.unitPriceMinor, 0);

  const order = await prisma.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      customerId: customer.id,
      status: "PENDING_PAYMENT",
      subtotalMinor,
      totalMinor: subtotalMinor, // shipping added by Stripe's shipping_options, reconciled on webhook
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

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    line_items,
    shipping_address_collection: {
      allowed_countries: ["GB", "US", "CA", "AU", "IE", "DE", "FR", "NL", "JP"],
    },
    shipping_options: [
      { shipping_rate_data: { type: "fixed_amount", fixed_amount: { amount: 0, currency: "gbp" }, display_name: "UK — Royal Mail Tracked", delivery_estimate: { minimum: { unit: "business_day", value: 2 }, maximum: { unit: "business_day", value: 4 } } } },
      { shipping_rate_data: { type: "fixed_amount", fixed_amount: { amount: 1500, currency: "gbp" }, display_name: "International — Tracked", delivery_estimate: { minimum: { unit: "business_day", value: 5 }, maximum: { unit: "business_day", value: 12 } } } },
    ],
    metadata: { orderId: order.id },
    success_url: `${process.env.STORE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.STORE_URL}/checkout/cancel`,
  });

  await prisma.order.update({ where: { id: order.id }, data: { stripeSessionId: session.id } });

  return NextResponse.json({ url: session.url });
}
