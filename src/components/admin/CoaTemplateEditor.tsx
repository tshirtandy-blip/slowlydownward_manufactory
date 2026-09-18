"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { COA_MERGE_FIELDS, SAMPLE_COA_VALUES, substituteTokens, COA_PAGE_SIZES } from "@/lib/coa-merge-fields";
import { openPdfInTab } from "@/lib/pdf-blob";
import { Button } from "@/components/ui/button";

type TemplateData = { name: string; pageSize: string; bodyHtml: string; css: string };
type SaveResult = { ok: true } | { ok: false; error: string };
type PreviewResult = { ok: true; pdfBase64: string } | { ok: false; error: string };

/**
 * The Certificate of Authenticity template editor — shared by the global
 * default (Admin > Settings > COA template) and a product's own override
 * (Admin > Products > a print > Certificate of Authenticity). A template
 * is owner-authored HTML + CSS with {{mergeField}} placeholder tokens
 * (COA_MERGE_FIELDS); the live preview substitutes SAMPLE_COA_VALUES so an
 * owner sees realistic output without a real order.
 *
 * Deliberately plain <textarea>s rather than a code-editor library — the
 * one real new dependency this feature needed is the PDF engine itself
 * (puppeteer-core + @sparticuz/chromium — see src/lib/coa-pdf.ts), not the
 * editor UI.
 */
export function CoaTemplateEditor({
  initial,
  usingDefault,
  saveAction,
  previewAction,
  onSwitchToDefault,
}: {
  initial: TemplateData;
  /** True only for the per-product editor when this product has no
   * override yet — the fields below are pre-filled from the resolved
   * (global default) template as a starting point. */
  usingDefault?: boolean;
  saveAction: (data: TemplateData) => Promise<SaveResult>;
  previewAction: (data: TemplateData) => Promise<PreviewResult>;
  /** Only present on the per-product editor: deletes this product's
   * override so it goes back to using the global default. */
  onSwitchToDefault?: () => Promise<SaveResult>;
}) {
  const [name, setName] = useState(initial.name);
  const [pageSize, setPageSize] = useState(initial.pageSize);
  const [bodyHtml, setBodyHtml] = useState(initial.bodyHtml);
  const [css, setCss] = useState(initial.css);
  const [activePane, setActivePane] = useState<"html" | "css">("html");
  const htmlRef = useRef<HTMLTextAreaElement>(null);
  const cssRef = useRef<HTMLTextAreaElement>(null);

  const [saving, startSaveTransition] = useTransition();
  const [previewing, startPreviewTransition] = useTransition();
  const [saveMessage, setSaveMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const previewHtml = useMemo(() => {
    const merged = substituteTokens(bodyHtml, SAMPLE_COA_VALUES);
    return `<!doctype html><html><head><meta charset="utf-8" /><style>${css}</style></head><body>${merged}</body></html>`;
  }, [bodyHtml, css]);

  function insertToken(token: string) {
    const insertText = `{{${token}}}`;
    const el = activePane === "html" ? htmlRef.current : cssRef.current;
    const setValue = activePane === "html" ? setBodyHtml : setCss;

    if (!el) {
      setValue((prev) => prev + insertText);
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    setValue(el.value.slice(0, start) + insertText + el.value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + insertText.length;
    });
  }

  function handleSave() {
    setSaveMessage(null);
    startSaveTransition(async () => {
      const res = await saveAction({ name, pageSize, bodyHtml, css });
      setSaveMessage(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: res.error });
    });
  }

  function handleSwitchToDefault() {
    if (!onSwitchToDefault) return;
    setSaveMessage(null);
    startSaveTransition(async () => {
      const res = await onSwitchToDefault();
      setSaveMessage(res.ok ? { ok: true, text: "Switched back to the default template." } : { ok: false, text: res.error });
    });
  }

  function handlePreviewPdf() {
    setPreviewError(null);
    // Opened synchronously, before the await below, so the browser doesn't
    // block it as a popup — see src/lib/pdf-blob.ts.
    const popup = window.open("", "_blank", "width=650,height=800");
    startPreviewTransition(async () => {
      const res = await previewAction({ name, pageSize, bodyHtml, css });
      if (!res.ok) {
        setPreviewError(res.error);
        popup?.close();
        return;
      }
      openPdfInTab(popup, res.pdfBase64);
    });
  }

  return (
    <div className="space-y-4">
      {usingDefault && (
        <p className="text-xs text-stone border border-line bg-line/20 p-3">
          This product doesn't have its own Certificate of Authenticity template yet — the fields below show the
          global default (Admin &gt; Settings &gt; COA template). Saving here creates a copy specific to this
          product; the default itself is left unchanged.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <label className="text-xs text-stone">
          Template name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="block w-64 border border-input bg-background px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-stone">
          Page size
          <select
            value={pageSize}
            onChange={(e) => setPageSize(e.target.value)}
            className="block border border-input bg-background px-2 py-1 text-sm"
          >
            {COA_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        {onSwitchToDefault && (
          <button type="button" onClick={handleSwitchToDefault} className="text-xs text-stone underline hover:text-ink">
            Use the default template instead
          </button>
        )}
      </div>

      <div>
        <p className="label-caps text-stone mb-2">Insert field</p>
        <div className="flex flex-wrap gap-1">
          {COA_MERGE_FIELDS.map((field) => (
            <button
              key={field.token}
              type="button"
              title={field.label}
              onClick={() => insertToken(field.token)}
              className="text-xs px-2 py-1 border border-line hover:bg-line/30"
            >
              {`{{${field.token}}}`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <div className="flex gap-3 mb-1 label-caps">
            <button
              type="button"
              onClick={() => setActivePane("html")}
              className={activePane === "html" ? "text-ink" : "text-stone"}
            >
              HTML
            </button>
            <button
              type="button"
              onClick={() => setActivePane("css")}
              className={activePane === "css" ? "text-ink" : "text-stone"}
            >
              CSS
            </button>
          </div>
          <textarea
            ref={htmlRef}
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            onFocus={() => setActivePane("html")}
            spellCheck={false}
            hidden={activePane !== "html"}
            className="w-full h-80 border border-line bg-white p-3 font-mono text-xs"
          />
          <textarea
            ref={cssRef}
            value={css}
            onChange={(e) => setCss(e.target.value)}
            onFocus={() => setActivePane("css")}
            spellCheck={false}
            hidden={activePane !== "css"}
            className="w-full h-80 border border-line bg-white p-3 font-mono text-xs"
          />
        </div>

        <div>
          <p className="label-caps text-stone mb-1">Preview</p>
          <p className="text-xs text-stone mb-2">
            Your browser rendering the HTML/CSS directly with sample data — the printed PDF is rendered by a
            different engine and may differ slightly. Use "Preview PDF" below for the exact output.
          </p>
          <iframe title="Certificate of Authenticity preview" srcDoc={previewHtml} className="w-full h-80 border border-line bg-white" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" variant="secondary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save template"}
        </Button>
        <Button type="button" variant="outline" onClick={handlePreviewPdf} disabled={previewing}>
          {previewing ? "Generating…" : "Preview PDF"}
        </Button>
        {saveMessage && (
          <span className={saveMessage.ok ? "text-xs text-stone" : "text-xs text-accent"}>{saveMessage.text}</span>
        )}
      </div>
      {previewError && <p className="text-xs text-accent">{previewError}</p>}
    </div>
  );
}
