import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/storefront/SiteHeader";
import { SiteFooter } from "@/components/storefront/SiteFooter";
import { getFooterProps } from "@/lib/footer";
import { AccountNav } from "@/components/account/AccountNav";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const session = await getServerSession(authOptions);
  const customerSession = session?.user && (session.user as any).role === "CUSTOMER" ? session.user : null;
  if (!customerSession) redirect("/account/login");

  const footer = await getFooterProps();
  const customer = await prisma.customer.findUnique({ where: { id: (customerSession as any).id } });
  if (!customer) redirect("/account/login");

  return (
    <>
      <SiteHeader />
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-3xl mb-8">Settings</h1>
        <AccountNav active="/account/settings" />
        <SettingsForm
          email={customer.email}
          initialFirstName={customer.firstName ?? ""}
          initialLastName={customer.lastName ?? ""}
          initialPhone={customer.phone ?? ""}
          initialMarketingOptIn={customer.marketingOptIn}
        />
      </section>
      <SiteFooter {...footer} />
    </>
  );
}
