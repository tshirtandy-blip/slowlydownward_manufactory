import { Card, CardContent } from "@/components/ui/card";

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="border-line shadow-none">
      <CardContent className="p-5">
        <p className="label-caps mb-2">{label}</p>
        <p className="text-3xl font-display">{value}</p>
        {hint && <p className="text-xs text-stone mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}
