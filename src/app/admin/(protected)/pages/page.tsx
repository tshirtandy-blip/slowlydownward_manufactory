import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { parseBlocks } from "@/lib/blocks";
import { createPage } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function PagesListPage() {
  const pages = await prisma.page.findMany({ orderBy: [{ slug: "asc" }] });
  const home = pages.find((p) => p.slug === "home");
  const others = pages.filter((p) => p.slug !== "home");

  return (
    <div>
      <h1 className="font-display text-2xl mb-2">Pages</h1>
      <p className="text-sm text-stone mb-8 max-w-lg">
        Build and edit the storefront&apos;s pages here — no code required. Add, remove, and drag blocks to
        reorder them, then hit Save changes.
      </p>

      <div className="mb-10 max-w-lg">
        <h2 className="label-caps mb-3">Home page</h2>
        {home ? (
          <Link href={`/admin/pages/${home.id}`} className="block">
            <Card className="border-line shadow-none transition-colors hover:border-ink">
              <CardContent className="flex items-center justify-between p-4">
                <span>Home</span>
                <span className="label-caps text-stone">{parseBlocks(home.blocks).length} blocks</span>
              </CardContent>
            </Card>
          </Link>
        ) : (
          <p className="text-sm text-stone">
            No home page record yet — run <code>npm run seed</code> to create one, or add a page below with the
            address <code>home</code>.
          </p>
        )}
      </div>

      <div className="mb-10 max-w-lg">
        <div className="flex items-center justify-between mb-3">
          <h2 className="label-caps">Other pages</h2>
          <Link href="/admin/pages/products" className="text-xs label-caps text-stone hover:text-ink">
            Edit product page content →
          </Link>
        </div>

        {others.length === 0 ? (
          <p className="text-sm text-stone mb-6">No other pages yet — create your first one below.</p>
        ) : (
          <Card className="mb-6 border-line shadow-none">
            <CardContent className="p-0">
              <Table>
                <TableBody>
                  {others.map((page) => (
                    <TableRow key={page.id}>
                      <TableCell>
                        <Link href={`/admin/pages/${page.id}`} className="hover:underline">
                          {page.title} <span className="text-sm text-stone">/{page.slug}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{page.status === "PUBLISHED" ? "Published" : "Draft"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Card className="border-line shadow-none">
          <CardHeader>
            <CardTitle className="font-display text-lg font-normal">New page</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createPage} className="space-y-4">
              <div>
                <label className="label-caps mb-2 block">Title</label>
                <Input name="title" required className="border-line" />
              </div>
              <div>
                <label className="label-caps mb-2 block">Address (optional — e.g. about, faq)</label>
                <Input name="slug" placeholder="leave blank to use the title" className="border-line" />
              </div>
              <Button type="submit">Create page</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
