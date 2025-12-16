export const createRedisMock = () => {
  const store = new Map<string, string>();

  return {
    get: (key: string): Promise<string | null> => {
      return Promise.resolve(store.get(key) ?? null);
    },

    set: (key: string, value: string): Promise<'OK'> => {
      store.set(key, value);
      return Promise.resolve<'OK'>('OK');
    },

    setex: (key: string, _ttl: number, value: string): Promise<'OK'> => {
      // _ttl is accepted so mocks that expect setex signature work, but TTL is ignored
      store.set(key, value);
      return Promise.resolve<'OK'>('OK');
    },

    del: (key: string): Promise<number> => {
      const removed = store.delete(key);
      return Promise.resolve(removed ? 1 : 0);
    },

    flushall: (): Promise<'OK'> => {
      store.clear();
      return Promise.resolve<'OK'>('OK');
    },
  };
};
