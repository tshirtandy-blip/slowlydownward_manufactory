import Link from "next/link";
import { getShippingZones } from "@/lib/shipping";
import { getRoyalMailRates } from "@/lib/royal-mail-rates";
import { ShippingSettingsForm } from "./ShippingSettingsForm";
import { RoyalMailRatesForm } from "./RoyalMailRatesForm";
import { RoyalMailRatesCsvImport } from "./RoyalMailRatesCsvImport";

export const dynamic = "force-dynamic";

export default async function ShippingSettingsPage() {
  const [zones, royalMailRates] = await Promise.all([getShippingZones(), getRoyalMailRates()]);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/settings" className="label-caps text-stone hover:text-ink">
        ← Settings
      </Link>
      <h1 className="font-display text-2xl mt-2 mb-2">Shipping</h1>
      <p className="text-sm text-stone mb-8 max-w-xl">
        Three shipping zones — set each one's price and which countries it covers. A country left as "Not
        shipped" won't be offered at checkout at all. Every price is charged in GBP.
      </p>

      <ShippingSettingsForm zones={zones} />

      <div className="border-t border-line mt-12 pt-8">
        <h2 className="font-display text-xl mb-2">Royal Mail price list</h2>
        <p className="text-sm text-stone mb-6 max-w-xl">
          Royal Mail doesn't offer a live rate quote the way UPS does — your cost is fixed by your contract to a
          published price per destination, package size, and weight band. Set that price list up here — row by
          row, or all at once from a spreadsheet below — and the packing tab will show the right cost for each
          order based on its real destination country, weight, and dimensions.
        </p>
        <RoyalMailRatesCsvImport />
        <RoyalMailRatesForm rates={royalMailRates} />
      </div>
    </div>
  );
}
