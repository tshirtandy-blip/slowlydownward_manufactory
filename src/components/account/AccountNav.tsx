import Link from "next/link";

const TABS = [
  { href: "/account", label: "My Collection" },
  { href: "/account/orders", label: "Order History" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/settings", label: "Settings" },
] as const;

export function AccountNav({ active }: { active: (typeof TABS)[number]["href"] }) {
  return (
    <nav className="flex flex-wrap gap-6 border-b hairline mb-10 pb-4">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={
            tab.href === active
              ? "label-caps text-ink border-b border-ink pb-1"
              : "label-caps text-stone hover:text-ink"
          }
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
