import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/storefront/SiteHeader";
import { SiteFooter } from "@/components/storefront/SiteFooter";
import { getFooterProps } from "@/lib/footer";
import { AccountNav } from "@/components/account/AccountNav";
import { AddressBook } from "./AddressBook";

export const dynamic = "force-dynamic";

export default async function AddressesPage() {
  const session = await getServerSession(authOptions);
  const customer = session?.user && (session.user as any).role === "CUSTOMER" ? session.user : null;
  if (!customer) redirect("/account/login");

  const footer = await getFooterProps();
  const addresses = await prisma.address.findMany({
    where: { customerId: (customer as any).id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  return (
    <>
      <SiteHeader />
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-3xl mb-8">Addresses</h1>
        <AccountNav active="/account/addresses" />
        <AddressBook
          initialAddresses={addresses.map((a) => ({
            id: a.id,
            label: a.label ?? "",
            fullName: a.fullName,
            line1: a.line1,
            line2: a.line2 ?? "",
            city: a.city,
            region: a.region ?? "",
            postalCode: a.postalCode,
            countryCode: a.countryCode,
            phone: a.phone ?? "",
            isDefault: a.isDefault,
          }))}
        />
      </section>
      <SiteFooter {...footer} />
    </>
  );
}
