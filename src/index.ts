/*
 * @Author: richen
 * @Date: 2020-11-30 11:48:12
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2021-06-23 11:47:23
 * @License: BSD (3-Clause)
 * @Copyright (c) - <richenlin(at)gmail.com>
 */
import * as helper from "koatty_lib";
import { RedisStore, RedisStoreOptions } from "./redis";
export { RedisStore, RedisClient, RedisStoreOptions } from "./redis";


/**
 *
 *
 * @export
 * @interface StoreOptions
 */
export interface StoreOptions {
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
                port: 3306,
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
