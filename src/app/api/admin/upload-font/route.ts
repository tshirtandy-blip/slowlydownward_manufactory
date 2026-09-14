import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
// uploadImage is content-agnostic despite the name (see src/lib/supabase-admin.ts) —
// it just puts bytes in the same public "site-images" bucket used for
// product photos and the logo, and hands back a public URL. No separate
// bucket needed for fonts.
import { uploadImage } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB — plenty for a single web font file

// Browsers are inconsistent about what MIME type they report for font
// files (often just "application/octet-stream"), so the file's own
// extension is the more reliable signal — this also gives us the exact
// "format()" hint the CSS @font-face rule needs.
function formatFromFilename(name: string): string | null {
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "woff2") return "woff2";
  if (ext === "woff") return "woff";
  if (ext === "ttf") return "truetype";
  if (ext === "otf") return "opentype";
  return null;
}

function safeFilename(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/-+/g, "-");
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file received." }, { status: 400 });
  }

  const format = formatFromFilename(file.name);
  if (!format) {
    return NextResponse.json(
      { error: "Please upload a .woff2, .woff, .ttf, or .otf font file." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That file is larger than 8MB." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadImage(buffer, safeFilename(file.name), file.type || "application/octet-stream");
    return NextResponse.json({ url, format });
  } catch (err) {
    console.error("Font upload failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed — please try again." },
      { status: 500 }
    );
  }
}
