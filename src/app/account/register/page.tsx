import { getFooterProps } from "@/lib/footer";
import { RegisterClient } from "./RegisterClient";

export const dynamic = "force-dynamic";

export default async function CustomerRegisterPage() {
  const footer = await getFooterProps();
  return <RegisterClient footer={footer} />;
}
