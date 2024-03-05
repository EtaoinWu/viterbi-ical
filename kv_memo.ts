import { gunzip, gzip } from "https://deno.land/x/compress@v0.4.5/mod.ts";

const kv = await Deno.openKv();
type KVData = {
  value: Uint8Array;
  generated: Date;
};

export function kv_memoize<T>(
  salt: string,
  fn: (...xs: string[]) => Promise<T>,
  expireIn: number = 1000 * 10,
): typeof fn {
  async function inner(...xs: string[]): Promise<T> {
    const key = [salt, ...xs];
    const cached = await kv.get<KVData>(key);
    if (cached.value !== null) {
      console.log(`Cache hit for ${key.join(".")}`);
      const data = cached.value;
      if (
        data.generated === undefined ||
        new Date().getTime() - data.generated.getTime() > expireIn
      ) {
        console.log(`Cache expired for ${key.join(".")}`);
        await kv.delete(key);
        return inner(...xs);
      }
      const compressed = data.value;
      const encoded = gunzip(compressed);
      const stringified = new TextDecoder().decode(encoded);
      return JSON.parse(stringified) as T;
    } else {
      console.log(`Cache miss for ${key.join(".")}`);
      const result = await fn(...xs);
      const stringified = JSON.stringify(result);
      const encoded = new TextEncoder().encode(stringified);
      const compressed = gzip(encoded);
      console.log(`Item size: ${encoded.length} -> ${compressed.length}`);
      const data: KVData = { value: compressed, generated: new Date() };
      await kv.set(key, data, { expireIn });
      return result;
    }
  }
  return inner;
}
