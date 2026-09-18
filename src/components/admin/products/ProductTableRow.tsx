"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import { togglePublished } from "@/app/admin/(protected)/products/actions";

export function ProductTableRow({
  id,
  title,
  imageUrl,
  price,
  stock,
  published,
}: {
  id: string;
  title: string;
  imageUrl: string | null;
  price: string;
  stock: string;
  published: boolean;
}) {
  return (
    <TableRow>
      <TableCell className="w-20">
        <Link href={`/admin/products/${id}`} className="block h-14 w-14 overflow-hidden border border-line bg-white">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[10px] text-stone">No image</span>
          )}
        </Link>
      </TableCell>
      <TableCell className="font-medium">
        <Link href={`/admin/products/${id}`} className="hover:underline">
          {title}
        </Link>
      </TableCell>
      <TableCell>{price}</TableCell>
      <TableCell>{stock}</TableCell>
      <TableCell>
        <Badge variant="outline">{published ? "Published" : "Draft"}</Badge>
      </TableCell>
      <TableCell className="w-12">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-haspopup="true" size="icon" variant="ghost">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/admin/products/${id}`}>Edit</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <form action={togglePublished.bind(null, id, !published)} className="w-full">
                <button type="submit" className="w-full text-left">
                  {published ? "Unpublish" : "Publish"}
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
