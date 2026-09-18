import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SETTINGS_SECTIONS = [
  {
    href: "/admin/settings/users",
    title: "Staff & access",
    description: "Add staff accounts and set who's admin, sales, stock, or packer.",
  },
  {
    href: "/admin/settings/header",
    title: "Header & branding",
    description: "Your logo, its position, and which icons show in the site header.",
  },
  {
    href: "/admin/settings/mediums",
    title: "Product mediums",
    description: 'The list of options offered in each product\'s "Medium" dropdown.',
  },
  {
    href: "/admin/settings/typography",
    title: "Typography",
    description: "The typefaces used for headings/print titles and body text.",
  },
  {
    href: "/admin/settings/shipping",
    title: "Shipping",
    description: "Shipping prices for the UK, Europe, and rest of world, and which countries are in each.",
  },
  {
    href: "/admin/settings/footer",
    title: "Footer",
    description: "The text at the bottom of every page, and the pages linked from it.",
  },
  {
    href: "/admin/settings/editions",
    title: "Editions",
    description: "How long a chosen edition number is held for a customer, and the note shown by the picker.",
  },
  {
    href: "/admin/settings/integrations",
    title: "Integrations",
    description: "Stripe, UPS, Royal Mail, Mailchimp and Xero connection status.",
  },
  {
    href: "/admin/settings/emails",
    title: "Emails",
    description: "Edit the wording of the payment link, order confirmation, and welcome emails.",
  },
  {
    href: "/admin/settings/legal",
    title: "Legal & popup",
    description: "The cookie/sign-up popup shown to first-time visitors, and the right-to-cancel window shown on orders.",
  },
  {
    href: "/admin/settings/import",
    title: "Import data",
    description: "Bring in clients, historical purchases, or a batch of products from a CSV.",
  },
];

export default function SettingsPage() {
  return (
    <div>
      <h1 className="font-display text-2xl mb-8">Settings</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {SETTINGS_SECTIONS.map((section) => (
          <Link key={section.href} href={section.href} className="block">
            <Card className="h-full border-line shadow-none transition-colors hover:border-ink">
              <CardHeader>
                <CardTitle className="font-display text-lg font-normal">{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
