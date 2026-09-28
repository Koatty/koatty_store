import { RedisStore } from '../../src/store/redis';
import { EventEmitter } from 'events';
function native() {
  return Object.assign(new EventEmitter(), { status: 'ready', disconnect: jest.fn(),
    watch: jest.fn().mockResolvedValue('OK'), multi: jest.fn(() => ({ exec: jest.fn().mockResolvedValue([[null, 'OK']]) })) });
}
test('ordinary commands share one client; native leases and transactions are independent', async () => {
  const store = new RedisStore({ type: 'redis' });
  const shared = Object.assign(native(), { duplicate: jest.fn(native) });
  store.client = shared as any;
  expect(await store.getSharedConnection()).toBe(shared);
  expect(await store.getSharedConnection()).toBe(shared);
  const a = await store.getConnection();
  const b = await store.getConnection();
  expect(a).not.toBe(b);
  expect(a).not.toBe(shared);
  await store.release(a);
  expect(a.disconnect).toHaveBeenCalledTimes(1);
  expect(shared.disconnect).not.toHaveBeenCalled();
  const tx = await store.beginTransaction(['watched']);
  expect(tx.connection).not.toBe(b);
  expect(tx.connection.watch).toHaveBeenCalledWith('watched');
  await tx.commit();
  expect(tx.connection.disconnect).toHaveBeenCalledTimes(1);
  await expect(tx.commit()).rejects.toThrow('already closed');
  await store.close();
  expect(b.disconnect).toHaveBeenCalledTimes(1);
  expect(shared.disconnect).toHaveBeenCalledTimes(1);
  await expect(store.getConnection()).rejects.toThrow('closed');
});
test('isolated leases close even when blocking work throws', async () => {
  const store = new RedisStore({ type: 'redis' });
  const isolated = native();
  store.client = Object.assign(native(), { duplicate: () => isolated }) as any;
  await expect(store.withConnection(async () => { throw new Error('work failed'); })).rejects.toThrow('work failed');
  expect(isolated.disconnect).toHaveBeenCalledTimes(1);
  await store.close();
});
