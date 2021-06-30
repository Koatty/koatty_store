import * as helper from "koatty_lib";
import { CacheStore, StoreOptions } from ".";
const MemoryCache = require('@outofsync/memory-cache');

/**
 *
 *
 * @export
 * @interface MemoryStoreOptions
 */
export interface MemoryStoreOptions {
    timeout?: number;
}

/*
 * @Description:
 * @Usage:
 * @Author: richen
 * @Date: 2021-06-29 19:07:57
 * @LastEditTime: 2021-06-29 19:45:25
 */
export class MemoryStore implements CacheStore {
    client: any;
    private options: MemoryStoreOptions;
    private pool: any;

    /**
     * Creates an instance of MemoryStore.
     * @param {StoreOptions} options
     * @memberof MemoryStore
     */
    constructor(options: StoreOptions) {
        this.options = options;
        this.client = null;
    }

    /**
     *
     *
     * @returns {*}  
     * @memberof MemoryStore
     */
    getConnection() {
        if (!this.pool) {
            this.pool = new MemoryCache({ bypassUnsupported: true });
        }
        if (!this.client) {
            this.client = this.pool.createClient();
        }

        return this.client;
    }

    /**
     *
     *
     * @returns {*}  {Promise<void>}
     * @memberof MemoryStore
     */
    async close(): Promise<void> {
        this.client.end()
        this.client = null;
    }
    /**
     *
     *
     * @param {*} conn
     * @returns {*}  {Promise<void>}
     * @memberof MemoryStore
     */
    async release(conn: any): Promise<void> {
        return;
    }

    /**
     *
     *
     * @param {string} name
     * @param {*} scripts
     * @memberof MemoryStore
     */
    async defineCommand(name: string, scripts: any) {
        const client = this.getConnection();
        Object.defineProperty(client, name, {
            value: async function () {
                return scripts;
            },
            writable: false,
            configurable: false,
            enumerable: true,
        });
        return client;
    }

    /**
     *
     *
     * @param {string} name
     * @returns {*}  {Promise<any>}
     * @memberof MemoryStore
     */
    get(name: string): Promise<any> {
        const client = this.getConnection();
        return client.getAsync(name);
    }

    /**
     *
     *
     * @param {string} name
     * @param {(string | number)} value
     * @param {number} [timeout]
     * @returns {*}  {Promise<any>}
     * @memberof MemoryStore
     */
    async set(name: string, value: string | number, timeout?: number): Promise<any> {
        const client = this.getConnection();
        if (helper.isTrueEmpty(timeout)) {
            timeout = this.options.timeout;
        }
        return client.setAsync(name, value, "ex", timeout);
    }

}
