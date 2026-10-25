import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { config } from '../src/lib/config';
import { parseEntryId } from '../src/lib/content-utils';
import { detailPath } from '../src/lib/url';
import { parseArticleSource } from './article-source';

export { extractFrontmatter } from './article-source';
export function sourceArticles(root = 'src/content/wiki') {
  const files: string[] = [];
  function walk(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.mdx')) files.push(path);
    }
  }
  walk(root);
  return files.sort().map(file => {
    try {
      const id = relative(root, file).replaceAll('\\', '/').replace(/\.mdx$/, '');
      const parts = parseEntryId(id);
      if (!parts || !parts.slug || parts.slug.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Expected {enabled-locale}/{category}/{slug}.mdx.');
      const { body, data } = parseArticleSource(readFileSync(file, 'utf8'));
      if (data.category !== parts.category) throw new Error('category must match the directory.');
      if (!config.navigation.some(nav => nav.slug === data.category)) throw new Error(`Unknown category: ${data.category}. Add it to site.config.json navigation.`);
      return { id, file, body, data, ...parts, path: detailPath(parts.category, parts.slug, parts.locale), key: data.translationKey ?? `${parts.category}/${parts.slug}` };
    } catch (error) { throw new Error(`${file}: ${error instanceof Error ? error.message : String(error)}`); }
  });
}
