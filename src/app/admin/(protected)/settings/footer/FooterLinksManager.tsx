"use client";

import { useState } from "react";
import Link from "next/link";
import { updateFooterLinks, addFooterLink } from "./actions";
import { SaveButton } from "@/components/admin/SaveButton";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export type FooterLinkEditable = { id: string; label: string; pageId: string; pageTitle: string; pageSlug: string };

export function FooterLinksManager({ links }: { links: FooterLinkEditable[] }) {
  const [rows, setRows] = useState(links);

  function updateLabel(i: number, label: string) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, label } : r)));
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
      <form action={updateFooterLinks} className="mb-6">
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
                <Input value={row.label} onChange={(e) => updateLabel(i, e.target.value)} className="flex-1 border-line" />
                <Link
                  href={`/admin/pages/${row.pageId}`}
                  className="shrink-0 whitespace-nowrap text-xs text-stone underline hover:text-ink"
                >
                  Edit content ({row.pageTitle})
                </Link>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="shrink-0 whitespace-nowrap text-xs text-stone underline hover:text-accent"
                >
                  Remove
                </button>
              </div>
            ))}
            {rows.length === 0 && <p className="px-3 py-6 text-center text-sm text-stone">No links in the footer yet.</p>}
          </CardContent>
        </Card>

        <input type="hidden" name="links" value={JSON.stringify(rows.map((r) => ({ id: r.id, label: r.label })))} />
        <SaveButton>Save links</SaveButton>
        <p className="mt-2 text-xs text-stone">
          "Remove" only unlinks a page from the footer — the page itself and its content stay put, and you can
          add it back later.
        </p>
      </form>

      <details className="group">
        <summary className="label-caps w-fit cursor-pointer">+ Add a new page to the footer</summary>
        <Card className="mt-4 border-line shadow-none">
          <CardContent className="p-4">
            <form action={addFooterLink} className="flex max-w-md items-end gap-3">
              <div className="flex-1">
                <Label htmlFor="footerNewPageTitle" className="label-caps mb-2 block">
                  Page title
                </Label>
                <Input id="footerNewPageTitle" name="title" required placeholder="e.g. FAQ" className="border-line" />
              </div>
              <Button type="submit" variant="secondary">
                Create &amp; add
              </Button>
            </form>
            <p className="mt-2 text-xs text-stone">
              Creates a new (published, empty) page, adds it to the end of the footer, and takes you straight to
              its content editor.
            </p>
          </CardContent>
        </Card>
      </details>
    </div>
  );
}
