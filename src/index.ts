/*
 * @Author: richen
 * @Date: 2020-11-30 11:48:12
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2021-12-02 15:31:20
 * @License: BSD (3-Clause)
 * @Copyright (c) - <richenlin(at)gmail.com>
 */
import { CacheStore } from "./store";
import { MemoryStore } from "./store/memory";
import { RedisStore } from "./store/redis";
export { MemoryStore } from "./store/memory";

/**
 *
 *
 * @export
 * @interface StoreOptions
 */
export interface StoreOptions {
    type?: string;
    keyPrefix?: string;
    host?: string | Array<string>;
    port?: number | Array<number>;
    username?: string;
    password?: string;
    db?: number;
    timeout?: number; // seconds
    poolSize?: number;
    connectTimeout?: number; // milliseconds

    // sentinel
    name?: string;
    sentinelUsername?: string;
    sentinelPassword?: string;
    sentinels?: Array<{ host: string; port: number }>;

    // cluster
    clusters?: Array<{ host: string; port: number }>;
}

/**
 *
 *
 * @export
 * @class Store
 */
export class Store {
    private static instance: CacheStore;

    /**
     * 
     *
     * @static
     * @returns
     * @memberof ValidateUtil
     */
    static getInstance(options: StoreOptions): CacheStore {
        if (this.instance) {
            return this.instance;
        }
        options = {
            ...{
                type: 'memory', // memory | redis
                host: '',
                port: 0,
                keyPrefix: 'Koatty',
                timeout: 600,
                poolSize: 10,
                connectTimeout: 500,
                db: 0
            }, ...options
        };
        switch (options.type) {
            case "redis":
                this.instance = new RedisStore(options);
                break;
            case "memory":
            default:
                this.instance = new MemoryStore(options);
                break;
        }

        return this.instance;
    }
}

