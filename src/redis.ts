/*
 * @Author: richen
 * @Date: 2020-11-30 15:56:08
 * @LastEditors: linyyyang<linyyyang@tencent.com>
 * @LastEditTime: 2020-11-30 17:36:28
 * @License: BSD (3-Clause)
 * @Copyright (c) - <richenlin(at)gmail.com>
 */
import helper from "koatty_lib";
import { DefaultLogger as logger } from "koatty_logger";
import { StoreOptions } from "./index";
import IORedis from "ioredis";
import genericPool from "generic-pool";

/**
 *
 *
 * @interface RedisStoreOptions
 */
interface RedisStoreOptions {
    host: string;
    port: number;
    auth_pass: string;
    db: number;
    keyPrefix: string;
    timeout: number;
    poolSize: number;
    connectTimeout: number;
    maxLoadingRetryTime: number;
}


/**
 *
 *
 * @export
 * @class RedisStore
 */
export class RedisStore {
    private options: RedisStoreOptions;
    pool: genericPool.Pool<IORedis.Redis>;
    client: IORedis.Redis;

    /**
     * Creates an instance of RedisStore.
     * @param {StoreOptions} options
     * @memberof RedisStore
     */
    constructor(options: StoreOptions) {
        this.options = {
            host: options.host || '127.0.0.1',
            port: options.port || 6379,
            auth_pass: options.auth || '',
            db: options.db || 0,
            keyPrefix: options.key_prefix || '',
            timeout: options.timeout,
            poolSize: options.pool_size || 10,
            connectTimeout: options.conn_timeout || 500,
            maxLoadingRetryTime: 2000,
        };

        this.pool = null;
        this.client = null;
    }

    /**
     * create connection by native
     *
     * @param {number} [connNum=0]
     * @returns {*}  {Promise<IORedis.Redis>}
     * @memberof RedisStore
     */
    async connect(connNum = 0): Promise<IORedis.Redis> {
        if (this.client && this.client.status === 'ready') {
            return this.client;
        }

        const defer = helper.getDefer();
        const connection = new IORedis(this.options);

        connection.on("error", (err) => {
            if (connNum < 3) {
                connNum++;
                defer.resolve(this.connect(connNum));
            } else {
                this.close(connection);
                defer.reject(err);
            }
        });
        connection.on('end', () => {
            if (connNum < 3) {
                connNum++;
                defer.resolve(this.connect(connNum));
            } else {
                this.close(connection);
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
                destroy: (client: IORedis.Redis) => {
                    return this.close(client, true);
                },
                validate: (resource: IORedis.Redis) => {
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
     * @param {IORedis.Redis} client
     * @param {boolean} [isPool=false]
     * @returns {*}  
     * @memberof RedisStore
     */
    async close(client: IORedis.Redis, isPool = false) {
        if (isPool) {
            this.pool.destroy(client);
            this.pool = null;
        }
        client.disconnect();
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
        let cls;
        try {
            cls = await this.connect();
            await cls.defineCommand(name, data);
            return cls;
        } catch (err) {
            this.close(cls);
            throw err;
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
    set(name: string, value: string | number | null, timeout = this.options.timeout) {
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
    hset(name: string, key: string, value: string | number | null, timeout = this.options.timeout) {
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
    rpush(name: string, value: string | number | null) {
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
    sadd(name: string, value: string | number | null, timeout = this.options.timeout) {
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