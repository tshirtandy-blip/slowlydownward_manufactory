import { Card, CardContent } from "@/components/ui/card";

export function StatTile({
  label,
  value,
  hint,
  live,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Shows a small pulsing "LIVE" indicator next to the label — reserve
   * this for a stat that's genuinely updating in near real time (e.g.
   * visitors currently on the site), not just any number that happens to
   * refresh on a timer. */
  live?: boolean;
}) {
  return (
    <Card className={live ? "border-line shadow-none ring-1 ring-emerald-600/20" : "border-line shadow-none"}>
      <CardContent className="p-5">
        <div className="mb-2 flex items-center gap-2">
          <p className="label-caps">{label}</p>
          {live && (
            <span className="flex items-center gap-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[10px] font-medium tracking-widest text-emerald-600">LIVE</span>
            </span>
          )}
        </div>
        <p className="text-3xl font-display">{value}</p>
        {hint && <p className="mt-1 text-xs text-stone">{hint}</p>}
      </CardContent>
    </Card>
  );
}
