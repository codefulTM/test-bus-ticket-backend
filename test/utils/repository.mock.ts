import type { DeepPartial } from 'typeorm';

type WithOptionalId = { id?: unknown };

export const repositoryMockFactory = <T extends Record<string, unknown>>(
  initial: T[] = [],
) => {
  const data: T[] = Array.isArray(initial) ? [...initial] : [];

  return {
    find: (): Promise<T[]> => Promise.resolve([...data]),

    findOne: (opts?: Partial<Record<keyof T, unknown>>): Promise<T | null> => {
      // normalize `where`
      const where = (opts as unknown) ?? undefined;

      if (!where || typeof where !== 'object') return Promise.resolve(null);

      // safe access: treat as record of unknowns
      const whereRecord = where as Record<string, unknown>;
      const keys = Object.keys(whereRecord);
      if (keys.length === 0) return Promise.resolve(null);

      const key = keys[0];
      const value = whereRecord[key];

      // find by matching property value
      const found =
        data.find((d) => {
          const dRec = d as Record<string, unknown>;
          return dRec[key] === value;
        }) ?? null;

      return Promise.resolve(found);
    },

    save: (entity: DeepPartial<T>): Promise<T> => {
      const ent = entity as T & WithOptionalId;
      const idVal = ent.id;

      // If no id, create
      if (idVal === undefined || idVal === null) {
        // generate pseudo-id
        const newId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
        (ent as Record<string, unknown>).id = newId;
        data.push(ent as T);
        return Promise.resolve(ent as T);
      }

      // Update existing
      const idx = data.findIndex((d) => {
        const dRec = d as Record<string, unknown>;
        return dRec.id === idVal;
      });

      if (idx >= 0) {
        data[idx] = { ...data[idx], ...(ent as T) };
        return Promise.resolve(data[idx]);
      }

      data.push(ent as T);
      return Promise.resolve(ent as T);
    },

    update: (
      _criteria: Partial<T>,
      _partialEntity: DeepPartial<T>,
    ): Promise<{ affected: number }> => {
      void _criteria;
      void _partialEntity;
      return Promise.resolve({ affected: 1 });
    },

    delete: (_criteria: Partial<T>): Promise<{ affected: number }> => {
      void _criteria;
      return Promise.resolve({ affected: 1 });
    },

    create: (dto: DeepPartial<T>): T => {
      return dto as T;
    },

    query: (_q?: string): Promise<any[]> => {
      void _q;
      return Promise.resolve([]);
    },
  };
};
