"use client";

import { updateFooterContent } from "./actions";
import type { FooterSettings } from "@/components/storefront/SiteFooter";
import { SaveButton } from "@/components/admin/SaveButton";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function FooterContentForm({ settings }: { settings: FooterSettings }) {
  return (
    <form action={updateFooterContent} className="max-w-xl space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Card className="border-line shadow-none">
          <CardContent className="space-y-3 p-4">
            <div>
              <Label htmlFor="footerColumn1Heading" className="label-caps mb-2 block">
                Column 1 heading
              </Label>
              <Input id="footerColumn1Heading" name="footerColumn1Heading" defaultValue={settings.footerColumn1Heading} className="border-line" />
            </div>
            <div>
              <Label htmlFor="footerColumn1Body" className="label-caps mb-2 block">
                Column 1 text
              </Label>
              <Textarea id="footerColumn1Body" name="footerColumn1Body" defaultValue={settings.footerColumn1Body} className="min-h-[6rem] border-line" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-line shadow-none">
          <CardContent className="space-y-3 p-4">
            <div>
              <Label htmlFor="footerColumn2Heading" className="label-caps mb-2 block">
                Column 2 heading
              </Label>
              <Input id="footerColumn2Heading" name="footerColumn2Heading" defaultValue={settings.footerColumn2Heading} className="border-line" />
            </div>
            <div>
              <Label htmlFor="footerColumn2Body" className="label-caps mb-2 block">
                Column 2 text
              </Label>
              <Textarea id="footerColumn2Body" name="footerColumn2Body" defaultValue={settings.footerColumn2Body} className="min-h-[6rem] border-line" />
              <p className="mt-2 text-xs text-stone">
                The email signup form below this text adds people to your Mailchimp audience (Admin &gt; Settings
                &gt; Integrations) and marks them as marketing opt-in.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <Label htmlFor="footerLinksHeading" className="label-caps mb-2 block">
          Links column heading
        </Label>
        <Input id="footerLinksHeading" name="footerLinksHeading" defaultValue={settings.footerLinksHeading} className="max-w-xs border-line" />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <Label htmlFor="footerCopyrightName" className="label-caps mb-2 block">
            Copyright name
          </Label>
          <Input id="footerCopyrightName" name="footerCopyrightName" defaultValue={settings.footerCopyrightName} className="border-line" />
          <p className="mt-1 text-xs text-stone">Shown as "© {new Date().getFullYear()} [this name]" bottom-left.</p>
        </div>
        <div>
          <Label htmlFor="footerBadgeText" className="label-caps mb-2 block">
            Bottom-right badge text
          </Label>
          <Input id="footerBadgeText" name="footerBadgeText" defaultValue={settings.footerBadgeText} className="border-line" />
        </div>
      </div>

      <SaveButton>Save footer text</SaveButton>
    </form>
  );
}
