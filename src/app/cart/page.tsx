import { getShippingZones } from "@/lib/shipping";
import { getFooterProps } from "@/lib/footer";
import { CartPageClient } from "./CartPageClient";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const [zones, footer] = await Promise.all([getShippingZones(), getFooterProps()]);
  return <CartPageClient zones={zones} footer={footer} />;
}
