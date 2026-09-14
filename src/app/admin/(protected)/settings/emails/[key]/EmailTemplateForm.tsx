"use client";

import { useState, useTransition } from "react";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { updateEmailTemplate, sendTestEmail } from "./actions";

const inputClass = "border hairline bg-transparent px-3 py-2 text-sm w-full";

export function EmailTemplateForm({
  templateKey,
  initialSubject,
  initialIntroHtml,
  initialClosingHtml,
  hasClosing,
  variables,
}: {
  templateKey: string;
  initialSubject: string;
  initialIntroHtml: string;
  initialClosingHtml: string;
  hasClosing: boolean;
  variables: { token: string; description: string }[];
}) {
  const [subject, setSubject] = useState(initialSubject);
  const [introHtml, setIntroHtml] = useState(initialIntroHtml);
  const [closingHtml, setClosingHtml] = useState(initialClosingHtml);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const [testError, setTestError] = useState<string | null>(null);
  const [testSent, setTestSent] = useState(false);
  const [testPending, startTestTransition] = useTransition();

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateEmailTemplate(templateKey, { subject, introHtml, closingHtml });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  function sendTest() {
    setTestError(null);
    setTestSent(false);
    startTestTransition(async () => {
      const result = await sendTestEmail(templateKey);
      if (!result.ok) {
        setTestError(result.error);
        return;
      }
      setTestSent(true);
    });
  }

  return (
    <div className="space-y-8">
      {variables.length > 0 && (
        <div className="border hairline p-4 text-xs text-stone">
          <p className="label-caps mb-2">Available in this email</p>
          <ul className="space-y-1">
            {variables.map((v) => (
              <li key={v.token}>
                <code className="text-ink">{v.token}</code> — {v.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <label className="label-caps block mb-2">Subject line</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} />
      </div>

      <div>
        <label className="label-caps block mb-2">Message</label>
        <RichTextEditor value={introHtml} onChange={setIntroHtml} />
      </div>

      {hasClosing && (
        <div>
          <label className="label-caps block mb-2">Closing note (optional, shown after the order details)</label>
          <RichTextEditor value={closingHtml} onChange={setClosingHtml} />
        </div>
      )}

      {error && <p className="text-sm text-accent">{error}</p>}
      {saved && !error && <p className="text-sm text-stone">Saved.</p>}

      <div className="flex items-center gap-4">
        <button type="button" onClick={save} disabled={pending} className="btn-primary disabled:opacity-50">
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={sendTest} disabled={testPending} className="btn-secondary disabled:opacity-50">
          {testPending ? "Sending…" : "Send yourself a test"}
        </button>
      </div>
      {testError && <p className="text-sm text-accent">{testError}</p>}
      {testSent && !testError && <p className="text-sm text-stone">Test sent — check your inbox.</p>}
      <p className="text-xs text-stone">
        "Send yourself a test" uses the last saved version with sample order details — save first if you've just made
        changes.
      </p>
    </div>
  );
}
