import Link from "next/link";

export default function SettingsPage() {
  return (
    <div>
      <h1 className="font-display text-2xl mb-8">Settings</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-xl">
        <Link href="/admin/settings/users" className="border hairline p-6 hover:border-ink block">
          <h2 className="font-display text-lg mb-1">Staff &amp; access</h2>
          <p className="text-sm text-stone">Add staff accounts and set who's admin, sales, stock, or packer.</p>
        </Link>
        <Link href="/admin/settings/header" className="border hairline p-6 hover:border-ink block">
          <h2 className="font-display text-lg mb-1">Header &amp; branding</h2>
          <p className="text-sm text-stone">Your logo, its position, and which icons show in the site header.</p>
        </Link>
        <Link href="/admin/settings/mediums" className="border hairline p-6 hover:border-ink block">
          <h2 className="font-display text-lg mb-1">Product mediums</h2>
          <p className="text-sm text-stone">The list of options offered in each product's "Medium" dropdown.</p>
        </Link>
        <Link href="/admin/settings/typography" className="border hairline p-6 hover:border-ink block">
          <h2 className="font-display text-lg mb-1">Typography</h2>
          <p className="text-sm text-stone">The typefaces used for headings/print titles and body text.</p>
        </Link>
        <Link href="/admin/settings/shipping" className="border hairline p-6 hover:border-ink block">
          <h2 className="font-display text-lg mb-1">Shipping</h2>
          <p className="text-sm text-stone">Shipping prices for the UK, Europe, and rest of world, and which countries are in each.</p>
        </Link>
        <Link href="/admin/settings/footer" className="border hairline p-6 hover:border-ink block">
          <h2 className="font-display text-lg mb-1">Footer</h2>
          <p className="text-sm text-stone">The text at the bottom of every page, and the pages linked from it.</p>
        </Link>
        <Link href="/admin/settings/editions" className="border hairline p-6 hover:border-ink block">
          <h2 className="font-display text-lg mb-1">Editions</h2>
          <p className="text-sm text-stone">How long a chosen edition number is held for a customer, and the note shown by the picker.</p>
        </Link>
        <Link href="/admin/settings/integrations" className="border hairline p-6 hover:border-ink block">
          <h2 className="font-display text-lg mb-1">Integrations</h2>
          <p className="text-sm text-stone">Stripe, UPS, Royal Mail, Mailchimp and Xero connection status.</p>
        </Link>
        <Link href="/admin/settings/emails" className="border hairline p-6 hover:border-ink block">
          <h2 className="font-display text-lg mb-1">Emails</h2>
          <p className="text-sm text-stone">Edit the wording of the payment link, order confirmation, and welcome emails.</p>
        </Link>
        <Link href="/admin/settings/import" className="border hairline p-6 hover:border-ink block">
          <h2 className="font-display text-lg mb-1">Import data</h2>
          <p className="text-sm text-stone">Bring in clients, historical purchases, or a batch of products from a CSV.</p>
        </Link>
      </div>
    </div>
  );
}
