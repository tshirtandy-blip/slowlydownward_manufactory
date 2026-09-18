"use client";

import { updateLegalSettings } from "./actions";
import { SaveButton } from "@/components/admin/SaveButton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";

export function LegalSettingsForm({
  settings,
}: {
  settings: {
    cookiePopupEnabled: boolean;
    cookiePopupMessage: string;
    cookiePopupSignupHeading: string;
    cookiePopupSignupBody: string;
    withdrawalPeriodDays: number;
  };
}) {
  return (
    <form action={updateLegalSettings} className="max-w-xl space-y-6">
      <Card className="border-line shadow-none">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            <Checkbox id="cookiePopupEnabled" name="cookiePopupEnabled" defaultChecked={settings.cookiePopupEnabled} />
            <Label htmlFor="cookiePopupEnabled" className="text-sm font-normal">
              Show the cookie &amp; sign-up popup to first-time visitors
            </Label>
          </div>

          <div>
            <Label htmlFor="cookiePopupMessage" className="label-caps mb-2 block">
              Cookie notice text
            </Label>
            <Textarea
              id="cookiePopupMessage"
              name="cookiePopupMessage"
              defaultValue={settings.cookiePopupMessage}
              className="border-line"
            />
          </div>

          <div>
            <Label htmlFor="cookiePopupSignupHeading" className="label-caps mb-2 block">
              Sign-up heading
            </Label>
            <Input
              id="cookiePopupSignupHeading"
              name="cookiePopupSignupHeading"
              defaultValue={settings.cookiePopupSignupHeading}
              className="border-line"
            />
          </div>

          <div>
            <Label htmlFor="cookiePopupSignupBody" className="label-caps mb-2 block">
              Sign-up text
            </Label>
            <Textarea
              id="cookiePopupSignupBody"
              name="cookiePopupSignupBody"
              defaultValue={settings.cookiePopupSignupBody}
              className="border-line"
            />
            <p className="mt-2 text-xs text-stone">
              Anyone who leaves their email here (or in the footer's own sign-up form) is added to your Mailchimp
              audience, same as ticking "Email me about new releases" in their account settings.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-line shadow-none">
        <CardContent className="p-6">
          <Label htmlFor="withdrawalPeriodDays" className="label-caps mb-2 block">
            Right to cancel — withdrawal window (days)
          </Label>
          <Input
            id="withdrawalPeriodDays"
            type="number"
            min={1}
            name="withdrawalPeriodDays"
            defaultValue={settings.withdrawalPeriodDays}
            className="max-w-[8rem] border-line"
          />
          <p className="mt-2 text-xs text-stone">
            Shown next to the "Withdraw from contract" button on a customer's order history (Your Account &gt;
            Order history). Under EU/UK consumer law this is at least 14 days from delivery — the button itself
            always stays available regardless of this number, since wrongly hiding it is the bigger legal risk.
          </p>
        </CardContent>
      </Card>

      <SaveButton>Save</SaveButton>
    </form>
  );
}
