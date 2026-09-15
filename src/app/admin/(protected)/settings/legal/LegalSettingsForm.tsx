"use client";

import { updateLegalSettings } from "./actions";
import { SaveButton } from "@/components/admin/SaveButton";

const inputClass = "border hairline bg-transparent px-3 py-2 text-sm w-full";
const textareaClass = inputClass + " min-h-[5rem]";

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
    <form action={updateLegalSettings} className="space-y-8 max-w-xl">
      <div className="border hairline p-4">
        <label className="flex items-center gap-2 text-sm mb-4">
          <input type="checkbox" name="cookiePopupEnabled" defaultChecked={settings.cookiePopupEnabled} />
          Show the cookie &amp; sign-up popup to first-time visitors
        </label>

        <label className="label-caps block mb-2">Cookie notice text</label>
        <textarea
          name="cookiePopupMessage"
          defaultValue={settings.cookiePopupMessage}
          className={textareaClass + " mb-4"}
        />

        <label className="label-caps block mb-2">Sign-up heading</label>
        <input
          name="cookiePopupSignupHeading"
          defaultValue={settings.cookiePopupSignupHeading}
          className={inputClass + " mb-4"}
        />

        <label className="label-caps block mb-2">Sign-up text</label>
        <textarea name="cookiePopupSignupBody" defaultValue={settings.cookiePopupSignupBody} className={textareaClass} />
        <p className="text-xs text-stone mt-2">
          Anyone who leaves their email here (or in the footer's own sign-up form) is added to your Mailchimp
          audience, same as ticking "Email me about new releases" in their account settings.
        </p>
      </div>

      <div className="border hairline p-4">
        <label className="label-caps block mb-2">Right to cancel — withdrawal window (days)</label>
        <input
          type="number"
          min={1}
          name="withdrawalPeriodDays"
          defaultValue={settings.withdrawalPeriodDays}
          className={inputClass + " max-w-[8rem]"}
        />
        <p className="text-xs text-stone mt-2">
          Shown next to the "Withdraw from contract" button on a customer's order history (Your Account &gt; Order
          history). Under EU/UK consumer law this is at least 14 days from delivery — the button itself always stays
          available regardless of this number, since wrongly hiding it is the bigger legal risk.
        </p>
      </div>

      <SaveButton>Save</SaveButton>
    </form>
  );
}
