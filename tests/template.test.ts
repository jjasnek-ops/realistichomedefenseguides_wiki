import { describe, expect, it } from 'vitest';
import { siteSchema, homeSchema, articleSchema, isoDate } from '../src/lib/schema';
import { config, homeConfig } from '../src/lib/config';
import { parseEntryId, estimateReadMinutes, selectRelatedEntries, newestFirst } from '../src/lib/content-utils';
import { localizePath, detailPath, absoluteUrl, homeUrl } from '../src/lib/url';
import { sitemapXml, articleJsonLd } from '../src/lib/seo';
import { extractFrontmatter, sourceArticles } from '../scripts/content-source';
import type { Page, WikiArticle } from '../src/lib/content';
const articleFixture = articleSchema.parse({ title: 'Example article', description: 'A concise example for schema and metadata tests.', category: 'guides', date: '2026-10-21', lastModified: '2026-10-21' });

describe('configuration and content contract', () => {
  it('validates the shipped configuration and every MDX record with the production schema', () => {
    expect(siteSchema.safeParse(config).success).toBe(true);
    expect(homeSchema.safeParse(homeConfig).success).toBe(true);
    expect(sourceArticles().every(entry => articleSchema.safeParse(entry.data).success)).toBe(true);
  });
  it('rejects invalid colors, duplicate languages, unsupported integrations and unknown keys', () => {
    expect(siteSchema.safeParse({ ...config, theme: { ...config.theme, primary: 'gold' } }).success).toBe(false);
    expect(siteSchema.safeParse({ ...config, languages: ['en','en'] }).success).toBe(false);
    expect(siteSchema.safeParse({ ...config, integrations: { ...config.integrations, analytics: true } }).success).toBe(false);
    expect(siteSchema.safeParse({ ...config, databaes: true }).success).toBe(false);
  });
  it('rejects reserved category routes and undefined default languages', () => {
    expect(siteSchema.safeParse({ ...config, navigation: [{ ...config.navigation[0], slug: 'about' }] }).success).toBe(false);
    expect(siteSchema.safeParse({ ...config, defaultLanguage: 'unconfigured-language' }).success).toBe(false);
  });
  it('preserves lowercase or uppercase region tags and rejects malformed or duplicate locales', () => {
    for (const locale of ['pt-br', 'pt-BR', 'zh-TW']) expect(siteSchema.safeParse({ ...config, languages: ['en', locale], localeLabels: { en: 'English', [locale]: 'Regional fixture' } }).success).toBe(true);
    for (const locale of ['pt_br', 'PT-br', 'pt-', '../en', 'en/../../x']) expect(siteSchema.safeParse({ ...config, languages: ['en', locale], localeLabels: { en: 'English', [locale]: 'Invalid fixture' } }).success).toBe(false);
    expect(siteSchema.safeParse({ ...config, languages: ['en', 'pt-br', 'pt-BR'], localeLabels: { en: 'English', 'pt-br': 'Portuguese', 'pt-BR': 'Portuguese' } }).success).toBe(false);
  });
  it('requires truthful modification dates, image alternatives and a ranking explanation', () => {
    const data = articleFixture;
    expect(articleSchema.safeParse({ ...data, description: 'thin' }).success).toBe(false);
    expect(articleSchema.safeParse({ ...data, lastModified: '2020-01-01' }).success).toBe(false);
    expect(articleSchema.safeParse({ ...data, cover: '/images/hero.webp', coverAlt: undefined }).success).toBe(false);
    expect(articleSchema.safeParse({ ...data, tiers: [{ label: 'S', detail: 'Sword' }], rankingBasis: undefined }).success).toBe(false);
    expect(isoDate.safeParse('2026-02-30').success).toBe(false);
  });
  it('supports all eight homepage renderer contracts and rejects malformed tables and videos', () => {
    const base = { ...homeConfig, explore: { title: 'Test', modules: [{ id: 'test', title: 'Test', type: 'table', columns: ['Name'], rows: [['A','B']] }] } };
    expect(homeSchema.safeParse(base).success).toBe(false);
    expect(homeSchema.safeParse({ ...base, explore: { title: 'Test', modules: [{ id: 'video', title: 'Video', type: 'video-grid', items: [{ label: 'Demo', detail: 'Video' }] }] } }).success).toBe(false);
    const types = ['accordion','card-list','code-cards','step-by-step','table','tier-grid','timeline','video-grid'];
    expect(homeSchema.safeParse({ lastModified:'2026-10-21', explore: { title: 'Modules', modules: types.map((type,index) => ({ id:`module-${index}`, title: type, type })) } }).success).toBe(true);
  });
  it('extracts BOM frontmatter without truncating quoted separators or YAML comments', () => {
    const { metadata, body } = extractFrontmatter('\uFEFF---\ntitle: "before---after"\ndraft: True # pending\n---\n## Body');
    expect(metadata).toEqual({ title: 'before---after', draft: true }); expect(body).toBe('## Body');
  });
});
describe('upstream content utilities and URL policy', () => {
  it('parses nested paths and rejects unsupported language prefixes', () => {
    const locale = config.defaultLanguage;
    expect(parseEntryId(`${locale}/guides/chapter/first.mdx`)).toEqual({ locale, category: 'guides', slug: 'chapter/first' });
    expect(parseEntryId('unsupported/guides/first')).toBeNull(); expect(parseEntryId('guides')).toBeNull();
  });
  it('uses exactly one trailing slash and omits the default language prefix', () => {
    expect(localizePath('/', config.defaultLanguage)).toBe('/'); expect(localizePath('/guides/', 'other')).toBe('/other/guides/');
    expect(detailPath('guides', 'nested/first', config.defaultLanguage)).toBe('/guides/nested/first/'); expect(absoluteUrl('/guides/')).toBe(`https://${config.domain}/guides/`);
    expect(homeUrl('no-home-translation')).toBe('/');
  });
  it('estimates CJK reading time by characters and Latin reading time by words', () => {
    expect(estimateReadMinutes('word '.repeat(401), 'en')).toBe(3); expect(estimateReadMinutes('字'.repeat(801), 'zh-TW')).toBe(3); expect(estimateReadMinutes('', 'en')).toBe(1);
  });
  it('prioritizes shared tags, avoids duplicates and uses stable date tie breaks', () => {
    const make = (id: string, category: string, tags: string[]) => ({ id, data: { category, tags, date: new Date('2026-10-21') } });
    const current = make('a','guides',['combat']); const related = make('b','bosses',['combat']); const same = make('c','guides',[]);
    expect(selectRelatedEntries([same, current, related, related], current, 3).map(entry => entry.id)).toEqual(['b','c']);
    expect(newestFirst(same, related)).toBeGreaterThan(0);
  });
});
describe('SEO indexability policies', () => {
  it('excludes noindex records and never fabricates untranslated sitemap variants', () => {
    const pages: Page[] = [{ path:'/guides/a/', key:'article:a', locale:'en', type:'article', lastModified:'2026-10-21' }, { path:'/guides/private/', key:'article:private', locale:'en', type:'article', lastModified:'2026-10-21', noindex:true }];
    const xml = sitemapXml(pages); expect(xml).toContain('<lastmod>2026-10-21</lastmod>'); expect(xml).not.toContain('/private/'); expect(xml).not.toContain('/zh/'); expect(sitemapXml(pages)).toBe(xml);
  });
  it('uses the exact frontmatter date for structured data without fake ratings', () => {
    const json = articleJsonLd({ data: articleFixture, path: '/guides/example/', locale: config.defaultLanguage } as WikiArticle);
    expect(json.dateModified).toBe(articleFixture.lastModified); expect(json.datePublished).toBe(articleFixture.date); expect(json).not.toHaveProperty('aggregateRating');
  });
});
