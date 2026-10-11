import { describe, expect, it } from "vitest";
import { createKeyedWriteQueue } from "../keyed-write-queue";

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("createKeyedWriteQueue", () => {
  it("runs writes for one key one after another", async () => {
    const queue = createKeyedWriteQueue();
    const order: string[] = [];
    const first = deferred<void>();
    const a = queue.enqueue("t1", async () => {
      order.push("a:start");
      await first.promise;
      order.push("a:end");
    });
    const b = queue.enqueue("t1", async () => {
      order.push("b:start");
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(order).toEqual(["a:start"]);
    first.resolve();
    await Promise.all([a, b]);
    expect(order).toEqual(["a:start", "a:end", "b:start"]);
  });

  it("keeps keys independent", async () => {
    const queue = createKeyedWriteQueue();
    const blocker = deferred<void>();
    void queue.enqueue("t1", () => blocker.promise);
    let ran = false;
    await queue.enqueue("t2", async () => {
      ran = true;
    });
    expect(ran).toBe(true);
    blocker.resolve();
  });

  it("still runs the next write after a failure, and awaitIdle settles", async () => {
    const queue = createKeyedWriteQueue();
    const failed = queue.enqueue("t1", async () => {
      throw new Error("boom");
    });
    const next = queue.enqueue("t1", async () => "ok");
    await expect(failed).rejects.toThrow("boom");
    await expect(next).resolves.toBe("ok");
    await expect(queue.awaitIdle("t1")).resolves.toBeUndefined();
  });
});
