"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A submit button for a <form action={serverAction}> that shows "Saved"
 * once the save completes, then goes back to prompting "Save" the moment
 * anything in the form is edited again — so it never claims to be saved
 * when there's a change sitting in the form that hasn't been sent yet.
 *
 * Must be rendered as a descendant of the <form> it belongs to (it can be
 * a Server Component's form — this component itself is the only bit that
 * needs to be a Client Component, same as any other button inside a form
 * action elsewhere in this app).
 *
 * Detects "the form was edited" two ways, covering every editor used in
 * this admin: a native `input`/`change` event (typed text, a `<select>`,
 * a checkbox, the rich-text editor's contentEditable area) or a click on
 * any plain `type="button"` control inside the form (the "+ Add row",
 * "Remove", "▲ / ▼ move", logo-size +/- buttons used by the list editors)
 * — deliberately not the submit button itself, so clicking Save doesn't
 * immediately undo its own "Saved" state.
 */
export function SaveButton({
  children = "Save",
  savingText = "Saving…",
  savedText = "Saved",
  className,
}: {
  children?: React.ReactNode;
  savingText?: React.ReactNode;
  savedText?: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const [saved, setSaved] = useState(false);
  const wasPending = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // pending flips true -> false once the form action finishes running
  // (without throwing) — that's the "saved successfully" signal. A
  // redirect() in the action navigates away before this ever resolves, so
  // pages that redirect on save (e.g. "Create page") simply never show it.
  useEffect(() => {
    if (wasPending.current && !pending) setSaved(true);
    wasPending.current = pending;
  }, [pending]);

  useEffect(() => {
    const form = buttonRef.current?.form;
    if (!form) return;

    const markEdited = () => setSaved(false);
    const handleClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement)?.closest("button");
      if (el && el.type === "button") markEdited();
    };

    form.addEventListener("input", markEdited);
    form.addEventListener("change", markEdited);
    form.addEventListener("click", handleClick);
    return () => {
      form.removeEventListener("input", markEdited);
      form.removeEventListener("change", markEdited);
      form.removeEventListener("click", handleClick);
    };
  }, []);

  return (
    <button ref={buttonRef} type="submit" disabled={pending} className={cn(buttonVariants(), className)}>
      {pending ? savingText : saved ? savedText : children}
    </button>
  );
}
