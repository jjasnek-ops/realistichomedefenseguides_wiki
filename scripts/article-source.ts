import { parse } from 'yaml';
import { articleSchema } from '../src/lib/schema';

const errorPlaceholder = /unable to generate|missing source data|no reliable source|failed to generate|error generating/i;

export function extractFrontmatter(source: string) {
  const normalized = source.replace(/^\uFEFF/, '');
  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error('Missing YAML frontmatter block.');
  return { metadata: parse(match[1]) as unknown, body: normalized.slice(match[0].length) };
}

/** Validate source text without importing configuration or executing MDX. */
export function parseArticleSource(source: string) {
  const { metadata, body } = extractFrontmatter(source);
  const result = articleSchema.safeParse(metadata);
  if (!result.success) throw new Error(result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('\n'));
  const visibleBody = body.replace(/<!--[\s\S]*?-->/g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').trim();
  if (!visibleBody) throw new Error('Article body is empty.');
  if (errorPlaceholder.test(`${result.data.title}\n${result.data.description}\n${body}`)) throw new Error('Article contains an error placeholder.');
  if (/^\s*(?:jsx|mdx|markdown)\s*(?:\r?\n|$)/i.test(body)) throw new Error('Article body starts with a formatting placeholder.');
  if (/export\s+const\s+metadata\b/.test(body)) throw new Error('Legacy JS metadata remains in the article body.');
  if (/<\d/.test(body)) throw new Error('Escape numeric comparisons as &lt;number.');
  if (/^[ \t]*#\s+/m.test(body.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, ''))) throw new Error('Use H2/H3 in MDX; the template supplies the only H1.');
  return { metadata: metadata as Record<string, unknown>, body, data: result.data };
}
