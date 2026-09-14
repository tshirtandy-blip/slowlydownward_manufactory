"use client";

import { useMemo, useState } from "react";
import { updateShippingZones } from "./actions";
import { COUNTRIES } from "@/lib/countries";
import { SHIPPING_ZONE_KEYS, type ShippingZoneKey, type ShippingZoneRow } from "@/lib/shipping";
import { SaveButton } from "@/components/admin/SaveButton";

const inputClass = "border hairline bg-transparent px-3 py-2 text-sm w-full";

export function ShippingSettingsForm({ zones }: { zones: ShippingZoneRow[] }) {
  const byKey = useMemo(() => {
    const map = new Map<ShippingZoneKey, ShippingZoneRow>();
    for (const z of zones) map.set(z.key as ShippingZoneKey, z);
    return map;
  }, [zones]);

  const [labels, setLabels] = useState<Record<ShippingZoneKey, string>>({
    UK: byKey.get("UK")?.label ?? "United Kingdom",
    EUROPE: byKey.get("EUROPE")?.label ?? "Europe",
    ROW: byKey.get("ROW")?.label ?? "Rest of world",
  });
  const [prices, setPrices] = useState<Record<ShippingZoneKey, string>>({
    UK: (((byKey.get("UK")?.priceMinor ?? 0) / 100).toFixed(2)),
    EUROPE: (((byKey.get("EUROPE")?.priceMinor ?? 0) / 100).toFixed(2)),
    ROW: (((byKey.get("ROW")?.priceMinor ?? 0) / 100).toFixed(2)),
  });

  // Which zone (or "" for not-shipped) each country is currently assigned
  // to — one flat map keyed by country code, so a country can never end up
  // in two zones at once.
  const initialAssignments = useMemo(() => {
    const map: Record<string, ShippingZoneKey | ""> = {};
    for (const { code } of COUNTRIES) map[code] = "";
    for (const z of zones) {
      for (const code of z.countryCodes) map[code] = z.key as ShippingZoneKey;
    }
    return map;
  }, [zones]);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [filter, setFilter] = useState("");

  const counts = useMemo(() => {
    const c: Record<ShippingZoneKey, number> = { UK: 0, EUROPE: 0, ROW: 0 };
    for (const v of Object.values(assignments)) {
      if (v) c[v]++;
    }
    return c;
  }, [assignments]);

  // NOTE: every country row stays mounted (just hidden) when filtering —
  // if a filtered-out row were removed from the DOM entirely, its <select>
  // would vanish from the submitted form data too, silently wiping that
  // country's assignment on save.
  const filterQuery = filter.trim().toLowerCase();
  const visibleCount = filterQuery ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(filterQuery)).length : COUNTRIES.length;

  return (
    <form action={updateShippingZones} className="space-y-10">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {SHIPPING_ZONE_KEYS.map((key) => (
          <div key={key} className="border hairline p-4">
            <label className="label-caps block mb-2">Zone name</label>
            <input
              name={`label_${key}`}
              value={labels[key]}
              onChange={(e) => setLabels((l) => ({ ...l, [key]: e.target.value }))}
              className={inputClass + " mb-3"}
            />
            <label className="label-caps block mb-2">Price (£)</label>
            <input
              name={`price_${key}`}
              type="number"
              step="0.01"
              min={0}
              value={prices[key]}
              onChange={(e) => setPrices((p) => ({ ...p, [key]: e.target.value }))}
              className={inputClass}
            />
            <p className="text-xs text-stone mt-2">{counts[key]} countries assigned</p>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="label-caps">Countries</label>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search countries…"
            className="border hairline bg-transparent px-3 py-1.5 text-sm w-48 focus:outline-none focus:border-ink"
          />
        </div>
        <div className="border hairline max-h-[28rem] overflow-y-auto">
          {COUNTRIES.map((c) => (
            <div
              key={c.code}
              hidden={!!filterQuery && !c.name.toLowerCase().includes(filterQuery)}
              className="flex items-center justify-between gap-4 px-3 py-2 border-b hairline last:border-0"
            >
              <span className="text-sm">{c.name}</span>
              <select
                name={`country_${c.code}`}
                value={assignments[c.code] ?? ""}
                onChange={(e) =>
                  setAssignments((a) => ({ ...a, [c.code]: e.target.value as ShippingZoneKey | "" }))
                }
                className="border hairline bg-transparent px-2 py-1 text-sm w-44"
              >
                <option value="">Not shipped</option>
                <option value="UK">{labels.UK}</option>
                <option value="EUROPE">{labels.EUROPE}</option>
                <option value="ROW">{labels.ROW}</option>
              </select>
            </div>
          ))}
          {visibleCount === 0 && (
            <p className="px-3 py-6 text-sm text-stone text-center">No countries match "{filter}".</p>
          )}
        </div>
      </div>

      <SaveButton>Save shipping settings</SaveButton>
    </form>
  );
}
