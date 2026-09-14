import { notFound } from "next/navigation";
import Link from "next/link";
import { getEmailTemplate, EMAIL_TEMPLATE_INFO, EMAIL_TEMPLATE_KEYS, type EmailTemplateKey } from "@/lib/email-templates";
import { EmailTemplateForm } from "./EmailTemplateForm";

export const dynamic = "force-dynamic";

function isTemplateKey(key: string): key is EmailTemplateKey {
  return (EMAIL_TEMPLATE_KEYS as string[]).includes(key);
}

export default async function EmailTemplateEditPage({ params }: { params: { key: string } }) {
  if (!isTemplateKey(params.key)) notFound();

  const info = EMAIL_TEMPLATE_INFO[params.key];
  const template = await getEmailTemplate(params.key);

  return (
    <div className="max-w-2xl">
      <Link href="/admin/settings/emails" className="text-xs text-stone hover:text-ink underline">
        ← All emails
      </Link>
      <h1 className="font-display text-2xl mt-3 mb-2">{info.label}</h1>
      <p className="text-stone text-sm mb-8">{info.description}</p>

      <EmailTemplateForm
        templateKey={params.key}
        initialSubject={template.subject}
        initialIntroHtml={template.introHtml}
        initialClosingHtml={template.closingHtml}
        hasClosing={info.hasClosing}
        variables={info.variables}
      />
    </div>
  );
}
