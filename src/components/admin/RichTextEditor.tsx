"use client";

import { useEffect, useRef } from "react";

const TOOLBAR: { command: string; label: string; title: string }[] = [
  { command: "bold", label: "B", title: "Bold" },
  { command: "italic", label: "I", title: "Italic" },
  { command: "underline", label: "U", title: "Underline" },
  { command: "insertUnorderedList", label: "• List", title: "Bullet list" },
  { command: "insertOrderedList", label: "1. List", title: "Numbered list" },
  { command: "removeFormat", label: "Clear", title: "Clear formatting" },
];

/** A small WYSIWYG editor for body-text blocks — bold, italic, links, lists.
 * Built on contentEditable rather than a library so there's no extra
 * dependency to keep working; output is plain HTML, sanitized server-side
 * before it's ever saved (see src/lib/sanitize.ts). */
export function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);

  useEffect(() => {
    // Ask the browser to produce semantic tags (<b>, <i>, <u>, <p>) instead
    // of inline styles or bare <div>s, so the sanitizer's small tag
    // allowlist covers whatever actually comes out of the editor.
    try {
      // execCommand's TS signature says its 3rd arg is always a string, but
      // this particular legacy command actually wants a real boolean at
      // runtime — hence the cast rather than passing "false" as text.
      document.execCommand("styleWithCSS", false, false as unknown as string);
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {
      // Unsupported in some browsers — formatting still works, just with
      // whatever markup that browser defaults to.
    }
  }, []);

  useEffect(() => {
    if (ref.current && !isInternalUpdate.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value;
    }
    isInternalUpdate.current = false;
  }, [value]);

  function handleInput() {
    if (!ref.current) return;
    isInternalUpdate.current = true;
    onChange(ref.current.innerHTML);
  }

  function exec(command: string) {
    ref.current?.focus();
    document.execCommand(command);
    handleInput();
  }

  function addLink() {
    const url = window.prompt("Link URL (https://…)");
    if (!url) return;
    ref.current?.focus();
    document.execCommand("createLink", false, url);
    handleInput();
  }

  return (
    <div className="border border-line">
      <div className="flex flex-wrap gap-1 px-2 py-1 border-b border-line bg-line/30">
        {TOOLBAR.map((btn) => (
          <button
            key={btn.command}
            type="button"
            title={btn.title}
            // Keep focus/selection inside the editor when clicking a toolbar
            // button — otherwise the browser loses the text selection
            // execCommand needs to know what to format.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(btn.command)}
            className="text-xs px-2 py-1 hover:bg-white border border-line"
          >
            {btn.label}
          </button>
        ))}
        <button
          type="button"
          title="Add a link"
          onMouseDown={(e) => e.preventDefault()}
          onClick={addLink}
          className="text-xs px-2 py-1 hover:bg-white border border-line"
        >
          Link
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        onInput={handleInput}
        suppressContentEditableWarning
        className="px-3 py-2 text-sm min-h-[100px] focus:outline-none [&_a]:underline [&_a]:text-accent [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
      />
    </div>
  );
}
