/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2021-12-02 09:52:03
 * @LastEditTime: 2021-12-02 16:00:04
 */
import { Store } from "../src/index";

async function test2() {
    const conf = {
        type: '',
        keyPrefix: "",
        host: process.env.redis_host,
        port: 6479,
        username: "",
        password: "123456",
        db: 0,
    }
    try {
        const ins = Store.getInstance(conf);
        // const client = await ins.getConnection();

        await ins.hset("testaaa", "aa", 10, 10);
        // await ins.hset("testaaa", "bb", 1);
        // await ins.hset("testaaa", "cc", 1);
        await ins.del("testaaa")

        const res = await ins.hget("testaaa", "aa");
        console.log(res);

        // await ins.close();

        process.exit(0)

    } catch (error) {
        console.log(error);

    }



}


// function find_max(nums: any[]) {
//     let max_num = Number.NEGATIVE_INFINITY; // smaller than all other numbers
//     for (let num of nums) {
//         if (num > max_num) {
//             // (Fill in the missing line here)
//             max_num = num
//         }
//     }
//     return max_num;
// }
// console.log(find_max([1, 77, 3, 4]));
