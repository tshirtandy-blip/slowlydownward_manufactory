"use client";

import { useState } from "react";
import Link from "next/link";
import { updateFooterLinks, addFooterLink } from "./actions";
import { SaveButton } from "@/components/admin/SaveButton";

const inputClass = "border hairline bg-transparent px-3 py-2 text-sm w-full";

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
        <div className="border hairline mb-4">
          {rows.map((row, i) => (
            <div key={row.id} className="flex items-center gap-3 px-3 py-2 border-b hairline last:border-0">
              <div className="flex flex-col shrink-0">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="text-xs text-stone hover:text-ink disabled:opacity-30 leading-none"
                  aria-label="Move up"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === rows.length - 1}
                  className="text-xs text-stone hover:text-ink disabled:opacity-30 leading-none"
                  aria-label="Move down"
                >
                  ▼
                </button>
              </div>
              <input value={row.label} onChange={(e) => updateLabel(i, e.target.value)} className={inputClass + " flex-1"} />
              <Link
                href={`/admin/pages/${row.pageId}`}
                className="text-xs text-stone hover:text-ink underline whitespace-nowrap shrink-0"
              >
                Edit content ({row.pageTitle})
              </Link>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-xs text-stone hover:text-accent underline whitespace-nowrap shrink-0"
              >
                Remove
              </button>
            </div>
          ))}
          {rows.length === 0 && <p className="px-3 py-6 text-sm text-stone text-center">No links in the footer yet.</p>}
        </div>

        <input type="hidden" name="links" value={JSON.stringify(rows.map((r) => ({ id: r.id, label: r.label })))} />
        <SaveButton>Save links</SaveButton>
        <p className="text-xs text-stone mt-2">
          "Remove" only unlinks a page from the footer — the page itself and its content stay put, and you can
          add it back later.
        </p>
      </form>

      <details className="border hairline p-4">
        <summary className="label-caps cursor-pointer">+ Add a new page to the footer</summary>
        <form action={addFooterLink} className="mt-4 flex items-end gap-3 max-w-md">
          <div className="flex-1">
            <label className="label-caps block mb-2">Page title</label>
            <input name="title" required placeholder="e.g. FAQ" className={inputClass} />
          </div>
          <button type="submit" className="btn-secondary !px-4 !py-2">
            Create &amp; add
          </button>
        </form>
        <p className="text-xs text-stone mt-2">
          Creates a new (published, empty) page, adds it to the end of the footer, and takes you straight to its
          content editor.
        </p>
      </details>
    </div>
  );
}
