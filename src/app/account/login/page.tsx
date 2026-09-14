import { getFooterProps } from "@/lib/footer";
import { LoginClient } from "./LoginClient";

export const dynamic = "force-dynamic";

export default async function CustomerLoginPage() {
  const footer = await getFooterProps();
  return <LoginClient footer={footer} />;
}
