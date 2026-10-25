import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ARTICLE_CONTRACT, EVIDENCE_ARTICLE_CONTRACT, PUBLICATION_PLAN_CONTRACT, SOURCE_VALIDATOR, ImportContractError, canonicalJson, canonicalSha256, sha256, validateArticleManifest, type ArticleManifest, type EvidenceArticleManifest, type PublicationPlan, type ImportConfig, type ImportedFile } from '../scripts/import-contract';
import { checkArticleImport, readImportedFiles } from '../scripts/import-files';
import { extractFrontmatter, parseArticleSource } from '../scripts/article-source';

// These synthetic records exercise the handoff contract; they are not research or article assets.
const configuration: ImportConfig = { demo: false, gameName: 'Fixture Game', languages: ['en', 'pt-br'], defaultLanguage: 'en', navigation: [{ slug: 'guides' }] };
const fixtureKeyword = { keyword: 'Fixture Game tips', category: 'guides', slug: 'fixture-game-tips', translation_key: 'guides/fixture-game-tips' };
function article(language: string, body?: string) {
  return `---\ntitle: "Synthetic fixture ${language}"\ndescription: "Synthetic contract fixture; this is not real game research."\ncategory: guides\ndate: "2026-10-24"\nlastModified: "2026-10-24"\ndraft: false\nnoindex: false\ntags: [fixture]\ntranslationKey: guides/fixture-game-tips\n---\n\n${body ?? `## Fixture ${language}\n\nThis synthetic ${language} body tests an import receipt. It must never be published as game information.`}\n`;
}
function fixture() {
  const files: ImportedFile[] = configuration.languages.map(language => ({ path: `${language}/guides/fixture-game-tips.mdx`, bytes: Buffer.from(article(language)) }));
  const profile = sha256('synthetic canonical profile');
  const manifest: ArticleManifest = {
    schema_version: 1, contract: ARTICLE_CONTRACT, mode: 'full', topic: 'Fixture Game', created_at: '2026-10-24T12:00:00+08:00',
    keywords_sha256: sha256('synthetic keyword input'), profile_sha256: profile, profile_file_sha256: sha256('synthetic profile bytes'),
    validator_version: SOURCE_VALIDATOR, languages: [...configuration.languages], required_keywords: 1, keywords: [{ ...fixtureKeyword }],
    source_gate: { gate: 'pass', required_keywords: 1, ready_keywords: 1, blocked_keywords: 0, validator_version: SOURCE_VALIDATOR, profile_sha256: profile },
    articles: files.map(file => ({ keyword: fixtureKeyword.keyword, locale: file.path.split('/')[0], path: file.path, translation_key: fixtureKeyword.translation_key, sha256: sha256(file.bytes), source_pack_sha256: sha256('synthetic source pack') })),
  };
  return { manifest, files };
}
function evidenceFixture() {
  const data = fixture();
  const deferred = { keyword: 'Fixture Game ending', category: 'story', slug: 'fixture-game-ending', translation_key: 'story/fixture-game-ending' };
  const policy = { schema_version: 1 as const, mode: 'evidence_based' as const,
    min_selected_keywords: 1, required_categories: ['guides'], required_keywords: [] as string[] };
  const runId = 'a'.repeat(32);
  const plan: PublicationPlan = {
    schema_version: 1, contract: PUBLICATION_PLAN_CONTRACT, mode: 'evidence_based',
    created_at: data.manifest.created_at, topic: data.manifest.topic, validator_version: SOURCE_VALIDATOR,
    keywords_sha256: data.manifest.keywords_sha256, profile_sha256: data.manifest.profile_sha256,
    profile_file_sha256: data.manifest.profile_file_sha256, policy_sha256: canonicalSha256(policy),
    policy_file_sha256: sha256(JSON.stringify(policy) + '\n'), policy,
    candidate_keywords: 2, selected_keywords: 1, deferred_keywords: 1, coverage: 'partial',
    candidates: [{ ...fixtureKeyword }, deferred],
    selected: [{ ...fixtureKeyword, source_pack_sha256: data.manifest.articles[0].source_pack_sha256 }],
    deferred: [{ ...deferred, reason: 'no_qualified_evidence', source_gate_reason: 'missing', source_pack_sha256: null,
      evidence: { run_id: runId, state_path: `source-repair/runs/${runId}/state.json`,
        state_sha256: sha256('synthetic observed terminal collection state'), completed_rounds: 3,
        audit_segments: [{ path: `source-repair/runs/${runId}/decisions.jsonl`, sha256: sha256('synthetic retained audit') }] } }],
    gate: 'pass', failures: [],
  };
  const manifest: EvidenceArticleManifest = { ...data.manifest,
    schema_version: 2, contract: EVIDENCE_ARTICLE_CONTRACT, mode: 'evidence_based',
    candidate_keywords: 2, selected_keywords: 1, deferred_keywords: 1, coverage: 'partial',
    policy_sha256: plan.policy_sha256, policy_file_sha256: plan.policy_file_sha256,
    publication_plan_sha256: canonicalSha256(plan), publication_plan_file_sha256: sha256(JSON.stringify(plan) + '\n'),
    publication_plan: plan, source_gate: { ...data.manifest.source_gate, source_scope: 'selected' },
  };
  return { manifest, files: data.files };
}
function sealPlan(data: ReturnType<typeof evidenceFixture>) {
  data.manifest.publication_plan_sha256 = canonicalSha256(data.manifest.publication_plan);
  data.manifest.publication_plan_file_sha256 = sha256(JSON.stringify(data.manifest.publication_plan) + '\n');
}
function sealPolicy(data: ReturnType<typeof evidenceFixture>) {
  const plan = data.manifest.publication_plan;
  plan.policy_sha256 = data.manifest.policy_sha256 = canonicalSha256(plan.policy);
  plan.policy_file_sha256 = data.manifest.policy_file_sha256 = sha256(JSON.stringify(plan.policy) + '\n');
  sealPlan(data);
}
function rejects(code: string, run: () => unknown) {
  try { run(); throw new Error('Expected the import gate to reject this fixture.'); }
  catch (error) { expect(error).toBeInstanceOf(ImportContractError); expect((error as ImportContractError).code).toBe(code); }
}
function replaceArticle(data: ReturnType<typeof fixture>, index: number, content: string) {
  data.files[index].bytes = Buffer.from(content);
  data.manifest.articles[index].sha256 = sha256(data.files[index].bytes);
}

describe('complete production article receipt', () => {
  it('accepts the exact keyword by language product and original file bytes', () => {
    const { manifest, files } = fixture();
    expect(validateArticleManifest(manifest, configuration, files)).toEqual(manifest);
  });
  it('does not accept an empty or incomplete keyword task', () => {
    const data = fixture();
    rejects('invalid_manifest', () => validateArticleManifest({ ...data.manifest, required_keywords: 0, keywords: [], articles: [] }, configuration, []));
    rejects('keyword_count_mismatch', () => validateArticleManifest({ ...data.manifest, required_keywords: 38 }, configuration, data.files));
  });
  it('blocks missing English or translated files and an empty content tree', () => {
    const { manifest, files } = fixture();
    for (const subset of [files.slice(0, 1), files.slice(1), []]) rejects('missing_import', () => validateArticleManifest(manifest, configuration, subset));
  });
  it('blocks missing or duplicate records even when aggregate counts look right', () => {
    const { manifest, files } = fixture();
    rejects('article_count_mismatch', () => validateArticleManifest({ ...manifest, articles: manifest.articles.slice(0, 1) }, configuration, files));
    rejects('duplicate_article_record', () => validateArticleManifest({ ...manifest, articles: [manifest.articles[0], manifest.articles[0]] }, configuration, files));
  });
  it('rejects additional demo and unsupported language articles', () => {
    const { manifest, files } = fixture();
    for (const path of ['en/guides/first-steps.mdx', 'zh/guides/fixture-game-tips.mdx']) rejects('unexpected_import', () => validateArticleManifest(manifest, configuration, [...files, { path, bytes: Buffer.from(article('extra')) }]));
  });
  it('requires the configured topic, languages and ordering', () => {
    const { manifest, files } = fixture();
    rejects('topic_mismatch', () => validateArticleManifest({ ...manifest, topic: 'Another Game' }, configuration, files));
    for (const languages of [['pt-br', 'en'], ['en'], ['en', 'pt-BR']]) rejects('language_mismatch', () => validateArticleManifest({ ...manifest, languages }, configuration, files));
    rejects('duplicate_language', () => validateArticleManifest({ ...manifest, languages: ['en', 'pt-br', 'pt-BR'] }, configuration, files));
  });
  it('rejects duplicate keyword identities and translation keys', () => {
    const { manifest, files } = fixture();
    const repeated = { ...manifest, required_keywords: 2, keywords: [fixtureKeyword, { ...fixtureKeyword, keyword: 'fixture game tips' }], source_gate: { ...manifest.source_gate, required_keywords: 2, ready_keywords: 2 } };
    rejects('duplicate_keyword', () => validateArticleManifest(repeated, configuration, files));
    repeated.keywords[1].keyword = 'Fixture Game ending';
    rejects('duplicate_article_identity', () => validateArticleManifest(repeated, configuration, files));
  });
  it('requires the canonical category/slug translation key even if metadata agrees', () => {
    const data = fixture();
    data.manifest.keywords[0].translation_key = 'unrelated/shared-key';
    for (const record of data.manifest.articles) record.translation_key = 'unrelated/shared-key';
    for (const [index, language] of configuration.languages.entries()) replaceArticle(data, index, article(language).replace('guides/fixture-game-tips', 'unrelated/shared-key'));
    rejects('translation_key_mismatch', () => validateArticleManifest(data.manifest, configuration, data.files));
  });
  it('does not accept blocked, partial, mismatched or obsolete source gate receipts', () => {
    const { manifest, files } = fixture();
    rejects('invalid_manifest', () => validateArticleManifest({ ...manifest, source_gate: { ...manifest.source_gate, gate: 'blocked' } }, configuration, files));
    rejects('invalid_manifest', () => validateArticleManifest({ ...manifest, validator_version: 'old-rules' }, configuration, files));
    rejects('source_gate_mismatch', () => validateArticleManifest({ ...manifest, source_gate: { ...manifest.source_gate, ready_keywords: 36 } }, configuration, files));
    rejects('source_gate_mismatch', () => validateArticleManifest({ ...manifest, source_gate: { ...manifest.source_gate, profile_sha256: sha256('different profile') } }, configuration, files));
    rejects('invalid_manifest', () => validateArticleManifest({ ...manifest, profile_file_sha256: 'not-a-digest' }, configuration, files));
  });
  it('rejects traversal paths and records mapped to the wrong keyword', () => {
    const { manifest, files } = fixture();
    for (const path of ['../outside.mdx', '/en/guides/a.mdx', 'en\\guides\\a.mdx', 'en/guides/%2e%2e/a.mdx']) rejects('unexpected_article_record', () => validateArticleManifest({ ...manifest, articles: [{ ...manifest.articles[0], path }, manifest.articles[1]] }, configuration, files));
    rejects('unexpected_article_record', () => validateArticleManifest({ ...manifest, articles: [{ ...manifest.articles[0], keyword: 'Different keyword' }, manifest.articles[1]] }, configuration, files));
  });
  it('requires the same source pack for each translation of a keyword', () => {
    const { manifest, files } = fixture();
    manifest.articles[1].source_pack_sha256 = sha256('another pack');
    rejects('source_pack_mismatch', () => validateArticleManifest(manifest, configuration, files));
  });
  it('rejects changed bytes, including harmless-looking appended whitespace', () => {
    const { manifest, files } = fixture();
    files[0].bytes = Buffer.concat([files[0].bytes, Buffer.from('\n')]);
    rejects('article_hash_mismatch', () => validateArticleManifest(manifest, configuration, files));
  });
  it('requires explicit published/indexable flags and the original translation identity', () => {
    for (const [from, to, reason] of [['draft: false', 'draft: true', 'unpublished_article'], ['noindex: false', 'noindex: true', 'unpublished_article'], ['draft: false\n', '', 'unpublished_article'], ['translationKey: guides/fixture-game-tips', 'translationKey: guides/other', 'article_metadata_mismatch']]) {
      const data = fixture();
      replaceArticle(data, 0, article('en').replace(from, to));
      rejects(reason, () => validateArticleManifest(data.manifest, configuration, data.files));
    }
  });
  it('keeps dates consistent across translations and rejects copied bodies', () => {
    const data = fixture();
    replaceArticle(data, 1, article('pt-br').replace('lastModified: "2026-10-24"', 'lastModified: "2026-10-25"'));
    rejects('translation_metadata_mismatch', () => validateArticleManifest(data.manifest, configuration, data.files));
    replaceArticle(data, 1, article('pt-br', extractFrontmatter(article('en')).body));
    rejects('duplicate_article_body', () => validateArticleManifest(data.manifest, configuration, data.files));
  });
});

describe('audited evidence-based publication receipt', () => {
  it('accepts partial original coverage only when the complete selected task is present', () => {
    const { manifest, files } = evidenceFixture();
    expect(validateArticleManifest(manifest, configuration, files)).toEqual(manifest);
    expect(manifest.candidate_keywords).toBe(2);
    expect(manifest.required_keywords).toBe(1);
    expect(manifest.coverage).toBe('partial');
  });
  it('also accepts evidence-based plans where every original candidate is selected', () => {
    const data = evidenceFixture();
    const plan = data.manifest.publication_plan;
    plan.candidates.pop(); plan.deferred = []; plan.candidate_keywords = 1; plan.deferred_keywords = 0; plan.coverage = 'full';
    Object.assign(data.manifest, { candidate_keywords: 1, deferred_keywords: 0, coverage: 'full' });
    sealPlan(data);
    expect(validateArticleManifest(data.manifest, configuration, data.files)).toEqual(data.manifest);
  });
  it('uses sorted compact Unicode JSON without dropping or reordering arrays', () => {
    expect(canonicalJson({ z: 1, a: ['中', true, { b: 0, a: null }] })).toBe('{"a":["中",true,{"a":null,"b":0}],"z":1}');
    expect(canonicalSha256({ b: 2, a: 1 })).toBe(canonicalSha256({ a: 1, b: 2 }));
    expect(canonicalSha256(['a', 'b'])).not.toBe(canonicalSha256(['b', 'a']));
    for (const value of [NaN, Infinity, 1.5, undefined, Number.MAX_SAFE_INTEGER + 1]) rejects('invalid_plan_value', () => canonicalJson(value));
  });
  it('does not reinterpret a v1 full receipt as evidence-based or accept an unknown contract', () => {
    const { manifest, files } = evidenceFixture();
    for (const changed of [{ contract: ARTICLE_CONTRACT }, { schema_version: 1 }, { mode: 'full' }, { contract: 'seoscout-articles-v3' }]) {
      rejects('invalid_manifest', () => validateArticleManifest({ ...manifest, ...changed }, configuration, files));
    }
  });
  it('binds the exact canonical plan and declared policy instead of trusting pass labels', () => {
    const data = evidenceFixture();
    data.manifest.publication_plan.deferred[0].source_gate_reason = 'changed reason';
    rejects('publication_plan_hash_mismatch', () => validateArticleManifest(data.manifest, configuration, data.files));
    sealPlan(data);
    data.manifest.publication_plan.policy.min_selected_keywords = 2;
    sealPlan(data);
    rejects('publication_policy_hash_mismatch', () => validateArticleManifest(data.manifest, configuration, data.files));
  });
  it('binds topic, original keyword and profile digests and both policy digests', () => {
    for (const field of ['topic', 'keywords_sha256', 'profile_sha256', 'profile_file_sha256', 'policy_file_sha256'] as const) {
      const data = evidenceFixture();
      data.manifest.publication_plan[field] = field === 'topic' ? 'Different Fixture' : sha256('different ' + field);
      sealPlan(data);
      rejects('publication_plan_context_mismatch', () => validateArticleManifest(data.manifest, configuration, data.files));
    }
    const data = evidenceFixture();
    data.manifest.policy_sha256 = sha256('different policy');
    rejects('publication_plan_context_mismatch', () => validateArticleManifest(data.manifest, configuration, data.files));
  });
  it('does not hide the original count or falsely report full coverage', () => {
    const data = evidenceFixture();
    data.manifest.candidate_keywords = 38;
    rejects('publication_plan_count_mismatch', () => validateArticleManifest(data.manifest, configuration, data.files));
    data.manifest.candidate_keywords = 2;
    data.manifest.coverage = data.manifest.publication_plan.coverage = 'full';
    sealPlan(data);
    rejects('publication_coverage_mismatch', () => validateArticleManifest(data.manifest, configuration, data.files));
  });
  it('requires the original candidates to be exactly partitioned without duplicate dispositions', () => {
    const missing = evidenceFixture();
    missing.manifest.publication_plan.candidate_keywords = 3;
    sealPlan(missing);
    rejects('publication_plan_count_mismatch', () => validateArticleManifest(missing.manifest, configuration, missing.files));
    const duplicated = evidenceFixture();
    Object.assign(duplicated.manifest.publication_plan.deferred[0], fixtureKeyword);
    sealPlan(duplicated);
    rejects('publication_partition_mismatch', () => validateArticleManifest(duplicated.manifest, configuration, duplicated.files));
  });
  it('rejects duplicate original keyword names, conflicting paths and changed deferred identities', () => {
    const duplicated = evidenceFixture();
    duplicated.manifest.publication_plan.candidates[1].keyword = 'fixture game tips';
    sealPlan(duplicated);
    rejects('duplicate_candidate', () => validateArticleManifest(duplicated.manifest, configuration, duplicated.files));
    const collision = evidenceFixture();
    Object.assign(collision.manifest.publication_plan.candidates[1], { ...fixtureKeyword, keyword: 'Fixture Game another intent' });
    sealPlan(collision);
    rejects('duplicate_candidate_identity', () => validateArticleManifest(collision.manifest, configuration, collision.files));
    const changed = evidenceFixture();
    changed.manifest.publication_plan.deferred[0].category = 'guides';
    sealPlan(changed);
    rejects('publication_partition_mismatch', () => validateArticleManifest(changed.manifest, configuration, changed.files));
  });
  it('preserves original candidate order in the selected subset', () => {
    const data = evidenceFixture();
    const plan = data.manifest.publication_plan;
    const identity = { keyword: 'Fixture Game map', category: 'guides', slug: 'fixture-game-map', translation_key: 'guides/fixture-game-map' };
    plan.candidates.push(identity); plan.selected.unshift({ ...identity, source_pack_sha256: sha256('synthetic map source') });
    Object.assign(plan, { candidate_keywords: 3, selected_keywords: 2 });
    Object.assign(data.manifest, { candidate_keywords: 3, selected_keywords: 2, required_keywords: 2,
      keywords: [identity, fixtureKeyword], source_gate: { ...data.manifest.source_gate, required_keywords: 2, ready_keywords: 2 } });
    sealPlan(data);
    rejects('publication_partition_mismatch', () => validateArticleManifest(data.manifest, configuration, data.files));
  });
  it('does not silently change the selected task after article generation', () => {
    const data = evidenceFixture();
    data.manifest.keywords[0] = { ...data.manifest.keywords[0], keyword: 'Fixture Game different intent' };
    rejects('publication_selection_mismatch', () => validateArticleManifest(data.manifest, configuration, data.files));
  });
  it('enforces the declared minimum and required categories and keywords', () => {
    for (const change of [
      { min_selected_keywords: 2 }, { required_categories: ['story'] }, { required_keywords: ['Fixture Game ending'] },
    ]) {
      const data = evidenceFixture();
      Object.assign(data.manifest.publication_plan.policy, change); sealPolicy(data);
      rejects('publication_requirements_unmet', () => validateArticleManifest(data.manifest, configuration, data.files));
    }
  });
  it('rejects impossible or duplicate policy requirements and an empty selected plan', () => {
    for (const change of [
      { min_selected_keywords: 3 }, { required_categories: ['absent'] }, { required_keywords: ['Fixture Game unknown'] },
      { required_categories: ['guides', 'guides'] }, { required_keywords: ['Fixture Game tips', 'Fixture Game tips'] },
    ]) {
      const data = evidenceFixture();
      Object.assign(data.manifest.publication_plan.policy, change); sealPolicy(data);
      rejects('invalid_publication_policy', () => validateArticleManifest(data.manifest, configuration, data.files));
    }
    const data = evidenceFixture();
    rejects('invalid_manifest', () => validateArticleManifest({ ...data.manifest, required_keywords: 0, selected_keywords: 0,
      keywords: [], articles: [], publication_plan: { ...data.manifest.publication_plan, selected_keywords: 0, selected: [] } }, configuration, []));
  });
  it('requires navigation to match only the selected categories', () => {
    const { manifest, files } = evidenceFixture();
    for (const navigation of [[{ slug: 'guides' }, { slug: 'story' }], [{ slug: 'story' }], [{ slug: 'guides' }, { slug: 'guides' }], []]) {
      rejects('publication_navigation_mismatch', () => validateArticleManifest(manifest, { ...configuration, navigation }, files));
    }
  });
  it('requires retained bounded-collection references for each deferred keyword', () => {
    const { manifest, files } = evidenceFixture();
    const plan = manifest.publication_plan;
    for (const change of [{ reason: 'provider_unavailable' }, { reason: 'generation_failed' }, { reason: 'translation_failed' }, { evidence: undefined },
      { evidence: { ...plan.deferred[0].evidence, completed_rounds: 0 } }, { evidence: { ...plan.deferred[0].evidence, audit_segments: [] } }]) {
      const raw = { ...manifest, publication_plan: { ...plan, deferred: [{ ...plan.deferred[0], ...change }] } };
      rejects('invalid_manifest', () => validateArticleManifest(raw, configuration, files));
    }
  });
  it('rejects absolute, traversing, mismatched-run and duplicate audit references', () => {
    for (const path of ['/root/audit.jsonl', '../audit.jsonl', `source-repair/runs/${'b'.repeat(32)}/decisions.jsonl`,
      `source-repair/runs/${'a'.repeat(32)}/../outside.jsonl`, `source-repair/runs/${'a'.repeat(32)}/%2e%2e/outside.jsonl`,
      `source-repair/runs/${'a'.repeat(32)}/nested\\outside.jsonl`]) {
      const data = evidenceFixture();
      data.manifest.publication_plan.deferred[0].evidence.audit_segments[0].path = path; sealPlan(data);
      rejects('unsafe_publication_evidence', () => validateArticleManifest(data.manifest, configuration, data.files));
    }
    const data = evidenceFixture();
    const evidence = data.manifest.publication_plan.deferred[0].evidence;
    evidence.state_path = '/root/source-repair/state.json'; sealPlan(data);
    rejects('unsafe_publication_evidence', () => validateArticleManifest(data.manifest, configuration, data.files));
    evidence.state_path = `source-repair/runs/${evidence.run_id}/state.json`;
    evidence.audit_segments.push({ ...evidence.audit_segments[0] }); sealPlan(data);
    rejects('unsafe_publication_evidence', () => validateArticleManifest(data.manifest, configuration, data.files));
  });
  it('requires all selected-source hashes to match the frozen publication plan', () => {
    const data = evidenceFixture();
    for (const record of data.manifest.articles) record.source_pack_sha256 = sha256('replacement source bytes');
    rejects('publication_source_pack_mismatch', () => validateArticleManifest(data.manifest, configuration, data.files));
  });
  it('still blocks missing selected translations, extra deferred pages and modified bytes', () => {
    const { manifest, files } = evidenceFixture();
    rejects('missing_import', () => validateArticleManifest(manifest, configuration, files.slice(0, 1)));
    rejects('unexpected_import', () => validateArticleManifest(manifest, configuration, [...files,
      { path: 'en/story/fixture-game-ending.mdx', bytes: Buffer.from(article('deferred placeholder')) }]));
    files[0].bytes = Buffer.concat([files[0].bytes, Buffer.from('\n')]);
    rejects('article_hash_mismatch', () => validateArticleManifest(manifest, configuration, files));
  });
  it('does not accept hidden source bodies, arbitrary policy fields or a falsely all-candidate source scope', () => {
    const { manifest, files } = evidenceFixture();
    rejects('invalid_manifest', () => validateArticleManifest({ ...manifest, source_gate: { ...manifest.source_gate, source_scope: 'all' } }, configuration, files));
    rejects('invalid_manifest', () => validateArticleManifest({ ...manifest, publication_plan: { ...manifest.publication_plan, source_body: 'Must never enter the public handoff.' } }, configuration, files));
    rejects('invalid_manifest', () => validateArticleManifest({ ...manifest, publication_plan: { ...manifest.publication_plan,
      policy: { ...manifest.publication_plan.policy, ignore_missing_sources: true } } }, configuration, files));
  });
});

describe('source body checks apply before rendering', () => {
  it('rejects empty, comment-only and generation-error bodies', () => {
    for (const body of ['', ' \n\t', '<!-- empty -->', '{/* empty */}', 'Unable to Generate Article', 'Missing Source Data', 'No reliable source was collected', 'Failed to generate the output', 'Error generating the output']) expect(() => parseArticleSource(article('en', body))).toThrow(/empty|placeholder/);
  });
  it('preserves valid Markdown, BOM frontmatter and literal comparison text', () => {
    expect(parseArticleSource('\uFEFF' + article('en', '## Example\n\nUse a value &lt;5 in this synthetic fixture.')).body).toContain('&lt;5');
    expect(() => parseArticleSource(article('en', '## Example\n\nUse <5.'))).toThrow('Escape numeric comparisons');
  });
});

const temporaryRoots: string[] = [];
afterEach(() => { for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function writeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'wiki-import-fixture-')); temporaryRoots.push(root);
  const data = fixture();
  writeFileSync(join(root, 'article-manifest.json'), JSON.stringify(data.manifest));
  for (const file of data.files) { const path = join(root, 'src/content/wiki', file.path); mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, file.bytes); }
  return { root, ...data };
}
describe('filesystem import boundary', () => {
  it('requires the default root manifest for production and reports the accepted count', () => {
    const { root } = writeFixture();
    expect(checkArticleImport(root, configuration)).toMatchObject({ gate: 'pass', production_ready: true, imported_articles: 2,
      manifest_sha256: sha256(readFileSync(join(root, 'article-manifest.json'))) });
    rmSync(join(root, 'article-manifest.json'));
    rejects('invalid_import', () => checkArticleImport(root, configuration));
  });
  it('keeps demo checks independent without reporting production readiness', () => {
    expect(checkArticleImport('/unused-demo-fixture', { ...configuration, demo: true })).toEqual({ schema_version: 1, contract: ARTICLE_CONTRACT, gate: 'demo', production_ready: false });
  });
  it('reports partial coverage and plan bindings without claiming all original keywords are complete', () => {
    const { root } = writeFixture();
    const { manifest } = evidenceFixture();
    writeFileSync(join(root, 'article-manifest.json'), JSON.stringify(manifest));
    expect(checkArticleImport(root, configuration)).toMatchObject({ schema_version: 2,
      contract: EVIDENCE_ARTICLE_CONTRACT, mode: 'evidence_based', gate: 'pass', production_ready: true,
      source_scope: 'selected', coverage: 'partial', candidate_keywords: 2, selected_keywords: 1,
      deferred_keywords: 1, required_keywords: 1, imported_articles: 2,
      publication_plan_sha256: manifest.publication_plan_sha256,
      publication_plan_file_sha256: manifest.publication_plan_file_sha256,
      policy_sha256: manifest.policy_sha256, policy_file_sha256: manifest.policy_file_sha256,
      manifest_sha256: sha256(readFileSync(join(root, 'article-manifest.json'))) });
  });
  it('cannot turn a deferred keyword into a placeholder file through filesystem import', () => {
    const { root } = writeFixture();
    const { manifest } = evidenceFixture();
    writeFileSync(join(root, 'article-manifest.json'), JSON.stringify(manifest));
    const path = join(root, 'src/content/wiki/en/story/fixture-game-ending.mdx');
    mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, article('deferred'));
    rejects('unexpected_import', () => checkArticleImport(root, configuration));
  });
  it('rejects duplicate v2 JSON keys at every depth including escaped aliases', () => {
    const { root } = writeFixture();
    const { manifest } = evidenceFixture();
    const source = JSON.stringify(manifest);
    for (const changed of [
      source.replace('"schema_version":2', '"schema_version":2,"schema_version":2'),
      source.replace('"min_selected_keywords":1', '"min_selected_keywords":1,"min_selected_key\\u0077ords":1'),
      source.replace('"completed_rounds":3', '"completed_rounds":3,"completed_rounds":3'),
      source.replace('"coverage":"partial"', '"coverage":"partial","cov\\u0065rage":"partial"'),
    ]) {
      writeFileSync(join(root, 'article-manifest.json'), changed);
      rejects('duplicate_manifest_key', () => checkArticleImport(root, configuration));
    }
  });
  it('keeps punctuation and escaped quotes inside JSON values out of duplicate-key detection', () => {
    const { root } = writeFixture();
    const data = evidenceFixture();
    data.manifest.publication_plan.deferred[0].source_gate_reason = 'literal "key": 1, {"key": 2}, [3] \\ text';
    sealPlan(data);
    writeFileSync(join(root, 'article-manifest.json'), JSON.stringify(data.manifest));
    expect(checkArticleImport(root, configuration)).toMatchObject({ gate: 'pass', coverage: 'partial' });
  });
  it('rejects a symlinked manifest, file, or directory instead of following or ignoring it', () => {
    for (const target of ['article-manifest.json', 'src/content/wiki/en/guides/fixture-game-tips.mdx', 'src/content/wiki/pt-br']) {
      const { root } = writeFixture();
      const path = join(root, target);
      const replacement = join(root, 'replacement');
      if (target.endsWith('.json') || target.endsWith('.mdx')) writeFileSync(replacement, readFileSync(path));
      else mkdirSync(replacement);
      rmSync(path, { recursive: true }); symlinkSync(replacement, path);
      rejects('unsafe_import_path', () => checkArticleImport(root, configuration));
    }
  });
  it('rejects symlinked ancestors of the content tree', () => {
    const { root } = writeFixture();
    rmSync(join(root, 'src'), { recursive: true });
    const replacement = join(root, 'replacement'); mkdirSync(replacement); symlinkSync(replacement, join(root, 'src'));
    rejects('unsafe_import_path', () => checkArticleImport(root, configuration));
  });
  it('rejects a symlinked ancestor of the project root', () => {
    const { root } = writeFixture();
    const alias = join(root, 'alias'); symlinkSync(root, alias);
    mkdirSync(join(root, 'nested'));
    rejects('unsafe_import_path', () => checkArticleImport(join(alias, 'nested'), configuration));
  });
  it('rejects non-UTF-8 manifest bytes without replacing undecodable characters', () => {
    const { root } = writeFixture();
    writeFileSync(join(root, 'article-manifest.json'), Buffer.from([0xff, 0xfe]));
    rejects('invalid_import', () => checkArticleImport(root, configuration));
  });
  it('enumerates exact original bytes and fails on extra imported files', () => {
    const { root, files } = writeFixture();
    expect(readImportedFiles(join(root, 'src/content/wiki')).map(file => [file.path, sha256(file.bytes)])).toEqual(files.map(file => [file.path, sha256(file.bytes)]));
    writeFileSync(join(root, 'src/content/wiki/en/guides/demo.mdx'), article('demo'));
    rejects('unexpected_import', () => checkArticleImport(root, configuration));
  });
  it('does not silently ignore an extra uppercase MDX file', () => {
    const { root } = writeFixture();
    writeFileSync(join(root, 'src/content/wiki/en/guides/demo.MDX'), article('demo'));
    rejects('unexpected_import', () => checkArticleImport(root, configuration));
  });
});
