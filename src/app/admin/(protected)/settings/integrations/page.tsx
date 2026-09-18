import { prisma } from "@/lib/prisma";
import { upsConfigured } from "@/lib/integrations/ups";
import { royalMailConfigured } from "@/lib/integrations/royalmail";
import { mailchimpConfigured } from "@/lib/integrations/mailchimp";
import { xeroConfigured } from "@/lib/integrations/xero";
import { emailConfigured } from "@/lib/integrations/resend";
import { resendBroadcastsConfigured } from "@/lib/integrations/resend-broadcasts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <Badge variant="outline" className={ok ? "border-ink text-ink" : "border-line text-stone"}>
      {ok ? "Connected" : "Not connected"}
    </Badge>
  );
}

export default async function IntegrationsPage() {
  const xeroSetting = await prisma.integrationSetting.findUnique({ where: { provider: "XERO" } });
  const xeroConnected = !!xeroSetting?.enabled;

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="font-display text-2xl mb-2">Integrations</h1>
      <p className="text-stone text-sm mb-8">
        Stripe, UPS, Royal Mail and Mailchimp are configured with API keys as environment
        variables (see the README) — that keeps secrets out of the database. Xero uses an
        OAuth connection instead, which you authorise below.
      </p>

      <Card className="border-line shadow-none">
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <h2 className="font-display">Stripe</h2>
            <p className="text-sm text-stone">Payments — required for checkout to work at all.</p>
          </div>
          <StatusBadge ok={!!process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== "sk_test_placeholder"} />
        </CardContent>
      </Card>

      <Card className="border-line shadow-none">
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <h2 className="font-display">UPS</h2>
            <p className="text-sm text-stone">International shipping labels, created when an order is packed.</p>
          </div>
          <StatusBadge ok={upsConfigured()} />
        </CardContent>
      </Card>

      <Card className="border-line shadow-none">
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <h2 className="font-display">Royal Mail (Click &amp; Drop)</h2>
            <p className="text-sm text-stone">UK shipping labels, created when an order is packed.</p>
          </div>
          <StatusBadge ok={royalMailConfigured()} />
        </CardContent>
      </Card>

      <Card className="border-line shadow-none">
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <h2 className="font-display">Resend (email)</h2>
            <p className="text-sm text-stone">
              Sends the payment-link, order confirmation and welcome emails — wording editable under Settings &gt;
              Emails.
            </p>
          </div>
          <StatusBadge ok={emailConfigured()} />
        </CardContent>
      </Card>

      <Card className="border-line shadow-none">
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <h2 className="font-display">Resend Broadcasts (campaigns)</h2>
            <p className="text-sm text-stone">
              Powers Admin &gt; Campaigns — the newsletter/marketing sends that used to go out through Mailchimp.
              Uses the same API key as Resend above, plus its own webhook (see the README) for opens/clicks and
              automatic list cleaning on a bounce or complaint.
            </p>
          </div>
          <StatusBadge ok={resendBroadcastsConfigured()} />
        </CardContent>
      </Card>

      <Card className="border-line shadow-none">
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <h2 className="font-display">Mailchimp</h2>
            <p className="text-sm text-stone">
              Legacy — customers are still synced here too for now. Being phased out in favour of Resend Broadcasts
              above.
            </p>
          </div>
          <StatusBadge ok={mailchimpConfigured()} />
        </CardContent>
      </Card>

      <Card className="border-line shadow-none">
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <h2 className="font-display">Xero</h2>
            <p className="text-sm text-stone">A draft invoice is created for each completed order.</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge ok={xeroConnected} />
            {!xeroConnected && (
              <Button asChild variant="outline" size="sm">
                <a href="/api/integrations/xero/connect">Connect</a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
