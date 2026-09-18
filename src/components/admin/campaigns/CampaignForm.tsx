"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import {
  previewRecipientCount,
  saveCampaignDraft,
  sendCampaignNow,
  scheduleCampaign,
  sendTestCampaignEmail,
  deleteCampaignDraft,
} from "@/app/admin/(protected)/campaigns/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function CampaignForm({
  campaignId,
  initialSubject,
  initialHtml,
  initialAudience,
}: {
  campaignId: string | null;
  initialSubject: string;
  initialHtml: string;
  initialAudience: "ALL" | "CUSTOMERS";
}) {
  const router = useRouter();
  const [id, setId] = useState(campaignId);
  const [subject, setSubject] = useState(initialSubject);
  const [html, setHtml] = useState(initialHtml);
  const [audience, setAudience] = useState<"ALL" | "CUSTOMERS">(initialAudience);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [savePending, startSave] = useTransition();

  const [sendError, setSendError] = useState<string | null>(null);
  const [sendPending, startSend] = useTransition();

  const [scheduledFor, setScheduledFor] = useState("");

  const [testEmail, setTestEmail] = useState("");
  const [testError, setTestError] = useState<string | null>(null);
  const [testSent, setTestSent] = useState(false);
  const [testPending, startTest] = useTransition();

  useEffect(() => {
    let cancelled = false;
    previewRecipientCount(audience).then((count) => {
      if (!cancelled) setRecipientCount(count);
    });
    return () => {
      cancelled = true;
    };
  }, [audience]);

  function save() {
    setSaveError(null);
    setSaved(false);
    startSave(async () => {
      const result = await saveCampaignDraft(id, { subject, html, audience });
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      setSaved(true);
      if (!id) {
        setId(result.id);
        router.replace(`/admin/campaigns/${result.id}`);
      }
    });
  }

  function sendNow() {
    if (!id) {
      setSendError("Save the draft first.");
      return;
    }
    setSendError(null);
    startSend(async () => {
      const saveResult = await saveCampaignDraft(id, { subject, html, audience });
      if (!saveResult.ok) {
        setSendError(saveResult.error);
        return;
      }
      const result = await sendCampaignNow(id);
      if (!result.ok) {
        setSendError(result.error);
        return;
      }
      router.push(`/admin/campaigns/${id}`);
      router.refresh();
    });
  }

  function schedule() {
    if (!id) {
      setSendError("Save the draft first.");
      return;
    }
    if (!scheduledFor) {
      setSendError("Pick a date and time first.");
      return;
    }
    setSendError(null);
    startSend(async () => {
      const saveResult = await saveCampaignDraft(id, { subject, html, audience });
      if (!saveResult.ok) {
        setSendError(saveResult.error);
        return;
      }
      const result = await scheduleCampaign(id, new Date(scheduledFor).toISOString());
      if (!result.ok) {
        setSendError(result.error);
        return;
      }
      router.push(`/admin/campaigns/${id}`);
      router.refresh();
    });
  }

  function sendTest() {
    if (!id) {
      setTestError("Save the draft first.");
      return;
    }
    if (!testEmail.trim()) {
      setTestError("Enter an email address.");
      return;
    }
    setTestError(null);
    setTestSent(false);
    startTest(async () => {
      const saveResult = await saveCampaignDraft(id, { subject, html, audience });
      if (!saveResult.ok) {
        setTestError(saveResult.error);
        return;
      }
      const result = await sendTestCampaignEmail(id, testEmail.trim());
      if (!result.ok) {
        setTestError(result.error);
        return;
      }
      setTestSent(true);
    });
  }

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <Label htmlFor="campaignSubject" className="label-caps mb-2 block">
          Subject line
        </Label>
        <Input
          id="campaignSubject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="News from Slowly Downward"
          className="border-line"
        />
      </div>

      <div>
        <Label className="label-caps mb-2 block">Message</Label>
        <RichTextEditor value={html} onChange={setHtml} />
        <p className="mt-1 text-xs text-stone">
          An unsubscribe link is added automatically — no need to write your own.
        </p>
      </div>

      <Card className="border-line shadow-none">
        <CardContent className="p-6 space-y-3">
          <Label htmlFor="campaignAudience" className="label-caps block">
            Which database to send from
          </Label>
          <select
            id="campaignAudience"
            value={audience}
            onChange={(e) => setAudience(e.target.value as "ALL" | "CUSTOMERS")}
            className="flex h-10 w-full max-w-xs border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="ALL">Everyone who's opted in to marketing email</option>
            <option value="CUSTOMERS">Customers only (opted in and has ordered)</option>
          </select>
          <p className="text-xs text-stone">
            {recipientCount === null ? "Counting…" : `Sending to ${recipientCount.toLocaleString()} people.`}
          </p>
        </CardContent>
      </Card>

      {saveError && <p className="text-sm text-accent">{saveError}</p>}
      {saved && !saveError && <p className="text-sm text-stone">Draft saved.</p>}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="button" variant="secondary" onClick={save} disabled={savePending}>
          {savePending ? "Saving…" : "Save draft"}
        </Button>
        <Button type="button" onClick={sendNow} disabled={sendPending}>
          {sendPending ? "Sending…" : "Send now"}
        </Button>
        {id && (
          <form action={deleteCampaignDraft.bind(null, id)} className="ml-auto">
            <ConfirmSubmitButton
              confirmText="Delete this draft? This can't be undone."
              className="text-xs text-stone hover:text-accent"
            >
              Delete draft
            </ConfirmSubmitButton>
          </form>
        )}
      </div>

      <Card className="border-line shadow-none">
        <CardContent className="p-6 space-y-3">
          <Label htmlFor="scheduledFor" className="label-caps block">
            Or schedule for later
          </Label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="scheduledFor"
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="flex h-10 border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            <Button type="button" variant="secondary" onClick={schedule} disabled={sendPending}>
              {sendPending ? "Scheduling…" : "Schedule"}
            </Button>
          </div>
        </CardContent>
      </Card>
      {sendError && <p className="text-sm text-accent">{sendError}</p>}

      <Card className="border-line shadow-none">
        <CardContent className="p-6 space-y-3">
          <Label htmlFor="testEmail" className="label-caps block">
            Send yourself a test first
          </Label>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              id="testEmail"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="you@slowlydownward.co.uk"
              className="border-line max-w-xs"
            />
            <Button type="button" variant="secondary" onClick={sendTest} disabled={testPending}>
              {testPending ? "Sending…" : "Send test"}
            </Button>
          </div>
          {testError && <p className="text-sm text-accent">{testError}</p>}
          {testSent && !testError && <p className="text-sm text-stone">Test sent — check your inbox.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
