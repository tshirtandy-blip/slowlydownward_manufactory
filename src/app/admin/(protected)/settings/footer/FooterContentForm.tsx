"use client";

import { updateFooterContent } from "./actions";
import type { FooterSettings } from "@/components/storefront/SiteFooter";
import { SaveButton } from "@/components/admin/SaveButton";

const inputClass = "border hairline bg-transparent px-3 py-2 text-sm w-full";
const textareaClass = inputClass + " min-h-[6rem]";

export function FooterContentForm({ settings }: { settings: FooterSettings }) {
  return (
    <form action={updateFooterContent} className="space-y-8 max-w-xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="border hairline p-4">
          <label className="label-caps block mb-2">Column 1 heading</label>
          <input name="footerColumn1Heading" defaultValue={settings.footerColumn1Heading} className={inputClass + " mb-3"} />
          <label className="label-caps block mb-2">Column 1 text</label>
          <textarea name="footerColumn1Body" defaultValue={settings.footerColumn1Body} className={textareaClass} />
        </div>
        <div className="border hairline p-4">
          <label className="label-caps block mb-2">Column 2 heading</label>
          <input name="footerColumn2Heading" defaultValue={settings.footerColumn2Heading} className={inputClass + " mb-3"} />
          <label className="label-caps block mb-2">Column 2 text</label>
          <textarea name="footerColumn2Body" defaultValue={settings.footerColumn2Body} className={textareaClass} />
          <p className="text-xs text-stone mt-2">
            The email signup form below this text isn't wired up to a mailing list yet — it's a placeholder.
          </p>
        </div>
      </div>

      <div>
        <label className="label-caps block mb-2">Links column heading</label>
        <input name="footerLinksHeading" defaultValue={settings.footerLinksHeading} className={inputClass + " max-w-xs"} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="label-caps block mb-2">Copyright name</label>
          <input name="footerCopyrightName" defaultValue={settings.footerCopyrightName} className={inputClass} />
          <p className="text-xs text-stone mt-1">Shown as "© {new Date().getFullYear()} [this name]" bottom-left.</p>
        </div>
        <div>
          <label className="label-caps block mb-2">Bottom-right badge text</label>
          <input name="footerBadgeText" defaultValue={settings.footerBadgeText} className={inputClass} />
        </div>
      </div>

      <SaveButton>Save footer text</SaveButton>
    </form>
  );
}
