import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { articleSchema } from './lib/schema';
export const collections = {
  wiki: defineCollection({ loader: glob({ pattern: '**/*.mdx', base: './src/content/wiki' }), schema: articleSchema })
};
