import { createHash } from 'node:crypto';
import { z } from 'astro/zod';
import { parseArticleSource } from './article-source';

export const ARTICLE_CONTRACT = 'seoscout-articles-v1' as const;
export const EVIDENCE_ARTICLE_CONTRACT = 'seoscout-articles-v2' as const;
export const PUBLICATION_PLAN_CONTRACT = 'seoscout-publication-plan-v1' as const;
export const SOURCE_VALIDATOR = 'source-policy-v2' as const;
const text = z.string().min(1).refine(value => value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value), 'Use nonempty trimmed text without control characters.');
const digest = z.string().regex(/^[a-f0-9]{64}$/, 'Expected a SHA-256 hex digest.');
const category = text.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const slug = text.regex(/^[a-z0-9][a-z0-9-]*$/).max(251);
const locale = text.regex(/^[a-z]{2,3}(?:-[a-zA-Z]{2})?$/);
const timestamp = text.refine(value => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)), 'Expected an ISO timestamp with timezone.');
const keywordSchema = z.object({ keyword: text, category, slug, translation_key: text }).strict();
const articleSchema = z.object({
  keyword: text, locale, path: text, translation_key: text,
  sha256: digest, source_pack_sha256: digest,
}).strict();
const policySchema = z.object({
  schema_version: z.literal(1), mode: z.literal('evidence_based'),
  min_selected_keywords: z.number().int().positive(),
  required_categories: z.array(category), required_keywords: z.array(text),
}).strict();
const deferredEvidenceSchema = z.object({
  run_id: z.string().regex(/^[a-f0-9]{32}$/), state_path: text, state_sha256: digest,
  completed_rounds: z.number().int().positive(),
  audit_segments: z.array(z.object({ path: text, sha256: digest }).strict()).min(1),
}).strict();
const publicationPlanSchema = z.object({
  schema_version: z.literal(1), contract: z.literal(PUBLICATION_PLAN_CONTRACT), mode: z.literal('evidence_based'),
  created_at: timestamp, topic: text, validator_version: z.literal(SOURCE_VALIDATOR),
  keywords_sha256: digest, profile_sha256: digest, profile_file_sha256: digest,
  policy_sha256: digest, policy_file_sha256: digest, policy: policySchema,
  candidate_keywords: z.number().int().positive(), selected_keywords: z.number().int().positive(),
  deferred_keywords: z.number().int().nonnegative(), coverage: z.enum(['full', 'partial']),
  candidates: z.array(keywordSchema).min(1),
  selected: z.array(keywordSchema.extend({ source_pack_sha256: digest }).strict()).min(1),
  deferred: z.array(keywordSchema.extend({
    reason: z.literal('no_qualified_evidence'), source_gate_reason: text,
    source_pack_sha256: digest.nullable(), evidence: deferredEvidenceSchema,
  }).strict()),
  gate: z.literal('pass'), failures: z.tuple([]),
}).strict();
const sourceGateSchema = z.object({
  gate: z.literal('pass'), required_keywords: z.number().int().positive(),
  ready_keywords: z.number().int().positive(), blocked_keywords: z.literal(0),
  validator_version: z.literal(SOURCE_VALIDATOR), profile_sha256: digest,
}).strict();
const commonManifestFields = {
  topic: text, created_at: timestamp,
  keywords_sha256: digest, profile_sha256: digest, profile_file_sha256: digest,
  validator_version: z.literal(SOURCE_VALIDATOR), languages: z.array(locale).min(1),
  required_keywords: z.number().int().positive(), keywords: z.array(keywordSchema).min(1),
  articles: z.array(articleSchema).min(1),
};
const fullManifestSchema = z.object({
  schema_version: z.literal(1), contract: z.literal(ARTICLE_CONTRACT), mode: z.literal('full'),
  ...commonManifestFields, source_gate: sourceGateSchema,
}).strict();
const evidenceManifestSchema = z.object({
  schema_version: z.literal(2), contract: z.literal(EVIDENCE_ARTICLE_CONTRACT), mode: z.literal('evidence_based'),
  ...commonManifestFields, source_gate: sourceGateSchema.extend({ source_scope: z.literal('selected') }).strict(),
  candidate_keywords: z.number().int().positive(), selected_keywords: z.number().int().positive(),
  deferred_keywords: z.number().int().nonnegative(), coverage: z.enum(['full', 'partial']),
  policy_sha256: digest, policy_file_sha256: digest,
  publication_plan_sha256: digest, publication_plan_file_sha256: digest,
  publication_plan: publicationPlanSchema,
}).strict();
const manifestSchema = z.discriminatedUnion('schema_version', [fullManifestSchema, evidenceManifestSchema]);

export type ArticleManifest = z.infer<typeof manifestSchema>;
export type EvidenceArticleManifest = z.infer<typeof evidenceManifestSchema>;
export type PublicationPlan = z.infer<typeof publicationPlanSchema>;
type KeywordIdentity = z.infer<typeof keywordSchema>;
export type ImportConfig = { demo: boolean; gameName: string; languages: readonly string[]; defaultLanguage: string; navigation: readonly { slug: string }[] };
export type ImportedFile = { path: string; bytes: Uint8Array };
export class ImportContractError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = 'ImportContractError'; }
}
function requireCondition(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new ImportContractError(code, message);
}
export function sha256(bytes: Uint8Array | string) { return createHash('sha256').update(bytes).digest('hex'); }
const normalizedTopic = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();

/** The producer hashes sorted, compact, Unicode JSON without a trailing newline. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isSafeInteger(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  throw new ImportContractError('invalid_plan_value', 'Publication plans require plain JSON objects and safe integer numbers.');
}
export function canonicalSha256(value: unknown) { return sha256(canonicalJson(value)); }
const identityEquals = (left: KeywordIdentity, right: KeywordIdentity) => left.keyword === right.keyword
  && left.category === right.category && left.slug === right.slug && left.translation_key === right.translation_key;

/** Validate the declared scope; raw external evidence remains the producer's responsibility. */
function validatePublicationPlan(manifest: EvidenceArticleManifest, config: ImportConfig) {
  const plan = manifest.publication_plan;
  requireCondition(canonicalSha256(plan) === manifest.publication_plan_sha256, 'publication_plan_hash_mismatch', 'Embedded publication plan differs from its canonical digest.');
  requireCondition(canonicalSha256(plan.policy) === plan.policy_sha256, 'publication_policy_hash_mismatch', 'Embedded publication policy differs from its canonical digest.');
  for (const field of ['topic', 'keywords_sha256', 'profile_sha256', 'profile_file_sha256', 'validator_version', 'policy_sha256', 'policy_file_sha256'] as const) {
    requireCondition(plan[field] === manifest[field], 'publication_plan_context_mismatch', `Publication plan and article manifest disagree on ${field}.`);
  }
  requireCondition(plan.candidate_keywords === plan.candidates.length
    && plan.selected_keywords === plan.selected.length && plan.deferred_keywords === plan.deferred.length
    && plan.candidate_keywords === plan.selected_keywords + plan.deferred_keywords,
  'publication_plan_count_mismatch', 'Candidate, selected and deferred counts must describe the complete original partition.');
  for (const field of ['candidate_keywords', 'selected_keywords', 'deferred_keywords', 'coverage'] as const) {
    requireCondition(plan[field] === manifest[field], 'publication_plan_count_mismatch', `Publication plan and article manifest disagree on ${field}.`);
  }
  requireCondition(plan.coverage === (plan.deferred_keywords === 0 ? 'full' : 'partial'), 'publication_coverage_mismatch', 'Deferred keywords must remain visible as partial coverage.');
  requireCondition(manifest.required_keywords === plan.selected_keywords, 'publication_plan_count_mismatch', 'required_keywords must be the declared selected count.');

  const candidates = new Map<string, { identity: KeywordIdentity; index: number }>();
  const normalized = new Set<string>();
  const paths = new Set<string>();
  for (const [index, item] of plan.candidates.entries()) {
    const identity = `${item.category}/${item.slug}`;
    requireCondition(item.translation_key === identity, 'translation_key_mismatch', `Candidate translation key must equal category/slug: ${identity}`);
    requireCondition(!normalized.has(normalizedTopic(item.keyword)), 'duplicate_candidate', `Duplicate original candidate: ${item.keyword}`);
    requireCondition(!paths.has(identity), 'duplicate_candidate_identity', `Duplicate original candidate path: ${identity}`);
    normalized.add(normalizedTopic(item.keyword)); paths.add(identity); candidates.set(item.keyword, { identity: item, index });
  }
  const disposed = new Set<string>();
  for (const [name, entries] of [['selected', plan.selected], ['deferred', plan.deferred]] as const) {
    let previous = -1;
    for (const item of entries) {
      const candidate = candidates.get(item.keyword);
      requireCondition(candidate && identityEquals(item, candidate.identity), 'publication_partition_mismatch', `${name} entry does not match an original candidate: ${item.keyword}`);
      requireCondition(!disposed.has(item.keyword) && candidate.index > previous, 'publication_partition_mismatch', `${name} must be an ordered, disjoint subset of the original candidates: ${item.keyword}`);
      disposed.add(item.keyword); previous = candidate.index;
    }
  }
  requireCondition(disposed.size === candidates.size, 'publication_partition_mismatch', 'Every original candidate must be selected or explicitly deferred.');
  requireCondition(manifest.keywords.length === plan.selected.length
    && manifest.keywords.every((item, index) => identityEquals(item, plan.selected[index])),
  'publication_selection_mismatch', 'Article keywords must exactly equal the ordered selected plan identities.');

  const policy = plan.policy;
  requireCondition(new Set(policy.required_categories).size === policy.required_categories.length
    && new Set(policy.required_keywords).size === policy.required_keywords.length,
  'invalid_publication_policy', 'Policy requirement arrays must be unique.');
  requireCondition(policy.min_selected_keywords <= candidates.size
    && policy.required_categories.every(value => plan.candidates.some(item => item.category === value))
    && policy.required_keywords.every(value => candidates.has(value)),
  'invalid_publication_policy', 'Publication requirements must be possible within the original candidate task.');
  const selectedNames = new Set(plan.selected.map(item => item.keyword));
  const selectedCategories = new Set(plan.selected.map(item => item.category));
  requireCondition(plan.selected.length >= policy.min_selected_keywords
    && policy.required_categories.every(value => selectedCategories.has(value))
    && policy.required_keywords.every(value => selectedNames.has(value)),
  'publication_requirements_unmet', 'The selected plan does not meet its declared minimum or required categories/keywords.');
  requireCondition(config.navigation.length === selectedCategories.size
    && new Set(config.navigation.map(item => item.slug)).size === config.navigation.length
    && config.navigation.every(item => selectedCategories.has(item.slug)),
  'publication_navigation_mismatch', 'Evidence-based navigation must contain exactly the selected categories.');

  for (const item of plan.deferred) {
    const evidence = item.evidence;
    const prefix = `source-repair/runs/${evidence.run_id}/`;
    requireCondition(evidence.state_path === `${prefix}state.json`, 'unsafe_publication_evidence', `Deferred state reference is not bound to its run: ${item.keyword}`);
    const seen = new Set<string>();
    for (const segment of evidence.audit_segments) {
      const relative = segment.path.startsWith(prefix) ? segment.path.slice(prefix.length) : '';
      requireCondition(relative && relative.split('/').every(part => /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(part))
        && !seen.has(segment.path), 'unsafe_publication_evidence', `Unsafe or duplicate deferred audit reference: ${item.keyword}`);
      seen.add(segment.path);
    }
  }
  return new Map(plan.selected.map(item => [item.keyword, item.source_pack_sha256]));
}

/** This verifies a producer receipt and exact bytes, not the truth of external sources. */
export function validateArticleManifest(raw: unknown, config: ImportConfig, files: readonly ImportedFile[]): ArticleManifest {
  const parsed = manifestSchema.safeParse(raw);
  if (!parsed.success) throw new ImportContractError('invalid_manifest', parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '));
  const manifest = parsed.data;
  requireCondition(normalizedTopic(manifest.topic) === normalizedTopic(config.gameName), 'topic_mismatch', 'Manifest topic does not match site.config.json gameName.');
  requireCondition(config.defaultLanguage === 'en' && manifest.languages[0] === 'en', 'language_mismatch', 'Production imports require English as the first and default language.');
  requireCondition(new Set(manifest.languages.map(value => value.toLowerCase())).size === manifest.languages.length, 'duplicate_language', 'Manifest languages must be unique.');
  requireCondition(JSON.stringify(manifest.languages) === JSON.stringify(config.languages), 'language_mismatch', 'Manifest languages and their order must match site.config.json languages.');
  requireCondition(manifest.required_keywords === manifest.keywords.length, 'keyword_count_mismatch', 'required_keywords does not match the complete keyword list.');
  const gate = manifest.source_gate;
  requireCondition(gate.required_keywords === manifest.required_keywords && gate.ready_keywords === manifest.required_keywords && gate.profile_sha256 === manifest.profile_sha256 && gate.validator_version === manifest.validator_version, 'source_gate_mismatch', 'Source gate counts, profile fingerprint or validator do not match the manifest.');
  const selectedSources = manifest.schema_version === 2 ? validatePublicationPlan(manifest, config) : null;

  const keywords = new Map<string, ArticleManifest['keywords'][number]>();
  const normalizedKeywords = new Set<string>();
  const identities = new Set<string>();
  const keys = new Set<string>();
  const expected = new Map<string, { keyword: string; locale: string }>();
  for (const item of manifest.keywords) {
    const identity = `${item.category}/${item.slug}`;
    requireCondition(item.translation_key === identity, 'translation_key_mismatch', `Translation key must equal its category/slug: ${identity}`);
    requireCondition(!normalizedKeywords.has(normalizedTopic(item.keyword)), 'duplicate_keyword', `Duplicate keyword: ${item.keyword}`);
    requireCondition(!identities.has(identity) && !keys.has(item.translation_key), 'duplicate_article_identity', `Duplicate article path or translation key: ${identity}`);
    requireCondition(config.navigation.some(nav => nav.slug === item.category), 'unknown_category', `Category is not configured: ${item.category}`);
    keywords.set(item.keyword, item); normalizedKeywords.add(normalizedTopic(item.keyword)); identities.add(identity); keys.add(item.translation_key);
    for (const language of manifest.languages) expected.set(`${language}/${identity}.mdx`, { keyword: item.keyword, locale: language });
  }
  requireCondition(manifest.articles.length === expected.size, 'article_count_mismatch', `Expected ${expected.size} article records, got ${manifest.articles.length}.`);
  const records = new Map<string, ArticleManifest['articles'][number]>();
  const sourceHashes = new Map<string, string>();
  for (const record of manifest.articles) {
    const identity = expected.get(record.path);
    requireCondition(identity && identity.keyword === record.keyword && identity.locale === record.locale, 'unexpected_article_record', `Article does not match a required keyword/language path: ${record.path}`);
    requireCondition(!records.has(record.path), 'duplicate_article_record', `Duplicate article record: ${record.path}`);
    requireCondition(keywords.get(record.keyword)?.translation_key === record.translation_key, 'translation_key_mismatch', `Manifest translation key mismatch: ${record.path}`);
    requireCondition(!selectedSources || selectedSources.get(record.keyword) === record.source_pack_sha256, 'publication_source_pack_mismatch', `Article source bytes differ from the frozen selected plan: ${record.keyword}`);
    requireCondition(!sourceHashes.has(record.keyword) || sourceHashes.get(record.keyword) === record.source_pack_sha256, 'source_pack_mismatch', `Locales refer to different source packs: ${record.keyword}`);
    sourceHashes.set(record.keyword, record.source_pack_sha256); records.set(record.path, record);
  }
  const actual = new Map<string, ImportedFile>();
  for (const file of files) {
    requireCondition(!actual.has(file.path), 'duplicate_import_path', `Duplicate imported file: ${file.path}`);
    requireCondition(records.has(file.path), 'unexpected_import', `Unlisted article (including template demos) is present: ${file.path}`);
    actual.set(file.path, file);
  }
  requireCondition(actual.size === expected.size, 'missing_import', `Expected ${expected.size} imported articles, found ${actual.size}. Missing: ${[...expected.keys()].filter(path => !actual.has(path)).join(', ')}`);
  const metadataByKeyword = new Map<string, { date: string; lastModified: string }>();
  const bodies = new Map<string, string>();
  for (const [path, record] of records) {
    const file = actual.get(path)!;
    requireCondition(sha256(file.bytes) === record.sha256, 'article_hash_mismatch', `Article bytes changed after upstream acceptance: ${path}`);
    let article: ReturnType<typeof parseArticleSource>;
    try { article = parseArticleSource(new TextDecoder('utf-8', { fatal: true }).decode(file.bytes)); }
    catch (error) { throw new ImportContractError('invalid_article', `${path}: ${error instanceof Error ? error.message : String(error)}`); }
    const definition = keywords.get(record.keyword)!;
    requireCondition(article.metadata.draft === false && article.metadata.noindex === false, 'unpublished_article', `Imported articles must explicitly have draft:false and noindex:false: ${path}`);
    requireCondition(article.data.category === definition.category && article.data.translationKey === definition.translation_key, 'article_metadata_mismatch', `Article category/translationKey differs from its manifest: ${path}`);
    const dates = metadataByKeyword.get(record.keyword);
    requireCondition(!dates || (dates.date === article.data.date && dates.lastModified === article.data.lastModified), 'translation_metadata_mismatch', `Publication dates must be consistent across translations: ${record.keyword}`);
    metadataByKeyword.set(record.keyword, { date: article.data.date, lastModified: article.data.lastModified });
    const bodyHash = sha256(article.body.trim());
    requireCondition(!bodies.has(bodyHash), 'duplicate_article_body', `Article body duplicates ${bodies.get(bodyHash)}: ${path}`);
    bodies.set(bodyHash, path);
  }
  return manifest;
}
