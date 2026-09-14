"use client";

import { useState } from "react";
import { updateRoyalMailRates } from "./actions";
import { COUNTRIES } from "@/lib/countries";
import type { RoyalMailRateRow } from "@/lib/royal-mail-rates";
import { SaveButton } from "@/components/admin/SaveButton";

const inputClass = "border hairline bg-transparent px-2 py-1.5 text-sm w-full";

type Row = {
  countryCode: string; // "" means "Any (catch-all)"
  service: string;
  maxWeightGrams: string;
  maxLengthCm: string;
  maxWidthCm: string;
  maxHeightCm: string;
  price: string;
};

const emptyRow: Row = { countryCode: "", service: "", maxWeightGrams: "", maxLengthCm: "", maxWidthCm: "", maxHeightCm: "", price: "" };

export function RoyalMailRatesForm({ rates }: { rates: RoyalMailRateRow[] }) {
  const [rows, setRows] = useState<Row[]>(
    rates.length > 0
      ? rates.map((r) => ({
          countryCode: r.countryCode ?? "",
          service: r.service,
          maxWeightGrams: String(r.maxWeightGrams),
          maxLengthCm: r.maxLengthCm != null ? String(r.maxLengthCm) : "",
          maxWidthCm: r.maxWidthCm != null ? String(r.maxWidthCm) : "",
          maxHeightCm: r.maxHeightCm != null ? String(r.maxHeightCm) : "",
          price: (r.priceMinor / 100).toFixed(2),
        }))
      : [emptyRow]
  );

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  return (
    <form action={updateRoyalMailRates}>
      <div className="border hairline mb-4 overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead>
            <tr className="label-caps text-left border-b hairline text-xs">
              <th className="p-2">Destination</th>
              <th className="p-2">Service</th>
              <th className="p-2">Up to weight (g)</th>
              <th className="p-2">Max L (cm)</th>
              <th className="p-2">Max W (cm)</th>
              <th className="p-2">Max H (cm)</th>
              <th className="p-2">Price (£)</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b hairline last:border-0">
                <td className="p-2">
                  <select
                    value={row.countryCode}
                    onChange={(e) => updateRow(i, { countryCode: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">Any (catch-all)</option>
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  <input
                    value={row.service}
                    onChange={(e) => updateRow(i, { service: e.target.value })}
                    placeholder="e.g. Tracked 48"
                    className={inputClass}
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    min={0}
                    value={row.maxWeightGrams}
                    onChange={(e) => updateRow(i, { maxWeightGrams: e.target.value })}
                    placeholder="1000"
                    className={inputClass}
                  />
                </td>
                <td className="p-2">
                  <input type="number" min={0} value={row.maxLengthCm} onChange={(e) => updateRow(i, { maxLengthCm: e.target.value })} className={inputClass} />
                </td>
                <td className="p-2">
                  <input type="number" min={0} value={row.maxWidthCm} onChange={(e) => updateRow(i, { maxWidthCm: e.target.value })} className={inputClass} />
                </td>
                <td className="p-2">
                  <input type="number" min={0} value={row.maxHeightCm} onChange={(e) => updateRow(i, { maxHeightCm: e.target.value })} className={inputClass} />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={row.price}
                    onChange={(e) => updateRow(i, { price: e.target.value })}
                    placeholder="0.00"
                    className={inputClass}
                  />
                </td>
                <td className="p-2">
                  <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="text-xs text-stone hover:text-accent underline whitespace-nowrap">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-3 py-6 text-sm text-stone text-center">No price bands yet.</p>}
      </div>

      <p className="text-xs text-stone mb-4">
        Leave a max dimension blank to not check it at all. "Any (catch-all)" rows are only used when no row
        matches the order's destination country exactly — handy for a general "rest of world" rate.
      </p>

      <div className="flex items-center gap-3 mb-6">
        <button type="button" onClick={() => setRows((rs) => [...rs, { ...emptyRow }])} className="btn-secondary !px-4 !py-2">
          + Add row
        </button>
      </div>

      <input type="hidden" name="rates" value={JSON.stringify(rows)} />

      <div>
        <SaveButton>Save Royal Mail price list</SaveButton>
      </div>
    </form>
  );
}
