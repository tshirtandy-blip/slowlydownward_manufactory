import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  // Don't throw at import time in build environments without the key set yet;
  // routes that use this will fail loudly and clearly if the key is missing.
  console.warn("STRIPE_SECRET_KEY is not set — checkout will not work until it is.");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  apiVersion: "2024-06-20",
});
