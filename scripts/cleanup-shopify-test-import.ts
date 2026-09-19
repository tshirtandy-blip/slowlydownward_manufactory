/**
 * One-off helper: deletes any orders previously imported by
 * scripts/import-shopify-orders.ts (identified by their "SHOP-" order
 * number prefix), so a corrected re-run of that script can recreate them
 * cleanly instead of being skipped by its dedupe check.
 *
 * Why you'd need this: the import script dedupes by orderNumber — if an
 * order with that orderNumber already exists, it's skipped entirely
 * (including the customer name fallback fix). So after fixing a bug in
 * the writer script, the only way to get already-imported test orders to
 * pick up the fix is to delete them first and re-import.
 *
 * This does NOT touch Customer records — any customer created by the test
 * import is left in place (harmless even if its name is still blank; the
 * next import run will fill it in via the update path, since
 * existingCustomer.firstName is null).
 *
 * Run it by hand, against your real database:
 *
 *   DATABASE_URL="..." DIRECT_URL="..." npm run cleanup:shopify-test-import
 *
 * Add --dry-run to see what would be deleted without deleting anything.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const orders = await prisma.order.findMany({
    where: { orderNumber: { startsWith: "SHOP-" } },
    select: { id: true, orderNumber: true },
  });

  if (orders.length === 0) {
    console.log("No SHOP- prefixed orders found — nothing to clean up.");
    return;
  }

  console.log(`Found ${orders.length} imported order(s): ${orders.map((o) => o.orderNumber).join(", ")}`);

  if (dryRun) {
    console.log("\nDry run — nothing deleted.");
    return;
  }

  const orderIds = orders.map((o) => o.id);
  await prisma.$transaction(async (tx) => {
    const { count: itemsDeleted } = await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    const { count: ordersDeleted } = await tx.order.deleteMany({ where: { id: { in: orderIds } } });
    console.log(`\nDeleted ${ordersDeleted} order(s) and ${itemsDeleted} order item(s).`);
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
