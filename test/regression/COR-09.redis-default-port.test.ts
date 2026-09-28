/**
 * COR-09 regression test (B-11): Redis default port.
 *
 * `RedisStore.parseOpt` used to default the port to 3306 (MySQL); it must be
 * 6379, and an explicit port must always win. Cluster/sentinel host lists must
 * default every entry to 6379 as well.
 *
 * @ license: BSD (3-Clause)
 */
import { RedisStore } from "../../src/store/redis";

describe("COR-09: RedisStore default port", () => {
  test("defaults to 127.0.0.1:6379", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = new RedisStore({ type: "redis" } as any);
    expect(store.options.host).toBe("127.0.0.1");
    expect(store.options.port).toBe(6379);
    expect(store.options.port).not.toBe(3306);
  });

  test("a host without a port still gets 6379", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = new RedisStore({ type: "redis", host: "10.1.2.3" } as any);
    expect(store.options.port).toBe(6379);
  });

  test("an explicit port is preserved", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = new RedisStore({ type: "redis", host: "10.1.2.3", port: 6380 } as any);
    expect(store.options.port).toBe(6380);
  });

  test("cluster host lists default every entry to 6379", () => {
    const store = new RedisStore({
      type: "redis",
      host: ["10.0.0.1", "10.0.0.2"],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    expect(store.options.port).toBeNull();
    expect((store.options as any).clusters).toEqual([
      { host: "10.0.0.1", port: 6379 },
      { host: "10.0.0.2", port: 6379 },
    ]);
  });

  test("cluster host lists honour explicit ports", () => {
    const store = new RedisStore({
      type: "redis",
      host: ["10.0.0.1", "10.0.0.2"],
      port: [6379, 6380],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    expect((store.options as any).clusters).toEqual([
      { host: "10.0.0.1", port: 6379 },
      { host: "10.0.0.2", port: 6380 },
    ]);
  });
});
