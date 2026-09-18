"use client";

import { useState, useTransition } from "react";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { updateEmailTemplate, sendTestEmail } from "./actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

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
        <Card className="border-line shadow-none">
          <CardContent className="p-4 text-xs text-stone">
            <p className="label-caps mb-2">Available in this email</p>
            <ul className="space-y-1">
              {variables.map((v) => (
                <li key={v.token}>
                  <code className="text-ink">{v.token}</code> — {v.description}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div>
        <Label htmlFor="emailSubject" className="label-caps mb-2 block">
          Subject line
        </Label>
        <Input id="emailSubject" value={subject} onChange={(e) => setSubject(e.target.value)} className="border-line" />
      </div>

      <div>
        <Label className="label-caps mb-2 block">Message</Label>
        <RichTextEditor value={introHtml} onChange={setIntroHtml} />
      </div>

      {hasClosing && (
        <div>
          <Label className="label-caps mb-2 block">Closing note (optional, shown after the order details)</Label>
          <RichTextEditor value={closingHtml} onChange={setClosingHtml} />
        </div>
      )}

      {error && <p className="text-sm text-accent">{error}</p>}
      {saved && !error && <p className="text-sm text-stone">Saved.</p>}

      <div className="flex items-center gap-4">
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="secondary" onClick={sendTest} disabled={testPending}>
          {testPending ? "Sending…" : "Send yourself a test"}
        </Button>
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
