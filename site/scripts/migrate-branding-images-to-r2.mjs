// One-off migration, run after migrate-site-logo-to-r2.mjs: moves the
// favicon and social share image out of app_settings' bytea columns into R2.
// favicon is byte-identical to the logo (confirmed via md5 before running
// this), so it's a straight R2-to-R2 copy rather than a re-upload.
// appleTouchIcon had no upload at migration time, so there's nothing to move
// for it. Not part of the build; run manually.
import { S3Client, CopyObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFile } from "node:fs/promises";

const R2_BUCKET = "deepw-media";

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
  const socialImagePath = process.argv[2];
  const socialImageContentType = process.argv[3];
  if (!socialImagePath || !socialImageContentType) {
    throw new Error("usage: node migrate-branding-images-to-r2.mjs <socialShareImageFile> <contentType>");
  }

  const s3 = client();

  await s3.send(
    new CopyObjectCommand({
      Bucket: R2_BUCKET,
      CopySource: `${R2_BUCKET}/site-branding/logo-light`,
      Key: "site-branding/favicon",
    })
  );
  console.log("copied site-branding/logo-light -> site-branding/favicon");

  const body = await readFile(socialImagePath);
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: "site-branding/social-share-image",
      Body: body,
      ContentType: socialImageContentType,
    })
  );
  console.log(`uploaded site-branding/social-share-image (${body.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
