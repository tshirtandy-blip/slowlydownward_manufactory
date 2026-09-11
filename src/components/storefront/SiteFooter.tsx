export function SiteFooter() {
  return (
    <footer id="archive" className="border-t hairline mt-24">
      <div className="mx-auto max-w-6xl px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-12">
        <div>
          <h3 className="label-caps mb-4">The Archive</h3>
          <p className="text-sm text-stone max-w-xs">
            Limited edition prints by Stanley Donwood. Each work is numbered,
            catalogued, and released in strictly limited quantities. Once an
            edition is gone, it is gone.
          </p>
        </div>
        <div>
          <h3 className="label-caps mb-4">Excuse Me</h3>
          <p className="text-sm text-stone mb-4">
            Sign up to hear about new releases before they go public.
          </p>
          <form className="flex gap-2">
            <input
              type="email"
              placeholder="Email address"
              className="flex-1 border hairline bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-ink"
            />
            <button type="submit" className="btn-secondary !px-4 !py-2">
              Join
            </button>
          </form>
        </div>
        <div>
          <h3 className="label-caps mb-4">Information</h3>
          <ul className="text-sm text-stone space-y-2">
            <li>Shipping &amp; returns</li>
            <li>Authenticity &amp; care</li>
            <li>Contact</li>
          </ul>
        </div>
      </div>
      <div className="border-t hairline">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-stone flex justify-between">
          <span>&copy; {new Date().getFullYear()} Slowly Downward</span>
          <span>Stripe secure checkout</span>
        </div>
      </div>
    </footer>
  );
}
