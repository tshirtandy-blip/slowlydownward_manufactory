import Link from "next/link";
import { listEmailTemplates, EMAIL_TEMPLATE_INFO, type EmailTemplateKey } from "@/lib/email-templates";
import { getSiteSettings } from "@/lib/site-settings";
import { EmailLogoForm } from "./EmailLogoForm";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function EmailTemplatesPage() {
  const [templates, settings] = await Promise.all([listEmailTemplates(), getSiteSettings()]);

  return (
    <div>
      <h1 className="font-display text-2xl mb-2">Emails</h1>
      <p className="mb-8 text-sm text-stone">
        The wording sent out automatically at each of these moments. Order details, price breakdowns and buttons
        are always added automatically — you're just editing the message around them.
      </p>

      <EmailLogoForm initialLogoUrl={settings.emailLogoUrl ?? ""} />

      <div className="grid max-w-2xl grid-cols-1 gap-6 md:grid-cols-2">
        {templates.map((template) => {
          const key = template.key as EmailTemplateKey;
          const info = EMAIL_TEMPLATE_INFO[key];
          return (
            <Link key={template.id} href={`/admin/settings/emails/${key}`} className="block">
              <Card className="h-full border-line shadow-none transition-colors hover:border-ink">
                <CardContent className="p-6">
                  <h2 className="font-display text-lg mb-1">{info?.label ?? key}</h2>
                  <p className="mb-3 text-sm text-stone">{info?.description}</p>
                  <p className="text-xs text-stone">
                    Last updated {template.updatedAt.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
