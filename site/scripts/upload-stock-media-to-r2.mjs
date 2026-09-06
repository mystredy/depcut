// One-off migration: upload public/cut-stock-video and public/cut-stock-music
// to R2 under stock-assets/, so they can be deleted from the repo and served
// through /api/stock-media instead. Not part of the build; run manually.
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const R2_BUCKET = "deepw-media";
const DIRS = ["cut-stock-video", "cut-stock-music"];

const MIME_BY_EXT = {
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".webp": "image/webp",
};

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

async function exists(s3, key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const s3 = client();
  const root = path.join(import.meta.dirname, "..", "public");
  let uploaded = 0;
  let skipped = 0;

  for (const dir of DIRS) {
    const dirPath = path.join(root, dir);
    const files = await readdir(dirPath);
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      const mime = MIME_BY_EXT[ext];
      if (!mime) {
        console.warn(`skip (unknown extension): ${dir}/${file}`);
        continue;
      }
      const key = `stock-assets/${dir}/${file}`;
      if (await exists(s3, key)) {
        skipped++;
        continue;
      }
      const body = await readFile(path.join(dirPath, file));
      await s3.send(
        new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: body, ContentType: mime })
      );
      uploaded++;
      if (uploaded % 25 === 0) console.log(`uploaded ${uploaded}...`);
    }
  }

  console.log(`done: ${uploaded} uploaded, ${skipped} already present`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
