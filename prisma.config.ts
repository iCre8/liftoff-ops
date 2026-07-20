import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { readOptionalSecret, readRequiredSecret } from './src/lib/server/config/secrets';

const schemaConnectionString =
  readOptionalSecret('DIRECT_DATABASE_URL') ?? readRequiredSecret('DATABASE_URL');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Runtime uses the pooled URL; schema operations prefer Neon's direct URL.
    url: schemaConnectionString,
  },
});
