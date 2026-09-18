"use client";

import { useRef, useState } from "react";
import { richTextClass } from "@/components/storefront/RichOrPlainBody";

/** A campaign composed and sent from Admin > Campaigns stores a plain HTML
 * *fragment* — just the RichTextEditor's output, meant to be dropped inside
 * our own page (see richTextClass) the same way a print description is.
 * A campaign brought in by scripts/import-mailchimp-campaigns.ts is the
 * opposite: Mailchimp hands back a full HTML *document* (its own
 * <html>/<head>/<body>, inline styles, table layouts) built for an email
 * client, which would collide with this page's own styling if dropped in
 * directly. Telling the two apart by whether it starts with a doctype/html
 * tag means both render correctly without the archive needing to know
 * which campaigns came from where. */
function looksLikeFullDocument(html: string) {
  return /^\s*<!doctype html|^\s*<html[\s>]/i.test(html);
}

export function ArchiveCampaignBody({ html }: { html: string }) {
  const [height, setHeight] = useState(600);
  const frameRef = useRef<HTMLIFrameElement>(null);

  if (!looksLikeFullDocument(html)) {
    return <div className={richTextClass} dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return (
    <iframe
      ref={frameRef}
      srcDoc={html}
      title="Newsletter"
      className="w-full border hairline"
      style={{ height }}
      // allow-same-origin only — enough for the parent to read its height
      // below, but no allow-scripts/allow-forms, so nothing in an old
      // Mailchimp template (or anything else in this HTML) can execute.
      sandbox="allow-same-origin"
      onLoad={() => {
        const doc = frameRef.current?.contentWindow?.document;
        if (doc?.body) setHeight(doc.body.scrollHeight + 32);
      }}
    />
  );
}
