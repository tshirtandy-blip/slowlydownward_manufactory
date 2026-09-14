"use client";

/** A submit button inside a <form action={serverAction}> that asks for
 * confirmation before the form actually submits — for irreversible actions
 * like deleting a page. */
export function ConfirmSubmitButton({
  children,
  confirmText,
  className,
}: {
  children: React.ReactNode;
  confirmText: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(confirmText)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
