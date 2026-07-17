import node from '@sveltejs/adapter-node';
import vercel from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const deployTarget = process.env.DEPLOY_TARGET ?? 'vercel';

if (!['vercel', 'node'].includes(deployTarget)) {
  throw new Error(`Unsupported DEPLOY_TARGET: ${deployTarget}`);
}

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: deployTarget === 'node' ? node() : vercel(),
  },
};
