import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Runtime uses the pooled URL; schema operations prefer Neon's direct URL.
    url: process.env.DIRECT_DATABASE_URL?.trim() || env('DATABASE_URL'),
  },
});
