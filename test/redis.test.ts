/*
 * @Description:
 * @Usage:
 * @Author: richen
 * @Date: 2021-06-23 09:57:04
 * @LastEditTime: 2021-06-23 12:04:03
 */
import assert from "assert";
import { Store } from "../src/index";

describe("redis", function () {
    it("connect", function () {
        const conf = {
            key_prefix: "test",
            host: "127.0.0.1",
            port: 6379,
            username: "",
            password: "123456",
            db: 0,
        }

        // const ins = Store.getInstance(conf);
        // return ins.getConnection().then((client: any) => {
        //     client.defineCommand("test", {
        //         numberOfKeys: 1,
        //         lua: `
        //             return 0
        //                 `
        //     })

        //     return client.test().then((res: any) => {
        //         ins.close()
        //         assert.equal(res, "0");
        //     })
        // })

    })
})