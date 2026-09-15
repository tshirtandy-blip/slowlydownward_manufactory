import Link from "next/link";
import { listEmailTemplates, EMAIL_TEMPLATE_INFO, type EmailTemplateKey } from "@/lib/email-templates";
import { getSiteSettings } from "@/lib/site-settings";
import { EmailLogoForm } from "./EmailLogoForm";

export const dynamic = "force-dynamic";

export default async function EmailTemplatesPage() {
  const [templates, settings] = await Promise.all([listEmailTemplates(), getSiteSettings()]);

  return (
    <div>
      <h1 className="font-display text-2xl mb-2">Emails</h1>
      <p className="text-stone text-sm mb-8">
        The wording sent out automatically at each of these moments. Order details, price breakdowns and buttons
        are always added automatically — you're just editing the message around them.
      </p>

      <EmailLogoForm initialLogoUrl={settings.emailLogoUrl ?? ""} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
        {templates.map((template) => {
          const key = template.key as EmailTemplateKey;
          const info = EMAIL_TEMPLATE_INFO[key];
          return (
            <Link
              key={template.id}
              href={`/admin/settings/emails/${key}`}
              className="border hairline p-6 hover:border-ink block"
            >
              <h2 className="font-display text-lg mb-1">{info?.label ?? key}</h2>
              <p className="text-sm text-stone mb-3">{info?.description}</p>
              <p className="text-xs text-stone">
                Last updated {template.updatedAt.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
