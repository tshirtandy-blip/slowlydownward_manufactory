"use client";

import { useState } from "react";
import { updateSocialLinks, addSocialLink } from "./actions";
import { SaveButton } from "@/components/admin/SaveButton";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export type SocialLinkEditable = { id: string; platform: string; url: string };

export function SocialLinksManager({ links }: { links: SocialLinkEditable[] }) {
  const [rows, setRows] = useState(links);

  function updatePlatform(i: number, platform: string) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, platform } : r)));
  }
  function updateUrl(i: number, url: string) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, url } : r)));
  }
  function move(i: number, dir: -1 | 1) {
    setRows((rs) => {
      const j = i + dir;
      if (j < 0 || j >= rs.length) return rs;
      const copy = [...rs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }
  function remove(i: number) {
    setRows((rs) => rs.filter((_, j) => j !== i));
  }

  return (
    <div>
      <form action={updateSocialLinks} className="mb-6">
        <Card className="mb-4 border-line shadow-none">
          <CardContent className="p-0">
            {rows.map((row, i) => (
              <div key={row.id} className="flex items-center gap-3 border-b border-line px-3 py-2 last:border-0">
                <div className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="text-xs leading-none text-stone hover:text-ink disabled:opacity-30"
                    aria-label="Move up"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === rows.length - 1}
                    className="text-xs leading-none text-stone hover:text-ink disabled:opacity-30"
                    aria-label="Move down"
                  >
                    ▼
                  </button>
                </div>
                <Input
                  value={row.platform}
                  onChange={(e) => updatePlatform(i, e.target.value)}
                  placeholder="e.g. Instagram"
                  className="w-40 shrink-0 border-line"
                />
                <Input
                  value={row.url}
                  onChange={(e) => updateUrl(i, e.target.value)}
                  placeholder="https://instagram.com/yourhandle"
                  className="flex-1 border-line"
                />
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="shrink-0 whitespace-nowrap text-xs text-stone underline hover:text-accent"
                >
                  Remove
                </button>
              </div>
            ))}
            {rows.length === 0 && <p className="px-3 py-6 text-center text-sm text-stone">No social links yet.</p>}
          </CardContent>
        </Card>

        <input
          type="hidden"
          name="socialLinks"
          value={JSON.stringify(rows.map((r) => ({ id: r.id, platform: r.platform, url: r.url })))}
        />
        <SaveButton>Save social links</SaveButton>
      </form>

      <details className="group">
        <summary className="label-caps w-fit cursor-pointer">+ Add a social link</summary>
        <Card className="mt-4 border-line shadow-none">
          <CardContent className="p-4">
            <form action={addSocialLink} className="flex max-w-lg items-end gap-3">
              <div className="w-40 shrink-0">
                <Label htmlFor="socialNewPlatform" className="label-caps mb-2 block">
                  Platform
                </Label>
                <Input id="socialNewPlatform" name="platform" required placeholder="e.g. Instagram" className="border-line" />
              </div>
              <div className="flex-1">
                <Label htmlFor="socialNewUrl" className="label-caps mb-2 block">
                  URL
                </Label>
                <Input
                  id="socialNewUrl"
                  name="url"
                  type="url"
                  required
                  placeholder="https://instagram.com/yourhandle"
                  className="border-line"
                />
              </div>
              <Button type="submit" variant="secondary">
                Add
              </Button>
            </form>
          </CardContent>
        </Card>
      </details>
    </div>
  );
}
