import { z } from 'astro/zod';

const nonempty = z.string().trim().min(1);
const slug = nonempty.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens.');
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.').refine(value => {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Use a real calendar date.');
const path = nonempty.refine(value => /^\/(?!\/)/.test(value) || /^https:\/\//.test(value), 'Use a root-relative path or HTTPS URL.');
const asset = nonempty.regex(/^\/(?!\/)[^?#]+\.(?:webp|avif|png|jpg|jpeg|svg|ico)$/i, 'Use an image in public/ with a root-relative path.');
const hex = z.string().regex(/^#[\da-fA-F]{6}$/, 'Use a six-digit hex color.');
const palette = z.object({ background: hex, card: hex, surface: hex, foreground: hex, muted: hex, border: hex }).strict();
export const siteSchema = z.object({
  gameName: nonempty, siteName: nonempty, shortName: nonempty,
  domain: nonempty.refine(value => !value.includes('/') && !value.includes(':') && /^[a-z\d.-]+\.[a-z]{2,}$/i.test(value), 'Enter a hostname such as example.com, without protocol or path.'),
  description: nonempty.max(180), officialUrl: z.union([z.literal(''), z.url().startsWith('https://')]),
  platform: nonempty, genre: nonempty, logo: asset, favicon: asset, demo: z.boolean(),
  theme: z.object({ defaultMode: z.enum(['dark', 'light', 'system']), primary: hex, lightPrimary: hex, dark: palette, light: palette }).strict(),
  languages: z.array(nonempty.regex(/^[a-z]{2,3}(?:-[a-zA-Z]{2})?$/)).min(1).refine(values => new Set(values.map(value => value.toLowerCase())).size === values.length, 'Languages must be unique, including region-tag case variants.'),
  defaultLanguage: nonempty.default('en'),
  localeLabels: z.record(z.string(), nonempty),
  ui: z.record(z.string(), z.record(z.string(), z.string())).default({}),
  translations: z.record(z.string(), z.object({ siteName: nonempty, description: nonempty }).strict()).default({}),
  navigation: z.array(z.object({ slug, label: nonempty, description: nonempty, icon: nonempty, labels: z.record(z.string(), nonempty).default({}), descriptions: z.record(z.string(), nonempty).default({}) }).strict()).min(1),
  seo: z.object({ title: nonempty, image: asset, imageAlt: nonempty }).strict(),
  integrations: z.object({
    analytics: z.union([z.literal(false), z.object({ provider: z.literal('cloudflare'), token: nonempty.regex(/^[a-f0-9]{32}$/i) }).strict()]),
    ads: z.union([z.literal(false), z.object({ provider: z.literal('adsense'), client: nonempty.regex(/^ca-pub-\d{16}$/), slots: z.record(z.string(), z.string().regex(/^\d+$/)), label: nonempty }).strict()])
  }).strict(),
  legal: z.object({ lastModified: isoDate, about: nonempty, privacy: nonempty, terms: nonempty, disclaimer: nonempty, translations: z.record(z.string(), z.object({ about: nonempty, privacy: nonempty, terms: nonempty, disclaimer: nonempty }).strict()).default({}) }).strict()
}).strict().superRefine((value, ctx) => {
  if (!value.languages.includes(value.defaultLanguage)) ctx.addIssue({ code: 'custom', path: ['defaultLanguage'], message: 'Default language must be enabled in languages.' });
  const reserved = ['404', 'search', 'recent', 'about', 'privacy', 'terms', ...value.languages];
  const seen = new Set<string>();
  for (const [index, nav] of value.navigation.entries()) {
    if (reserved.includes(nav.slug) || seen.has(nav.slug)) ctx.addIssue({ code: 'custom', path: ['navigation', index, 'slug'], message: 'Category slug is reserved or duplicated.' });
    seen.add(nav.slug);
  }
  for (const locale of value.languages) if (!value.localeLabels[locale]) ctx.addIssue({ code: 'custom', path: ['localeLabels', locale], message: 'Provide a language label.' });
});

export const codeSchema = z.object({ code: nonempty, reward: nonempty, status: z.enum(['active', 'expired']), lastVerified: isoDate }).strict();
export const highlightSchema = z.object({ label: nonempty, detail: nonempty, href: path.optional(), image: asset.optional(), alt: nonempty.optional(), date: isoDate.optional() }).strict();
const link = z.object({ title: nonempty, description: nonempty, href: path, icon: nonempty.optional(), label: nonempty.optional() }).strict();
const moduleSchema = z.object({
  id: slug, title: nonempty, description: nonempty.optional(),
  type: z.enum(['card-list', 'code-cards', 'tier-grid', 'step-by-step', 'timeline', 'video-grid', 'table', 'accordion']),
  enabled: z.boolean().default(true), order: z.number().default(0), href: path.optional(),
  items: z.array(highlightSchema).default([]), codes: z.array(codeSchema).default([]),
  columns: z.array(nonempty).default([]), rows: z.array(z.array(z.string())).default([]), basis: nonempty.optional()
}).strict().superRefine((value, ctx) => {
  if (value.type === 'table' && value.rows.some(row => row.length !== value.columns.length)) ctx.addIssue({ code: 'custom', path: ['rows'], message: 'Every row must match the column count.' });
  if (value.type === 'video-grid' && value.items.some(item => !item.href?.startsWith('https://') || !item.image || !item.alt)) ctx.addIssue({ code: 'custom', path: ['items'], message: 'Videos need an HTTPS URL, local thumbnail and descriptive alt.' });
});
const homeBase = z.object({
  lastModified: isoDate,
  hero: z.object({ eyebrow: nonempty, title: nonempty, description: nonempty, image: asset.optional(), imageAlt: nonempty.optional(), primary: z.object({ label: nonempty, href: path }).strict().optional(), secondary: z.object({ label: nonempty, href: path }).strict().optional(), shortcuts: z.array(z.object({ label: nonempty, href: path }).strict()).default([]), stats: z.array(z.object({ label: nonempty, value: nonempty, source: z.url(), asOf: isoDate }).strict()).default([]) }).strict().optional(),
  quickStartTitle: nonempty.default('Your adventure starts here'), quickStart: z.array(link).default([]),
  updates: z.object({ enabled: z.boolean(), title: nonempty, limit: z.number().int().min(1).max(12) }).strict().optional(),
  explore: z.object({ title: nonempty, modules: z.array(moduleSchema) }).strict().optional(),
  featuredTitle: nonempty.default('Featured guides'), featuredGuides: z.array(z.string()).default([]),
  aboutGame: z.object({ title: nonempty, description: nonempty, image: asset.optional(), imageAlt: nonempty.optional(), facts: z.array(z.object({ label: nonempty, value: nonempty }).strict()).default([]) }).strict().optional(),
  faq: z.array(z.object({ question: nonempty, answer: nonempty }).strict()).default([]),
  finalCta: z.object({ title: nonempty, description: nonempty, label: nonempty, href: path }).strict().optional()
}).strict();
export const homeSchema = homeBase.extend({ translations: z.record(z.string(), homeBase).default({}) }).strict();

export const articleSchema = z.object({
  title: nonempty.max(80), description: nonempty.min(40).max(165), category: slug,
  date: isoDate, lastModified: isoDate, draft: z.boolean().default(false), noindex: z.boolean().default(false),
  cover: asset.optional(), coverAlt: nonempty.optional(), tags: z.array(nonempty).default([]),
  translationKey: nonempty.optional(), related: z.array(nonempty).default([]),
  answer: nonempty.optional(), version: nonempty.optional(),
  codes: z.array(codeSchema).default([]), tiers: z.array(highlightSchema).default([]), rankingBasis: nonempty.optional(),
  boss: z.object({ hp: nonempty, weakness: nonempty, resistant: nonempty, location: nonempty, recommendedLevel: nonempty.optional(), rewards: z.array(nonempty).default([]) }).strict().optional(),
  item: z.object({ name: nonempty, type: nonempty, acquisition: nonempty, stats: z.array(z.object({ label: nonempty, value: nonempty }).strict()), guides: z.array(path).default([]) }).strict().optional(),
  build: z.object({ name: nonempty, scenario: nonempty, equipment: z.array(nonempty), skills: z.array(nonempty) }).strict().optional(),
  faq: z.array(z.object({ question: nonempty, answer: nonempty }).strict()).default([])
}).strict().superRefine((value, ctx) => {
  if (value.lastModified < value.date) ctx.addIssue({ code: 'custom', path: ['lastModified'], message: 'lastModified cannot precede date.' });
  if (value.cover && !value.coverAlt) ctx.addIssue({ code: 'custom', path: ['coverAlt'], message: 'A cover needs meaningful alt text.' });
  if (value.tiers.length && !value.rankingBasis) ctx.addIssue({ code: 'custom', path: ['rankingBasis'], message: 'Explain the basis for this ranking.' });
});
export type SiteConfig = z.infer<typeof siteSchema>;
export type HomeData = z.infer<typeof homeBase>;
export type ArticleData = z.infer<typeof articleSchema>;
export type ExploreModule = z.infer<typeof moduleSchema>;
