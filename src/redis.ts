/*
 * @Author: richen
 * @Date: 2020-11-30 15:56:08
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2021-06-30 15:21:06
 * @License: BSD (3-Clause)
 * @Copyright (c) - <richenlin(at)gmail.com>
 */
import * as helper from "koatty_lib";
import { DefaultLogger as logger } from "koatty_logger";
import IORedis from "ioredis";
import genericPool from "generic-pool";
import { CacheStore, StoreOptions } from "./index";

/**
 *
 *
 * @export
 * @interface RedisClient
 * @extends {IORedis.Redis}
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface RedisClient extends IORedis.Redis { }

/**
 *
 *
 * @interface RedisStoreOptions
 */
export interface RedisStoreOptions {
    host?: string | Array<string>;
    port?: number | Array<number>;
    username?: string;
    password?: string;
    db: number;
    keyPrefix: string;
    timeout: number;
    poolSize?: number;
    connectTimeout: number;

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
 * @class RedisStore
 */
export class RedisStore implements CacheStore {
    private options: RedisStoreOptions;
    private pool: genericPool.Pool<IORedis.Redis | IORedis.Cluster>;
    public client: IORedis.Redis | IORedis.Cluster;

    /**
     * Creates an instance of RedisStore.
     * @param {StoreOptions} options
     * @memberof RedisStore
     */
    constructor(options: StoreOptions) {
        this.options = this.parseOpt(options);
        this.pool = null;
        this.client = null;
    }

    // parseOpt
    private parseOpt(options: StoreOptions): RedisStoreOptions {
        const opt: RedisStoreOptions = {
            host: options.host || '127.0.0.1',
            port: options.port || 3306,
            username: options.username || "",
            password: options.password || "",
            db: options.db || 0,
            keyPrefix: options.key_prefix || '',
            timeout: options.timeout || 500,
            poolSize: options.pool_size || 10,
            connectTimeout: options.conn_timeout || 500,
        };

        if (helper.isArray(options.host)) {
            const hosts: Array<{ host: string; port: number }> = [];
            for (let i = 0; i < options.host.length; i++) {
                const h = options.host[i];
                if (!helper.isEmpty(options.host[i])) {
                    let p: number;
                    if (helper.isArray(options.port)) {
                        p = options.port[i];
                    } else {
                        p = options.port || 6379;
                    }
                    hosts.push({
                        host: h,
                        port: helper.toNumber(p),
                    })
                }
            }
            // sentinel
            if (!helper.isEmpty(options.name)) {
                opt.host = "";
                opt.port = null;
                opt.sentinels = [...hosts];
                opt.sentinelUsername = options.username;
                opt.sentinelPassword = options.password;
            } else {
                // cluster
                opt.host = "";
                opt.port = null;
                opt.clusters = [...hosts];
            }
        }
        return opt;
    }

    /**
     * create connection by native
     *
     * @param {number} [connNum=0]
     * @returns {*}  {Promise<IORedis.Redis | IORedis.Cluster>}
     * @memberof RedisStore
     */
    private async connect(connNum = 0): Promise<IORedis.Redis | IORedis.Cluster> {
        if (this.client && this.client.status === 'ready') {
            return this.client;
        }

        const defer = helper.getDefer();
        let connection: IORedis.Redis | IORedis.Cluster;
        if (!helper.isEmpty(this.options.clusters)) {
            connection = new IORedis.Cluster([...this.options.clusters], { redisOptions: <{ host: string }>this.options })
        } else {
            connection = new IORedis(<{ host: string }>this.options)
        }
        connection.on('end', () => {
            if (connNum < 3) {
                connNum++;
                defer.resolve(this.connect(connNum));
            } else {
                this.close();
                defer.reject('redis connection end');
            }
        });
        connection.on('ready', () => {
            this.client = connection;
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
                destroy: () => {
                    return this.close();
                },
                validate: (resource: IORedis.Redis | IORedis.Cluster) => {
                    return Promise.resolve(resource.status === 'ready');
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
     * @returns {*}  
     * @memberof RedisStore
     */
    async close() {
        this.client.disconnect();
        this.client = null;
        this.pool.destroy(this.client);
        this.pool = null;
        return;
    }

    /**
     *
     *
     * @param {*} conn
     * @returns {*}  
     * @memberof RedisStore
     */
    async release(conn: any) {
        if (this.pool.isBorrowedResource(conn)) {
            return this.pool.release(conn);
        }
        return Promise.resolve();
    }

    /**
     * defineCommand
     *
     * @param {string} name
     * @param {{ numberOfKeys?: number; lua?: string; }} scripts
     * @returns {*}  
     * @memberof RedisStore
     */
    async defineCommand(name: string, scripts: { numberOfKeys?: number; lua?: string; }) {
        const conn = await this.getConnection();
        conn.defineCommand(name, scripts);
        return conn;
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
            throw err;
        } finally {
            this.release(conn);
        }
    }

    /**
     * 字符串获取
     * @param name
     */
    get(name: string) {
        return this.wrap('get', [this.options.keyPrefix + name]);
    }

    /**
     * 字符串写入
     * @param name
     * @param value
     * @param timeout
     * @returns {Promise}
     */
    set(name: string, value: string | number, timeout = this.options.timeout) {
        const setP = [this.wrap('set', [this.options.keyPrefix + name, value])];
        if (typeof timeout === 'number') {
            setP.push(this.wrap('expire', [this.options.keyPrefix + name, timeout]));
        }
        return Promise.all(setP);
    }

    /**
     * 以秒为单位，返回给定 key 的剩余生存时间
     * @param name
     * @returns {*}
     */
    ttl(name: string) {
        return this.wrap('ttl', [this.options.keyPrefix + name]);
    }

    /**
     * 设置key超时属性
     * @param name
     * @param timeout
     */
    expire(name: string, timeout = this.options.timeout) {
        return this.wrap('expire', [this.options.keyPrefix + name, timeout]);
    }

    /**
     * 删除key
     * @param name
     */
    rm(name: string) {
        return this.wrap('del', [this.options.keyPrefix + name]);
    }

    /**
     *
     *
     * @param {*} name
     * @returns
     */
    del(name: string) {
        return this.wrap('del', [this.options.keyPrefix + name]);
    }

    /**
     * 批量删除，可模糊匹配
     * @param keyword
     * @returns {*}
     */
    batchrm(keyword: string) {
        return this.wrap('keys', [`${keyword}*`]).then((keys: string) => {
            if (helper.isEmpty(keys)) {
                return null;
            }
            return this.wrap('del', [keys]);
        });
    }

    /**
     * 判断key是否存在
     * @param name
     */
    exists(name: string) {
        return this.wrap('exists', [this.options.keyPrefix + name]);
    }

    /**
     * 查找所有符合给定模式 pattern 的 key
     * @param pattern
     */
    keys(pattern: string) {
        return this.wrap('keys', [pattern]);
    }

    /**
     * 自增
     * @param name
     */
    incr(name: string) {
        return this.wrap('incr', [this.options.keyPrefix + name]);
    }

    /**
     * 自减
     * @param name
     * @returns {*}
     */
    decr(name: string) {
        return this.wrap('decr', [this.options.keyPrefix + name]);
    }

    /**
     * 将 key 所储存的值增加增量 
     * @param name
     * @param incr
     * @returns {*}
     */
    incrby(name: string, incr = 1) {
        return this.wrap('incrby', [this.options.keyPrefix + name, incr]);
    }

    /**
     * 将 key 所储存的值减去减量 
     * 
     * @param {any} name 
     * @param {any} decr 
     */
    decrby(name: string, decr = 1) {
        return this.wrap('decrby', [this.options.keyPrefix + name, decr]);
    }

    /**
     * 哈希写入
     * @param name
     * @param key
     * @param value
     * @param timeout
     */
    hset(name: string, key: string, value: string | number, timeout = this.options.timeout) {
        const setP = [this.wrap('hset', [this.options.keyPrefix + name, key, value])];
        if (typeof timeout === 'number') {
            setP.push(this.wrap('expire', [this.options.keyPrefix + name, timeout]));
        }
        return Promise.all(setP);
    }

    /**
     * 哈希获取
     * @param name
     * @param key
     * @returns {*}
     */
    hget(name: string, key: string) {
        return this.wrap('hget', [this.options.keyPrefix + name, key]);
    }

    /**
     * 查看哈希表 hashKey 中，给定域 key 是否存在
     * @param name
     * @param key
     * @returns {*}
     */
    hexists(name: string, key: string) {
        return this.wrap('hexists', [this.options.keyPrefix + name, key]);
    }

    /**
     * 返回哈希表 key 中域的数量
     * @param name
     * @returns {*}
     */
    hlen(name: string) {
        return this.wrap('hlen', [this.options.keyPrefix + name]);
    }

    /**
     * 给哈希表指定key，增加increment
     * @param name
     * @param key
     * @param incr
     * @returns {*}
     */
    hincrby(name: string, key: string, incr = 1) {
        return this.wrap('hincrby', [this.options.keyPrefix + name, key, incr]);
    }

    /**
     * 返回哈希表所有key-value
     * @param name
     * @returns {*}
     */
    hgetall(name: string) {
        return this.wrap('hgetall', [this.options.keyPrefix + name]);
    }

    /**
     * 返回哈希表所有key
     * @param name
     * @returns {*}
     */
    hkeys(name: string) {
        return this.wrap('hkeys', [this.options.keyPrefix + name]);
    }

    /**
     * 返回哈希表所有value
     * @param name
     * @returns {*}
     */
    hvals(name: string) {
        return this.wrap('hvals', [this.options.keyPrefix + name]);
    }

    /**
     * 哈希删除
     * @param name
     * @param key
     * @returns {*}
     */
    hdel(name: string, key: string) {
        return this.wrap('hdel', [this.options.keyPrefix + name, key]);
    }

    /**
     * 判断列表长度，若不存在则表示为空
     * @param name
     * @returns {*}
     */
    llen(name: string) {
        return this.wrap('llen', [this.options.keyPrefix + name]);
    }

    /**
     * 将值插入列表表尾
     * @param name
     * @param value
     * @returns {*}
     */
    rpush(name: string, value: string | number) {
        return this.wrap('rpush', [this.options.keyPrefix + name, value]);
    }

    /**
     * 将列表表头取出，并去除
     * @param name
     * @returns {*}
     */
    lpop(name: string) {
        return this.wrap('lpop', [this.options.keyPrefix + name]);
    }

    /**
     * 返回列表 key 中指定区间内的元素，区间以偏移量 start 和 stop 指定
     * @param name
     * @param start
     * @param stop
     * @returns {*}
     */
    lrange(name: string, start: number, stop: number) {
        return this.wrap('lrange', [this.options.keyPrefix + name, start, stop]);
    }

    /**
     * 集合新增
     * @param name
     * @param value
     * @param timeout
     * @returns {*}
     */
    sadd(name: string, value: string | number, timeout = this.options.timeout) {
        const setP = [this.wrap('sadd', [this.options.keyPrefix + name, value])];
        if (typeof timeout === 'number') {
            setP.push(this.wrap('expire', [this.options.keyPrefix + name, timeout]));
        }
        return Promise.all(setP);
    }

    /**
     * 返回集合的基数(集合中元素的数量)
     * @param name
     * @returns {*}
     */
    scard(name: string) {
        return this.wrap('scard', [this.options.keyPrefix + name]);
    }

    /**
     * 判断 member 元素是否集合的成员
     * @param name
     * @param key
     * @returns {*}
     */
    sismember(name: string, key: string) {
        return this.wrap('sismember', [this.options.keyPrefix + name, key]);
    }

    /**
     * 返回集合中的所有成员
     * @param name
     * @returns {*}
     */
    smembers(name: string) {
        return this.wrap('smembers', [this.options.keyPrefix + name]);
    }

    /**
     * 移除并返回集合中的一个随机元素
     * @param name
     * @returns {*}
     */
    spop(name: string) {
        return this.wrap('spop', [this.options.keyPrefix + name]);
    }

    /**
     * 移除集合 key 中的一个 member 元素
     * @param name
     * @param key
     * @returns {*}
     */
    srem(name: string, key: string) {
        return this.wrap('srem', [this.options.keyPrefix + name, key]);
    }

    /**
     * 将 member 元素从 source 集合移动到 destination 集合
     * @param source
     * @param destination
     * @param member
     * @returns {*}
     */
    smove(source: string, destination: string, member: string) {
        return this.wrap('smove', [this.options.keyPrefix + source, this.options.keyPrefix + destination, member]);
    }
}
