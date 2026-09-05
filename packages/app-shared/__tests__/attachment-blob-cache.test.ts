import { beforeEach, describe, expect, it, vi } from "vitest";

const downloadAttachmentBlob = vi.fn();

vi.mock("@platform/api-client", () => ({
  downloadAttachmentBlob: (...args: unknown[]) => downloadAttachmentBlob(...args),
}));

const { downloadAttachmentBlobOnce, clearAttachmentBlobCache, forgetAttachmentBlob } =
  await import("../src/app-data/attachment-blob-cache");

const config = { baseUrl: "http://test", token: "t" };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("downloadAttachmentBlobOnce", () => {
  beforeEach(() => {
    downloadAttachmentBlob.mockReset();
    clearAttachmentBlobCache();
  });

  it("shares one in-flight download between concurrent callers", async () => {
    const pending = deferred<{ ok: true; data: Blob }>();
    downloadAttachmentBlob.mockReturnValue(pending.promise);

    const a = downloadAttachmentBlobOnce(config, "id-1");
    const b = downloadAttachmentBlobOnce(config, "id-1");
    expect(downloadAttachmentBlob).toHaveBeenCalledTimes(1);

    const blob = new Blob(["x"]);
    pending.resolve({ ok: true, data: blob });
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra).toBe(rb);
    expect(ra.ok && ra.data).toBe(blob);
  });

  it("serves a settled success from cache without a second request", async () => {
    downloadAttachmentBlob.mockResolvedValue({ ok: true, data: new Blob(["x"]) });

    await downloadAttachmentBlobOnce(config, "id-2");
    await downloadAttachmentBlobOnce(config, "id-2");
    await downloadAttachmentBlobOnce(config, " id-2 ");

    expect(downloadAttachmentBlob).toHaveBeenCalledTimes(1);
  });

  it("keeps distinct ids apart", async () => {
    downloadAttachmentBlob.mockResolvedValue({ ok: true, data: new Blob(["x"]) });

    await downloadAttachmentBlobOnce(config, "id-3");
    await downloadAttachmentBlobOnce(config, "id-4");

    expect(downloadAttachmentBlob).toHaveBeenCalledTimes(2);
  });

  it("does not retain failures, so a retry hits the network", async () => {
    downloadAttachmentBlob
      .mockResolvedValueOnce({ ok: false, kind: "network" })
      .mockResolvedValueOnce({ ok: true, data: new Blob(["x"]) });

    const first = await downloadAttachmentBlobOnce(config, "id-5");
    const second = await downloadAttachmentBlobOnce(config, "id-5");

    expect(first.ok).toBe(false);
    expect(second.ok).toBe(true);
    expect(downloadAttachmentBlob).toHaveBeenCalledTimes(2);
  });

  it("forgets an id on request", async () => {
    downloadAttachmentBlob.mockResolvedValue({ ok: true, data: new Blob(["x"]) });

    await downloadAttachmentBlobOnce(config, "id-6");
    forgetAttachmentBlob("id-6");
    await downloadAttachmentBlobOnce(config, "id-6");

    expect(downloadAttachmentBlob).toHaveBeenCalledTimes(2);
  });
});
