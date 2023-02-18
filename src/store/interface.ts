/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2023-02-18 23:58:10
 * @LastEditTime: 2023-02-18 23:58:15
 */

export interface CacheStoreInterface {
  getConnection(): void;
  close(): Promise<void>;
  release(conn: any): Promise<void>;
  defineCommand(name: string, scripts: any): void;
  getCompare(name: string, value: string | number): Promise<any>;
}