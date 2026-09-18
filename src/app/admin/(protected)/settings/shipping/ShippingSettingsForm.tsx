"use client";

import { useMemo, useState } from "react";
import { updateShippingZones } from "./actions";
import { COUNTRIES } from "@/lib/countries";
import { SHIPPING_ZONE_KEYS, type ShippingZoneKey, type ShippingZoneRow } from "@/lib/shipping";
import { SaveButton } from "@/components/admin/SaveButton";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

const selectClass =
  "border border-input bg-background px-2 py-1 text-sm w-44 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {SHIPPING_ZONE_KEYS.map((key) => (
          <Card key={key} className="border-line shadow-none">
            <CardContent className="p-4">
              <Label htmlFor={`label_${key}`} className="label-caps mb-2 block">
                Zone name
              </Label>
              <Input
                id={`label_${key}`}
                name={`label_${key}`}
                value={labels[key]}
                onChange={(e) => setLabels((l) => ({ ...l, [key]: e.target.value }))}
                className="mb-3 border-line"
              />
              <Label htmlFor={`price_${key}`} className="label-caps mb-2 block">
                Price (£)
              </Label>
              <Input
                id={`price_${key}`}
                name={`price_${key}`}
                type="number"
                step="0.01"
                min={0}
                value={prices[key]}
                onChange={(e) => setPrices((p) => ({ ...p, [key]: e.target.value }))}
                className="border-line"
              />
              <p className="mt-2 text-xs text-stone">{counts[key]} countries assigned</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <Label className="label-caps">Countries</Label>
          <Input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search countries…"
            className="w-48 border-line"
          />
        </div>
        <Card className="border-line shadow-none">
          <CardContent className="p-0">
            <ScrollArea className="h-[28rem]">
              {COUNTRIES.map((c) => (
                <div
                  key={c.code}
                  hidden={!!filterQuery && !c.name.toLowerCase().includes(filterQuery)}
                  className="flex items-center justify-between gap-4 border-b border-line px-3 py-2 last:border-0"
                >
                  <span className="text-sm">{c.name}</span>
                  <select
                    name={`country_${c.code}`}
                    value={assignments[c.code] ?? ""}
                    onChange={(e) =>
                      setAssignments((a) => ({ ...a, [c.code]: e.target.value as ShippingZoneKey | "" }))
                    }
                    className={selectClass}
                  >
                    <option value="">Not shipped</option>
                    <option value="UK">{labels.UK}</option>
                    <option value="EUROPE">{labels.EUROPE}</option>
                    <option value="ROW">{labels.ROW}</option>
                  </select>
                </div>
              ))}
              {visibleCount === 0 && (
                <p className="px-3 py-6 text-center text-sm text-stone">No countries match "{filter}".</p>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <SaveButton>Save shipping settings</SaveButton>
    </form>
  );
}
