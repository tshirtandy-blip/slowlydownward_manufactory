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
        <Link href="/admin/settings/integrations" className="border hairline p-6 hover:border-ink block">
          <h2 className="font-display text-lg mb-1">Integrations</h2>
          <p className="text-sm text-stone">Stripe, UPS, Royal Mail, Mailchimp and Xero connection status.</p>
        </Link>
      </div>
    </div>
  );
}
