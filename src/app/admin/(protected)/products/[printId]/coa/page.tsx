import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getGlobalCoaTemplate, getCoaTemplateOverride } from "@/lib/coa-template";
import { CoaTemplateEditor } from "@/components/admin/CoaTemplateEditor";
import { saveProductCoaTemplate, deleteProductCoaTemplate, previewProductCoaPdf } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProductCoaTemplatePage({ params }: { params: { printId: string } }) {
  const print = await prisma.print.findUnique({ where: { id: params.printId }, select: { id: true, title: true } });
  if (!print) notFound();

  const [override, globalDefault] = await Promise.all([
    getCoaTemplateOverride(print.id),
    getGlobalCoaTemplate(),
  ]);
  const template = override ?? globalDefault;

  return (
    <div className="max-w-4xl">
      <Link href={`/admin/products/${print.id}`} className="label-caps text-stone hover:text-ink">
        ← {print.title}
      </Link>
      <h1 className="font-display text-2xl mt-2 mb-1">Certificate of Authenticity — {print.title}</h1>
      <p className="text-stone text-sm mb-8">
        Customize the certificate printed for this product specifically, or leave it using the shop-wide default
        (Admin &gt; Settings &gt; COA template).
      </p>

      <CoaTemplateEditor
        initial={{ name: template.name, pageSize: template.pageSize, bodyHtml: template.bodyHtml, css: template.css }}
        usingDefault={!override}
        saveAction={saveProductCoaTemplate.bind(null, print.id)}
        previewAction={previewProductCoaPdf.bind(null, print.id)}
        onSwitchToDefault={override ? deleteProductCoaTemplate.bind(null, print.id) : undefined}
      />
    </div>
  );
}
