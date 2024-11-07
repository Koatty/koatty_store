/*
 * @Description:
 * @Usage:
 * @Author: richen
 * @Date: 2021-06-23 09:57:04
 * @LastEditTime: 2024-11-07 14:23:12
 */
import { equal } from "assert";
import { CacheStore } from "../src/index";

describe("MemoryCacheStore", function () {
    const conf = {
        type: "memory",
        keyPrefix: "test",
        // host: "127.0.0.1",
        // port: 6379,
        // username: "",
        // password: "123456",
        db: 0,
    }
    const client = CacheStore.getInstance();

    it("get/set", async function () {
        await client.set("test1", 111);
        let res = await client.get("test1");
        equal(res, 111);
        console.log(res);
    });

    it("hget/hset", async function () {
        await client.hset("test2", "test", 222);
        let res = await client.hget("test2", "test");

        console.log(res);
        equal(res, 222);
    });

    it("del", async function () {
        await client.hset("test2", "test", 222);
        let res = await client.del("test2");

        console.log(res);
        equal(res, 1);
    });
})