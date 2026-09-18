"use client";

import { useState } from "react";
import { updateRoyalMailRates } from "./actions";
import { COUNTRIES } from "@/lib/countries";
import type { RoyalMailRateRow } from "@/lib/royal-mail-rates";
import { SaveButton } from "@/components/admin/SaveButton";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

const cellInputClass = "border border-input bg-background px-2 py-1.5 text-sm w-full";

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
      <Card className="mb-4 border-line shadow-none">
        <CardContent className="overflow-x-auto p-0">
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow className="border-line">
                <TableHead className="label-caps text-xs">Destination</TableHead>
                <TableHead className="label-caps text-xs">Service</TableHead>
                <TableHead className="label-caps text-xs">Up to weight (g)</TableHead>
                <TableHead className="label-caps text-xs">Max L (cm)</TableHead>
                <TableHead className="label-caps text-xs">Max W (cm)</TableHead>
                <TableHead className="label-caps text-xs">Max H (cm)</TableHead>
                <TableHead className="label-caps text-xs">Price (£)</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i} className="border-line">
                  <TableCell className="p-2">
                    <select
                      value={row.countryCode}
                      onChange={(e) => updateRow(i, { countryCode: e.target.value })}
                      className={cellInputClass}
                    >
                      <option value="">Any (catch-all)</option>
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell className="p-2">
                    <input
                      value={row.service}
                      onChange={(e) => updateRow(i, { service: e.target.value })}
                      placeholder="e.g. Tracked 48"
                      className={cellInputClass}
                    />
                  </TableCell>
                  <TableCell className="p-2">
                    <input
                      type="number"
                      min={0}
                      value={row.maxWeightGrams}
                      onChange={(e) => updateRow(i, { maxWeightGrams: e.target.value })}
                      placeholder="1000"
                      className={cellInputClass}
                    />
                  </TableCell>
                  <TableCell className="p-2">
                    <input type="number" min={0} value={row.maxLengthCm} onChange={(e) => updateRow(i, { maxLengthCm: e.target.value })} className={cellInputClass} />
                  </TableCell>
                  <TableCell className="p-2">
                    <input type="number" min={0} value={row.maxWidthCm} onChange={(e) => updateRow(i, { maxWidthCm: e.target.value })} className={cellInputClass} />
                  </TableCell>
                  <TableCell className="p-2">
                    <input type="number" min={0} value={row.maxHeightCm} onChange={(e) => updateRow(i, { maxHeightCm: e.target.value })} className={cellInputClass} />
                  </TableCell>
                  <TableCell className="p-2">
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={row.price}
                      onChange={(e) => updateRow(i, { price: e.target.value })}
                      placeholder="0.00"
                      className={cellInputClass}
                    />
                  </TableCell>
                  <TableCell className="p-2">
                    <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="whitespace-nowrap text-xs text-stone underline hover:text-accent">
                      Remove
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {rows.length === 0 && <p className="px-3 py-6 text-center text-sm text-stone">No price bands yet.</p>}
        </CardContent>
      </Card>

      <p className="mb-4 text-xs text-stone">
        Leave a max dimension blank to not check it at all. "Any (catch-all)" rows are only used when no row
        matches the order's destination country exactly — handy for a general "rest of world" rate.
      </p>

      <div className="mb-6 flex items-center gap-3">
        <Button type="button" variant="secondary" onClick={() => setRows((rs) => [...rs, { ...emptyRow }])}>
          + Add row
        </Button>
      </div>

      <input type="hidden" name="rates" value={JSON.stringify(rows)} />

      <div>
        <SaveButton>Save Royal Mail price list</SaveButton>
      </div>
    </form>
  );
}
