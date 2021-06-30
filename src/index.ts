/*
 * @Author: richen
 * @Date: 2020-11-30 11:48:12
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2021-06-30 15:31:57
 * @License: BSD (3-Clause)
 * @Copyright (c) - <richenlin(at)gmail.com>
 */
import * as helper from "koatty_lib";
import { MemoryStore } from "./memory";
import { RedisStore } from "./redis";
export { RedisStore, RedisClient, RedisStoreOptions } from "./redis";


/**
 *
 *
 * @export
 * @interface StoreOptions
 */
export interface StoreOptions {
    type: string;
    key_prefix: string;
    host: string | Array<string>;
    port?: number | Array<number>;
    name?: string;
    username?: string;
    password?: string;
    db?: number;
    timeout?: number;
    pool_size?: number;
    conn_timeout?: number;
}


/**
 * CacheStore interface
 *
 * @export
 * @interface CacheStore
 */
export interface CacheStore {
    client: any;

    getConnection(): any;
    close(): Promise<void>;
    release(conn: any): Promise<void>;
    get(name: string): Promise<any>;
    set(name: string, value: string | number, timeout?: number): Promise<any[]>;
    defineCommand(name: string, scripts: any): any;
}

/**
 *
 *
 * @export
 * @class Store
 */
export class Store {
    private static instance: MemoryStore | RedisStore;

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
                type: 'memory', // memory | redis
                host: '127.0.0.1',
                port: 3306,
                key_prefix: 'Koatty',
                timeout: 21600,
                pool_size: 10,
                conn_timeout: 500,
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
