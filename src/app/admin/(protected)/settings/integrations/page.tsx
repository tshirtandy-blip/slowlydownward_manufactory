import { prisma } from "@/lib/prisma";
import { upsConfigured } from "@/lib/integrations/ups";
import { royalMailConfigured } from "@/lib/integrations/royalmail";
import { mailchimpConfigured } from "@/lib/integrations/mailchimp";
import { xeroConfigured } from "@/lib/integrations/xero";

export const dynamic = "force-dynamic";

function StatusPill({ ok }: { ok: boolean }) {
  return (
    <span className={`label-caps px-2 py-1 border ${ok ? "border-ink" : "border-line text-stone"}`}>
      {ok ? "Connected" : "Not connected"}
    </span>
  );
}

export default async function IntegrationsPage() {
  const xeroSetting = await prisma.integrationSetting.findUnique({ where: { provider: "XERO" } });
  const xeroConnected = !!xeroSetting?.enabled;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-2xl mb-2">Integrations</h1>
      <p className="text-stone text-sm mb-8">
        Stripe, UPS, Royal Mail and Mailchimp are configured with API keys as environment
        variables (see the README) — that keeps secrets out of the database. Xero uses an
        OAuth connection instead, which you authorise below.
      </p>

      <div className="border hairline p-5 flex items-center justify-between">
        <div>
          <h2 className="font-display">Stripe</h2>
          <p className="text-sm text-stone">Payments — required for checkout to work at all.</p>
        </div>
        <StatusPill ok={!!process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== "sk_test_placeholder"} />
      </div>

      <div className="border hairline p-5 flex items-center justify-between">
        <div>
          <h2 className="font-display">UPS</h2>
          <p className="text-sm text-stone">International shipping labels, created when an order is packed.</p>
        </div>
        <StatusPill ok={upsConfigured()} />
      </div>

      <div className="border hairline p-5 flex items-center justify-between">
        <div>
          <h2 className="font-display">Royal Mail (Click &amp; Drop)</h2>
          <p className="text-sm text-stone">UK shipping labels, created when an order is packed.</p>
        </div>
        <StatusPill ok={royalMailConfigured()} />
      </div>

      <div className="border hairline p-5 flex items-center justify-between">
        <div>
          <h2 className="font-display">Mailchimp</h2>
          <p className="text-sm text-stone">Customers are synced to your audience after a successful order.</p>
        </div>
        <StatusPill ok={mailchimpConfigured()} />
      </div>

      <div className="border hairline p-5 flex items-center justify-between">
        <div>
          <h2 className="font-display">Xero</h2>
          <p className="text-sm text-stone">A draft invoice is created for each completed order.</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill ok={xeroConnected} />
          {!xeroConnected && (
            <a href="/api/integrations/xero/connect" className="btn-secondary !px-3 !py-1.5 text-xs">
              Connect
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
