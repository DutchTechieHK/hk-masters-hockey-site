/**
 * One-off: migrate external (Cloudinary) gallery photos into object storage.
 *
 * Downloads each URL passed on argv, recompresses it with the same rules as
 * regular uploads (max 2000px, JPEG q80 mozjpeg, or WebP q80 if alpha), and
 * uploads it to PRIVATE_OBJECT_DIR/uploads/<uuid>. Prints a JSON mapping of
 * source URL → /api/site-content/image/objects/uploads/<uuid> on the last line.
 *
 * Usage: pnpm --filter @workspace/api-server exec tsx src/scripts/migrate-gallery-photos.ts <url...>
 */
import sharp from "sharp";
import { randomUUID } from "crypto";

const SIDECAR = "http://127.0.0.1:1106";

function getPrivateObjectDir(): string {
  const dir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!dir) throw new Error("PRIVATE_OBJECT_DIR not set");
  return dir.endsWith("/") ? dir.slice(0, -1) : dir;
}

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) path = `/${path}`;
  const parts = path.split("/");
  if (parts.length < 3) throw new Error(`Invalid object path: ${path}`);
  return { bucketName: parts[1], objectName: parts.slice(2).join("/") };
}

async function signUrl(bucketName: string, objectName: string, method: "GET" | "PUT"): Promise<string> {
  const res = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method,
      expires_at: new Date(Date.now() + 900_000).toISOString(),
    }),
  });
  if (!res.ok) throw new Error(`Failed to sign URL: ${res.status}`);
  const { signed_url } = await res.json();
  return signed_url;
}

async function migrate(sourceUrl: string): Promise<string> {
  const dl = await fetch(sourceUrl);
  if (!dl.ok) throw new Error(`Download failed (${dl.status}) for ${sourceUrl}`);
  const original = Buffer.from(await dl.arrayBuffer());

  const meta = await sharp(original, { limitInputPixels: false }).metadata();
  const pipeline = sharp(original, { limitInputPixels: false })
    .rotate()
    .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true });
  let recompressed: Buffer;
  let contentType: string;
  if (meta.hasAlpha) {
    recompressed = await pipeline.webp({ quality: 80 }).toBuffer();
    contentType = "image/webp";
  } else {
    recompressed = await pipeline.jpeg({ quality: 80, mozjpeg: true }).toBuffer();
    contentType = "image/jpeg";
  }

  const objectId = randomUUID();
  const fullPath = `${getPrivateObjectDir()}/uploads/${objectId}`;
  const { bucketName, objectName } = parseObjectPath(fullPath);
  const putUrl = await signUrl(bucketName, objectName, "PUT");
  const up = await fetch(putUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType, "Content-Length": String(recompressed.length) },
    body: recompressed,
  });
  if (!up.ok) throw new Error(`Upload failed (${up.status}) for ${sourceUrl}`);

  console.error(
    `OK ${sourceUrl}\n   → /objects/uploads/${objectId} ` +
    `(${(original.length / 1024).toFixed(0)} KB → ${(recompressed.length / 1024).toFixed(0)} KB, ` +
    `${meta.width}x${meta.height} → max 2000px, ${contentType})`
  );
  return `/api/site-content/image/objects/uploads/${objectId}`;
}

async function main() {
  const urls = process.argv.slice(2);
  if (urls.length === 0) {
    console.error("Usage: tsx src/scripts/migrate-gallery-photos.ts <url...>");
    process.exit(1);
  }
  const mapping: Record<string, string> = {};
  let failed = 0;
  for (const url of urls) {
    try {
      mapping[url] = await migrate(url);
    } catch (err) {
      failed++;
      console.error(`FAIL ${url}:`, err instanceof Error ? err.message : err);
    }
  }
  console.log(JSON.stringify(mapping));
  if (failed > 0) process.exit(1);
}

main();
