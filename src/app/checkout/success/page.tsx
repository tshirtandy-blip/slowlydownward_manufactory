import { getFooterProps } from "@/lib/footer";
import { CheckoutSuccessClient } from "./CheckoutSuccessClient";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage() {
  const footer = await getFooterProps();
  return <CheckoutSuccessClient footer={footer} />;
}
