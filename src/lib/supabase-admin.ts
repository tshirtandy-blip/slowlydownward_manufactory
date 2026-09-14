import { createClient } from "@supabase/supabase-js";

// All uploaded images (from the admin block editor) go into this one public
// bucket. Create it once from the Supabase dashboard: Storage > New bucket >
// name it exactly "site-images" > toggle it Public.
const BUCKET = "site-images";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Image uploads aren't set up yet — add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your .env file (see README > Image uploads)."
    );
  }
  // The service role key bypasses Storage's access rules, which is exactly
  // what a trusted server-side upload needs — it must never be exposed to
  // the browser (hence it isn't prefixed NEXT_PUBLIC_).
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function uploadImage(buffer: Buffer, filename: string, contentType: string): Promise<string> {
  const supabase = getClient();
  const path = `${Date.now()}-${filename}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType,
    upsert: false,
  });

  if (error) {
    if (/bucket not found/i.test(error.message)) {
      throw new Error(`No "${BUCKET}" storage bucket found — create one in Supabase (see README > Image uploads).`);
    }
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
