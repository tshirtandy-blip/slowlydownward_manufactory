import Link from "next/link";
import { getGlobalCoaTemplate } from "@/lib/coa-template";
import { CoaTemplateEditor } from "@/components/admin/CoaTemplateEditor";
import { saveGlobalCoaTemplate, previewCoaPdf } from "./actions";

export const dynamic = "force-dynamic";

export default async function CoaTemplateSettingsPage() {
  const template = await getGlobalCoaTemplate();

  return (
    <div className="max-w-4xl">
      <Link href="/admin/settings" className="label-caps text-stone hover:text-ink">
        ← Settings
      </Link>
      <h1 className="font-display text-2xl mt-2 mb-1">Certificate of Authenticity template</h1>
      <p className="text-stone text-sm mb-8">
        This is the default template used to generate the Certificate of Authenticity printed from Admin &gt;
        Packing. Any product can be given its own template instead, from that product's own edit page — this one is
        what's used for every product that doesn't have its own.
      </p>

      <CoaTemplateEditor
        initial={{ name: template.name, pageSize: template.pageSize, bodyHtml: template.bodyHtml, css: template.css }}
        saveAction={saveGlobalCoaTemplate}
        previewAction={previewCoaPdf}
      />
    </div>
  );
}
