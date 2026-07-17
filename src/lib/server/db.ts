import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { readRequiredSecret } from './config/secrets';

let client: PrismaClient | undefined;

export function getDatabase(): PrismaClient {
  if (client) return client;

  const adapter = new PrismaPg({ connectionString: readRequiredSecret('DATABASE_URL') });
  client = new PrismaClient({ adapter });
  return client;
}
