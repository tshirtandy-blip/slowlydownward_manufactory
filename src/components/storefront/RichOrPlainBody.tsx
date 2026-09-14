function paragraphs(body: string) {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// Body text saved through the old plain-textarea editor is just text with
// blank-line paragraph breaks; body text from the newer RichTextEditor is
// actual (already-sanitized) HTML. Telling them apart by whether there's a
// tag in it means old content keeps rendering exactly as before, with no
// data migration needed. Shared by page content blocks and a print's own
// description, since both can come from either editor.
function isRichText(body: string) {
  return /<[a-z][\s\S]*>/i.test(body);
}

export const richTextClass =
  "text-stone leading-relaxed [&_p]:mb-4 [&_p:last-child]:mb-0 [&_a]:underline [&_a]:text-ink [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:mb-1";

export function RichOrPlainBody({ body }: { body: string }) {
  if (isRichText(body)) {
    return <div className={richTextClass} dangerouslySetInnerHTML={{ __html: body }} />;
  }
  return (
    <>
      {paragraphs(body).map((para, i) => (
        <p key={i} className="text-stone leading-relaxed whitespace-pre-line mb-4 last:mb-0">
          {para}
        </p>
      ))}
    </>
  );
}
