import { getSiteSettings } from "@/lib/site-settings";
import { LegalSettingsForm } from "./LegalSettingsForm";

export const dynamic = "force-dynamic";

export default async function LegalSettingsPage() {
  const settings = await getSiteSettings();

  return (
    <div>
      <h1 className="font-display text-2xl mb-2">Legal &amp; popup</h1>
      <p className="text-stone text-sm mb-8">
        The first-visit cookie notice and email sign-up popup, and the "right to cancel" window shown to customers
        on their own orders.
      </p>
      <LegalSettingsForm
        settings={{
          cookiePopupEnabled: settings.cookiePopupEnabled,
          cookiePopupMessage: settings.cookiePopupMessage,
          cookiePopupSignupHeading: settings.cookiePopupSignupHeading,
          cookiePopupSignupBody: settings.cookiePopupSignupBody,
          withdrawalPeriodDays: settings.withdrawalPeriodDays,
        }}
      />
    </div>
  );
}
