/*
 * @Author: richen
 * @Date: 2020-11-30 11:48:12
 * @LastEditors: linyyyang<linyyyang@tencent.com>
 * @LastEditTime: 2020-12-01 17:49:31
 * @License: BSD (3-Clause)
 * @Copyright (c) - <richenlin(at)gmail.com>
 */
import { RedisStore, StoreOptions } from "./redis";
export { RedisStore, RedisClient, StoreOptions } from "./redis";
/**
 *
 *
 * @export
 * @class Store
 */
export class Store {
    private static instance: RedisStore;

    /**
     * 
     *
     * @static
     * @returns
     * @memberof ValidateUtil
     */
    static getInstance(options: StoreOptions) {
        if (this.instance) {
            return this.instance;
        }
        options = {
            ...{
                host: '127.0.0.1',
                key_prefix: 'Koatty',
                timeout: 21600,
                pool_size: 10,
                conn_timeout: 500,
            }, ...options
        };
        this.instance = new RedisStore(options);
        return this.instance;
    }
}
