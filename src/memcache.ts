/*
 * @Author: richen
 * @Date: 2020-11-30 15:56:35
 * @LastEditors: linyyyang<linyyyang@tencent.com>
 * @LastEditTime: 2020-11-30 17:35:38
 * @License: BSD (3-Clause)
 * @Copyright (c) - <richenlin(at)gmail.com>
 */
import helper from "koatty_lib";
import { DefaultLogger as logger } from "koatty_logger";
import memcached from "memcached";
import genericPool from "generic-pool";
import { StoreOptions } from "./index";

/**
 *
 *
 * @interface MemcacheStoreOptions
 */
interface MemcacheStoreOptions {
    host: string | string[];
    port: number;
    auth_pass: string;
    db: number;
    keyPrefix: string;
    timeout: number;
    poolSize: number;
    connectTimeout: number;
}

/**
 *
 *
 * @export
 * @class MemcacheStore
 */
export class MemcacheStore {
    private options: MemcacheStoreOptions;
    pool: genericPool.Pool<memcached>;
    client: memcached;

    /**
     * Creates an instance of MemcacheStore.
     * @param {StoreOptions} options
     * @memberof MemcacheStore
     */
    constructor(options: StoreOptions) {
        this.options = {
            host: options.host || '127.0.0.1',
            port: options.port || 11211,
            auth_pass: options.auth || '',
            db: options.db || 0,
            keyPrefix: options.key_prefix || '',
            timeout: options.timeout,
            poolSize: options.pool_size || 10,
            connectTimeout: options.conn_timeout || 500,
        };

        this.pool = null;
        this.client = null;
    }

    /**
     * create connection by native
     *
     * @param {number} [connNum=0]
     * @returns {*}  {Promise<memcached>}
     * @memberof MemcacheStore
     */
    async connect(connNum = 0): Promise<memcached> {
        if (this.client) {
            return this.client;
        }

        const defer = helper.getDefer();
        const connection = new memcached([`${this.options.host}:${this.options.port}`], this.options);

        connection.on('reconnect', () => {
            this.client = connection;
            defer.resolve(connection);
        });
        connection.on('failure', (err: any) => {
            if (connNum < 3) {
                connNum++;
                defer.resolve(this.connect(connNum));
            } else {
                defer.reject(err);
            }
        });
        connection.stats((err, stat) => {
            if (err) {
                defer.reject(err);
            }
            defer.resolve(connection);
        });

        return defer.promise;
    }

    /**
     * get connection from pool
     *
     * @returns {*}  
     * @memberof RedisStore
     */
    getConnection() {
        if (!this.pool || !this.pool.acquire) {
            const factory = {
                create: () => {
                    return this.connect();
                },
                destroy: (client: memcached) => {
                    return this.close(client, true);
                },
                validate: (resource: memcached) => {
                    return new Promise((resolve, reject) => {
                        resource.stats((err, stat) => {
                            if (err) {
                                reject(err);
                            }
                            resolve(!!stat);
                        });
                    }).then((res: boolean) => {
                        return res;
                    });
                }
            };
            this.pool = genericPool.createPool(factory, {
                max: this.options.poolSize || 10, // maximum size of the pool
                min: 2 // minimum size of the pool
            });
            this.pool.on('factoryCreateError', function (err) {
                logger.Error(err);
            });
            this.pool.on('factoryDestroyError', function (err) {
                logger.Error(err);
            });
        }

        return this.pool.acquire();
    }

    /**
     * close connection
     *
     * @param {IORedis.Redis} client
     * @param {boolean} [isPool=false]
     * @returns {*}  
     * @memberof RedisStore
     */
    async close(client: memcached, isPool = false) {
        if (isPool) {
            this.pool.destroy(client);
            this.pool = null;
        }
        client.end();
        this.client = null;
        return;
    }

    /**
     * handler for native client
     *
     * @param {string} name
     * @param {any[]} data
     * @returns {*}  
     * @memberof RedisStore
     */
    private async wrap(name: string, data: any[]) {
        let conn: any;
        try {
            conn = await this.getConnection();
            const res = await conn[name](...data);
            return res;
        } catch (err) {
            if (this.pool.isBorrowedResource(conn)) {
                this.pool.release(conn);
            }
            throw err;
        }
    }

    /**
     * defined scripting commands 
     *
     * @param {string} name
     * @param {*} data
     * @returns {*}  
     * @memberof RedisStore
     */
    async command(name: string, data: any) {
        throw new Error("Memcached not support scripting.");
    }

    /**
     *
     * @param name
     */
    get(name: string) {
        return this.wrap('get', [this.options.keyPrefix + name]);
    }

    /**
     *
     * @param name
     * @param value
     * @param timeout
     */
    set(name: string, value: string | number | null, timeout = this.options.timeout) {
        return this.wrap('set', [this.options.keyPrefix + name, JSON.stringify(value), timeout]);
    }

    /**
     *
     * @param name
     */
    rm(name: string) {
        return this.wrap('del', [this.options.keyPrefix + name]);
    }

    /**
     * 设置key超时属性
     * @param name
     * @param timeout
     */
    expire(name: string, timeout = this.options.timeout) {
        return this.wrap('touch', [this.options.keyPrefix + name, timeout]);
    }

    /**
     * 自增
     * @param name
     */
    incr(name: string) {
        return this.wrap('incr', [this.options.keyPrefix + name, 1]);
    }

    /**
     * 自减
     * @param name
     * @returns {*}
     */
    decr(name: string) {
        return this.wrap('decr', [this.options.keyPrefix + name, 1]);
    }

}