import { readFileSync } from 'node:fs';

export function readRequiredSecret(name: string): string {
  const fileName = process.env[`${name}_FILE`];

  if (fileName) {
    const value = readFileSync(fileName, 'utf8').trim();
    if (value) return value;
    throw new Error(`${name}_FILE points to an empty secret`);
  }

  const value = process.env[name]?.trim();
  if (value) return value;

  throw new Error(`${name} or ${name}_FILE is required`);
}
