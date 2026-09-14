// Plain helper module — deliberately NOT marked as a server actions file,
// because that would require every export to be an async function, and a
// page's URL slug needs to be computed synchronously in a few places (form
// validation, etc). Shared by the Pages admin screens and the Footer
// settings screen (its "add a new page" flow), so the reserved-slug list
// only needs to be maintained in one place.

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Anything that would collide with an existing top-level route.
export const RESERVED_SLUGS = new Set(["home", "admin", "cart", "checkout", "prints", "api", ""]);
