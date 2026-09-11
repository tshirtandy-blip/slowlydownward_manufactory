export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border hairline p-5">
      <p className="label-caps mb-2">{label}</p>
      <p className="text-3xl font-display">{value}</p>
      {hint && <p className="text-xs text-stone mt-1">{hint}</p>}
    </div>
  );
}
