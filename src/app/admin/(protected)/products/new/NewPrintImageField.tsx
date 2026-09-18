"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { ImageDropzone } from "@/components/admin/ImageDropzone";

/** The "Add a new product" form's image field — same drag-and-drop
 * ImageDropzone used everywhere else in the admin (product edit page,
 * block editor, header logo, etc.), just wired to a plain hidden input
 * so it still submits through the page's regular <form action={createPrint}>
 * as `imageUrl`, exactly like the old plain URL box did. */
export function NewPrintImageField() {
  const [imageUrl, setImageUrl] = useState("");

  return (
    <div>
      <Label className="label-caps mb-2 block">Image</Label>
      <ImageDropzone value={imageUrl} onChange={setImageUrl} />
      <input type="hidden" name="imageUrl" value={imageUrl} />
    </div>
  );
}
