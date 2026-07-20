import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readOptionalSecret, readRequiredSecret } from './secrets';

const temporaryDirectories: string[] = [];

function writeTemporarySecret(value: string): string {
  const directory = mkdtempSync(join(tmpdir(), 'liftoff-secret-test-'));
  temporaryDirectories.push(directory);
  const path = join(directory, 'secret');
  writeFileSync(path, value, { mode: 0o600 });
  return path;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('secret configuration', () => {
  it('prefers a file-mounted secret over a direct value', () => {
    const path = writeTemporarySecret('file value\n');

    expect(
      readOptionalSecret('DIRECT_DATABASE_URL', {
        DIRECT_DATABASE_URL: 'direct value',
        DIRECT_DATABASE_URL_FILE: path,
      }),
    ).toBe('file value');
  });

  it('uses a direct value when no secret file is configured', () => {
    expect(
      readOptionalSecret('DIRECT_DATABASE_URL', { DIRECT_DATABASE_URL: ' direct value ' }),
    ).toBe('direct value');
  });

  it('returns undefined for an optional missing secret', () => {
    expect(readOptionalSecret('DIRECT_DATABASE_URL', {})).toBeUndefined();
  });

  it('fails closed when a configured secret file is empty', () => {
    const path = writeTemporarySecret('  \n');

    expect(() =>
      readOptionalSecret('DIRECT_DATABASE_URL', { DIRECT_DATABASE_URL_FILE: path }),
    ).toThrow('DIRECT_DATABASE_URL_FILE points to an empty secret');
  });

  it('fails closed when a required secret is missing', () => {
    expect(() => readRequiredSecret('DATABASE_URL', {})).toThrow(
      'DATABASE_URL or DATABASE_URL_FILE is required',
    );
  });
});
