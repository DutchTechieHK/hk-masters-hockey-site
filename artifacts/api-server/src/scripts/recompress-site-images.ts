/**
 * One-off: recompress oversized site-content images already in object storage.
 *
 * Downloads each /objects/uploads/<id> image referenced by site content,
 * re-encodes it with the same rules as new uploads (max 2000px, JPEG q80
 * mozjpeg, or WebP q80 if the source has alpha), and re-uploads it to the
 * SAME object path so no DB references need updating. Skips animated GIFs
 * and any image that is already small enough (no dimension > 2000px and
 * re-encode would not save at least 10%).
 *
 * Usage: pnpm --filter @workspace/api-server exec tsx src/scripts/recompress-site-images.ts <objectPath...>
 *   e.g. tsx src/scripts/recompress-site-images.ts /objects/uploads/abc-123
 */
import sharp from "sharp";

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

async function recompress(objectPath: string): Promise<void> {
  // objectPath: /objects/uploads/<id> → real object at PRIVATE_OBJECT_DIR/uploads/<id>
  const entityId = objectPath.replace(/^\/objects\//, "");
  const fullPath = `${getPrivateObjectDir()}/${entityId}`;
  const { bucketName, objectName } = parseObjectPath(fullPath);

  const getUrl = await signUrl(bucketName, objectName, "GET");
  const dl = await fetch(getUrl);
  if (!dl.ok) throw new Error(`Download failed (${dl.status}) for ${objectPath}`);
  const original = Buffer.from(await dl.arrayBuffer());

  const meta = await sharp(original, { limitInputPixels: false }).metadata();
  if (meta.format === "gif" && (meta.pages ?? 1) > 1) {
    console.log(`SKIP ${objectPath}: animated GIF`);
    return;
  }

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

  const oversizedDims = (meta.width ?? 0) > 2000 || (meta.height ?? 0) > 2000;
  const savings = 1 - recompressed.length / original.length;
  if (!oversizedDims && savings < 0.1) {
    console.log(
      `SKIP ${objectPath}: already optimized (${(original.length / 1024).toFixed(0)} KB, ` +
      `${meta.width}x${meta.height}, would save ${(savings * 100).toFixed(1)}%)`
    );
    return;
  }

  const putUrl = await signUrl(bucketName, objectName, "PUT");
  const up = await fetch(putUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType, "Content-Length": String(recompressed.length) },
    body: recompressed,
  });
  if (!up.ok) throw new Error(`Upload failed (${up.status}) for ${objectPath}`);

  console.log(
    `OK   ${objectPath}: ${(original.length / 1024).toFixed(0)} KB → ` +
    `${(recompressed.length / 1024).toFixed(0)} KB (${(savings * 100).toFixed(1)}% smaller, ` +
    `${meta.width}x${meta.height} → max 2000px, ${contentType})`
  );
}

async function main() {
  const paths = process.argv.slice(2);
  if (paths.length === 0) {
    console.error("Usage: tsx src/scripts/recompress-site-images.ts /objects/uploads/<id> ...");
    process.exit(1);
  }
  let failed = 0;
  for (const p of paths) {
    try {
      await recompress(p);
    } catch (err) {
      failed++;
      console.error(`FAIL ${p}:`, err instanceof Error ? err.message : err);
    }
  }
  if (failed > 0) process.exit(1);
}

main();
