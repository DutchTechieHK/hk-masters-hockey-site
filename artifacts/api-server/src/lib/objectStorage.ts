import { Storage } from "@google-cloud/storage";
import { randomUUID } from "crypto";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  private getPrivateObjectDir(): string {
    return getPrivateObjectDir();
  }

  async uploadObjectEntity(buffer: Buffer, contentType: string): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);

    const signedUrl = await signObjectURL({ bucketName, objectName, method: "PUT", ttlSec: 900 });

    const response = await fetch(signedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.length.toString(),
      },
      body: buffer,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`GCS upload failed: ${response.status} ${errText}`);
    }

    return `/objects/uploads/${objectId}`;
  }

  async getObjectEntityDownloadURL(objectPath: string): Promise<string> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }

    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const objectFile = objectStorageClient.bucket(bucketName).file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }

    return signObjectURL({ bucketName, objectName, method: "GET", ttlSec: 300 });
  }
}

// ── Shared upload-object helpers ─────────────────────────────────────────────

/**
 * Extract the upload UUID from any URL format this app stores:
 *   /api/events/serve-image/<uuid>
 *   /api/news/serve-image/<uuid>
 *   /api/sponsors/image/objects/uploads/<uuid>
 *   /api/auction/image/objects/uploads/<uuid>
 *   /objects/uploads/<uuid>          (raw logical path)
 *   https://host/api/.../uploads/<uuid>
 *
 * Returns null for null/undefined, empty strings, external URLs that don't
 * contain the uploads segment, or anything that doesn't match.
 */
export function extractUploadObjectId(url: string | null | undefined): string | null {
  if (!url) return null;

  // serve-image/<uuid> pattern (events, news)
  const serveMatch = url.match(/\/serve-image\/([\w-]+)\/?$/);
  if (serveMatch) return serveMatch[1];

  // uploads/<uuid> pattern (sponsors, auction, site-content, raw logical path)
  const uploadsMatch = url.match(/\/uploads\/([\w-]+)\/?$/);
  if (uploadsMatch) return uploadsMatch[1];

  return null;
}

/**
 * Best-effort delete of a GCS upload object identified by its UUID.
 * Never throws. Treats 404 as success (already gone). Logs unexpected failures.
 * Dev and prod share one bucket — only call this with an objectId you own
 * (read from the DB row before mutating it).
 */
export async function tryDeleteUploadObject(objectId: string | null | undefined): Promise<void> {
  if (!objectId) return;
  if (!/^[\w-]+$/.test(objectId)) {
    console.warn(`[objectStorage] tryDeleteUploadObject: invalid objectId "${objectId}", skipping`);
    return;
  }
  try {
    const privateObjectDir = getPrivateObjectDir();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    const signedUrl = await signObjectURL({ bucketName, objectName, method: "DELETE", ttlSec: 60 });
    const res = await fetch(signedUrl, { method: "DELETE", signal: AbortSignal.timeout(10_000) });
    if (!res.ok && res.status !== 404) {
      console.warn(`[objectStorage] tryDeleteUploadObject(${objectId}): GCS returned ${res.status} — orphan may remain`);
    }
  } catch (err) {
    console.error(`[objectStorage] tryDeleteUploadObject(${objectId}) failed — orphan may remain:`, err);
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function getPrivateObjectDir(): string {
  const dir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!dir) {
    throw new Error("PRIVATE_OBJECT_DIR not set");
  }
  return dir;
}

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid object path: must contain at least a bucket name");
  }
  return {
    bucketName: pathParts[1],
    objectName: pathParts.slice(2).join("/"),
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const response = await fetch(`${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method,
      expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to sign object URL: ${response.status}`);
  }

  const body = await response.json() as { signed_url: string };
  return body.signed_url;
}
