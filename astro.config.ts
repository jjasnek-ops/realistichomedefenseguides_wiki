import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import icon from 'astro-icon';
import { config, siteUrl } from './src/lib/config';

export default defineConfig({
  site: siteUrl, output: 'static', trailingSlash: 'always', compressHTML: true,
  i18n: { locales: config.languages, defaultLocale: config.defaultLanguage, routing: { prefixDefaultLocale: false } },
  integrations: [mdx(), icon()],
  vite: { resolve: { alias: { '~': '/src' } }, build: { cssMinify: 'esbuild' } }
});
