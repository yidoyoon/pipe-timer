import Redis from 'ioredis';

export interface IRedisTokenAdapter {
  setPXAT: (key: string, value: string, duration?: number) => Promise<void>;
  getPexpiretime: (key: string) => Promise<number>;
  getValue: (key: string) => Promise<string>;
  deleteValue: (key: string) => Promise<number>;
  getClient: () => Promise<Redis>;
}
