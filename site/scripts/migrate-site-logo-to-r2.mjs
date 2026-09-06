// One-off migration: the three site logo variants (light, dark, compact —
// confirmed byte-identical) previously lived in app_settings' logo* bytea
// columns. Upload the already-extracted bytes to R2 under the same
// site-branding/logo-<theme> keys the route now reads, so nothing is lost
// when the route stops reading Postgres. Not part of the build; run manually.
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFile } from "node:fs/promises";

const R2_BUCKET = "deepw-media";
const THEMES = ["light", "dark", "compact"];

function client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials are not set in the environment.");
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function main() {
  const sourcePath = process.argv[2];
  const contentType = process.argv[3];
  if (!sourcePath || !contentType) {
    throw new Error("usage: node migrate-site-logo-to-r2.mjs <sourceFile> <contentType>");
  }

  const body = await readFile(sourcePath);
  const s3 = client();

  for (const theme of THEMES) {
    const key = `site-branding/logo-${theme}`;
    await s3.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: body, ContentType: contentType }));
    console.log(`uploaded ${key} (${body.length} bytes)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
