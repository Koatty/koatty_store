/*
 * @Author: richen
 * @Date: 2020-11-30 11:48:12
 * @LastEditors: linyyyang<linyyyang@tencent.com>
 * @LastEditTime: 2020-11-30 17:38:08
 * @License: BSD (3-Clause)
 * @Copyright (c) - <richenlin(at)gmail.com>
 */
import { MemcacheStore } from "./memcache";
import { RedisStore } from "./redis";
/**
 *
 *
 * @export
 * @enum {number}
 */
export enum StoreType {
    "redis" = "redis",
    "memcache" = "memcache"
}

/**
 *
 *
 * @export
 * @interface StoreOptions
 */
export interface StoreOptions {
    type: StoreType;
    key_prefix: string;
    host: string;
    port: number;
    auth?: string;
    db?: number;
    timeout?: number;
    pool_size?: number;
    conn_timeout?: number;
}

/**
 *
 *
 * @export
 * @class Store
 */
export class Store {
    private static instance: Store;

    /**
     * Creates an instance of Store.
     * @param {StoreOptions} options
     * @memberof Store
     */
    constructor(options: StoreOptions) {
        switch (options.type) {
            case "memcache":
                return new MemcacheStore(options);
                break;
            default:
                return new RedisStore(options);
                break;
        }
    }


    /**
     * 
     *
     * @static
     * @returns
     * @memberof ValidateUtil
     */
    static getInstance(options: StoreOptions) {
        options = {
            ...{
                host: '127.0.0.1',
                key_prefix: 'Koatty',
                timeout: 21600,
                pool_size: 10,
                conn_timeout: 500,
            }, ...options
        };
        return this.instance || (this.instance = new Store(options));
    }
}
