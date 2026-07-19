import { readFileSync } from 'node:fs';

export function readOptionalSecret(
  name: string,
  environment: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const fileName = environment[`${name}_FILE`];

  if (fileName) {
    const value = readFileSync(fileName, 'utf8').trim();
    if (value) return value;
    throw new Error(`${name}_FILE points to an empty secret`);
  }

  const value = environment[name]?.trim();
  if (value) return value;

  return undefined;
}

export function readRequiredSecret(
  name: string,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const value = readOptionalSecret(name, environment);
  if (value) return value;

  throw new Error(`${name} or ${name}_FILE is required`);
}
