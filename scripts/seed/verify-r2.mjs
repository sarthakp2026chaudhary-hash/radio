/**
 * Verify every tracks.file_key in the DB exists in the R2 bucket.
 *
 *   node scripts/seed/verify-r2.mjs
 *   node scripts/seed/verify-r2.mjs --fix-report   # also list tracks with file_key but missing in R2
 */
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "radio-music";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing R2 or Supabase env vars in .env.local");
  process.exit(1);
}

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function exists(key) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function fetchAllTracksWithKeys() {
  const rows = [];
  let from = 0;
  const page = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("tracks")
      .select("id, title, file_key")
      .not("file_key", "is", null)
      .range(from, from + page - 1);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < page) break;
    from += page;
  }
  return rows;
}

async function main() {
  const tracks = await fetchAllTracksWithKeys();
  console.log(`Checking ${tracks.length} tracks with file_key…`);

  let ok = 0;
  let missing = 0;
  const missingList = [];

  for (const t of tracks) {
    const found = await exists(t.file_key);
    if (found) ok++;
    else {
      missing++;
      missingList.push(t);
    }
  }

  console.log(`OK: ${ok}, missing in R2: ${missing}`);
  if (missingList.length) {
    console.log("\nMissing objects:");
    for (const t of missingList) {
      console.log(`  #${t.id} ${t.title} → ${t.file_key}`);
    }
  }

  process.exit(missing > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
