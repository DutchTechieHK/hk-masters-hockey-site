/**
 * Unit tests for objectStorage helpers: extractUploadObjectId and
 * tryDeleteUploadObject.
 *
 * These tests do NOT touch the real GCS sidecar — tryDeleteUploadObject is
 * exercised via a mocked fetch so we can verify behaviour without network calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { extractUploadObjectId, tryDeleteUploadObject } from "./objectStorage";

// ── extractUploadObjectId ────────────────────────────────────────────────────

describe("extractUploadObjectId", () => {
  const uuid = "550e8400-e29b-41d4-a716-446655440000";

  it("handles null", () => expect(extractUploadObjectId(null)).toBeNull());
  it("handles undefined", () => expect(extractUploadObjectId(undefined)).toBeNull());
  it("handles empty string", () => expect(extractUploadObjectId("")).toBeNull());

  it("extracts from events serve-image URL", () => {
    expect(extractUploadObjectId(`/api/events/serve-image/${uuid}`)).toBe(uuid);
  });

  it("extracts from news serve-image URL", () => {
    expect(extractUploadObjectId(`/api/news/serve-image/${uuid}`)).toBe(uuid);
  });

  it("extracts from sponsors image/objects/uploads URL", () => {
    expect(extractUploadObjectId(`/api/sponsors/image/objects/uploads/${uuid}`)).toBe(uuid);
  });

  it("extracts from auction image/objects/uploads URL", () => {
    expect(extractUploadObjectId(`/api/auction/image/objects/uploads/${uuid}`)).toBe(uuid);
  });

  it("extracts from raw /objects/uploads/ logical path", () => {
    expect(extractUploadObjectId(`/objects/uploads/${uuid}`)).toBe(uuid);
  });

  it("extracts from absolute URL with uploads segment", () => {
    expect(
      extractUploadObjectId(`https://host.example.com/api/site-content/image/objects/uploads/${uuid}`),
    ).toBe(uuid);
  });

  it("returns null for an external URL with no uploads segment", () => {
    expect(extractUploadObjectId("https://cdn.example.com/logo.png")).toBeNull();
  });

  it("returns null for a plain relative path with no uploads segment", () => {
    expect(extractUploadObjectId("/static/images/logo.png")).toBeNull();
  });

  it("returns null for a URL ending in /uploads/ with no UUID", () => {
    expect(extractUploadObjectId("/objects/uploads/")).toBeNull();
  });
});

// ── tryDeleteUploadObject ────────────────────────────────────────────────────

describe("tryDeleteUploadObject", () => {
  const uuid = "550e8400-e29b-41d4-a716-446655440000";
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  // Provide a minimal PRIVATE_OBJECT_DIR so the function can build the GCS path.
  const originalEnv = process.env.PRIVATE_OBJECT_DIR;
  beforeEach(() => {
    process.env.PRIVATE_OBJECT_DIR = "/test-bucket/prefix";
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => {
    process.env.PRIVATE_OBJECT_DIR = originalEnv;
    vi.restoreAllMocks();
  });

  it("is a no-op for null", async () => {
    await expect(tryDeleteUploadObject(null)).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("is a no-op for undefined", async () => {
    await expect(tryDeleteUploadObject(undefined)).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("is a no-op for an invalid objectId (path traversal attempt)", async () => {
    await expect(tryDeleteUploadObject("../../etc/passwd")).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("is a no-op for an objectId containing slashes", async () => {
    await expect(tryDeleteUploadObject("abc/def")).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("calls the sidecar to get a signed DELETE URL then issues DELETE to GCS", async () => {
    const signedUrl = "https://storage.googleapis.com/bucket/obj?sig=xxx";
    // First fetch: sidecar sign request → returns signed URL
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ signed_url: signedUrl }), { status: 200 }),
    );
    // Second fetch: GCS DELETE → 204 No Content
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(tryDeleteUploadObject(uuid)).resolves.toBeUndefined();

    // Verify sidecar call
    const [sidecarUrl, sidecarOpts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(sidecarUrl).toContain("signed-object-url");
    const body = JSON.parse(sidecarOpts.body as string);
    expect(body.method).toBe("DELETE");
    expect(body.object_name).toContain(uuid);

    // Verify GCS DELETE
    const [gcsUrl, gcsOpts] = fetchSpy.mock.calls[1] as [string, RequestInit];
    expect(gcsUrl).toBe(signedUrl);
    expect(gcsOpts.method).toBe("DELETE");
  });

  it("does not throw when the sidecar call fails (logs instead)", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("sidecar down"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(tryDeleteUploadObject(uuid)).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(uuid), expect.any(Error));
  });

  it("does not throw when GCS returns a non-404 error (logs warning instead)", async () => {
    const signedUrl = "https://storage.googleapis.com/bucket/obj?sig=xxx";
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ signed_url: signedUrl }), { status: 200 }),
    );
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 500 }));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(tryDeleteUploadObject(uuid)).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("500"));
  });

  it("treats GCS 404 as success (no warning logged)", async () => {
    const signedUrl = "https://storage.googleapis.com/bucket/obj?sig=xxx";
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ signed_url: signedUrl }), { status: 200 }),
    );
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 404 }));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(tryDeleteUploadObject(uuid)).resolves.toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
