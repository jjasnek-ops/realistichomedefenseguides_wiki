import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { ARTICLE_CONTRACT, ImportContractError, sha256, validateArticleManifest, type ImportConfig, type ImportedFile } from './import-contract';

/** Reject links before following any path within the project import boundary. */
function checkedPath(root: string, parts: readonly string[]) {
  for (let ancestor = root; ; ancestor = dirname(ancestor)) {
    if (lstatSync(ancestor).isSymbolicLink()) throw new ImportContractError('unsafe_import_path', `Symbolic links are not allowed in the import boundary: ${ancestor}`);
    if (dirname(ancestor) === ancestor) break;
  }
  let path = root;
  for (const part of ['', ...parts]) {
    if (part) path = join(path, part);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new ImportContractError('unsafe_import_path', `Symbolic links are not allowed in the import boundary: ${path}`);
  }
  return path;
}

export function readImportedFiles(root: string): ImportedFile[] {
  const files: ImportedFile[] = [];
  function visit(parts: string[]) {
    const directory = checkedPath(root, parts);
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = [...parts, entry.name];
      if (entry.isSymbolicLink() || entry.name.includes('\\')) throw new ImportContractError('unsafe_import_path', `Unsafe entry in imported articles: ${path.join('/')}`);
      if (entry.isDirectory()) visit(path);
      else if (entry.name.toLowerCase().endsWith('.mdx')) {
        const filename = checkedPath(root, path);
        if (!lstatSync(filename).isFile()) throw new ImportContractError('unsafe_import_path', `Not a regular article file: ${path.join('/')}`);
        files.push({ path: path.join('/'), bytes: readFileSync(filename) });
      }
    }
  }
  visit([]);
  return files;
}

/** JSON.parse first validates syntax; this token scan rejects ambiguous v2 object keys. */
function rejectDuplicateJsonKeys(source: string) {
  const stack: Array<{ keys: Set<string>; expectingKey: boolean } | null> = [];
  for (const [token] of source.matchAll(/"(?:\\[\s\S]|[^"\\])*"|[{}\[\],]/g)) {
    if (token === '{') stack.push({ keys: new Set(), expectingKey: true });
    else if (token === '[') stack.push(null);
    else if (token === '}' || token === ']') stack.pop();
    else if (token === ',') {
      const parent = stack.at(-1);
      if (parent) parent.expectingKey = true;
    } else {
      const parent = stack.at(-1);
      if (parent?.expectingKey) {
        const key = JSON.parse(token) as string;
        if (parent.keys.has(key)) throw new ImportContractError('duplicate_manifest_key', `Duplicate JSON object key in the v2 manifest: ${key}`);
        parent.keys.add(key); parent.expectingKey = false;
      }
    }
  }
}

export function checkArticleImport(projectDir: string, config: ImportConfig) {
  if (config.demo) return { schema_version: 1, contract: ARTICLE_CONTRACT, gate: 'demo', production_ready: false } as const;
  const root = resolve(projectDir);
  try {
    const manifestPath = checkedPath(root, ['article-manifest.json']);
    if (!lstatSync(manifestPath).isFile()) throw new ImportContractError('invalid_manifest', 'article-manifest.json must be a regular file.');
    const contentRoot = checkedPath(root, ['src', 'content', 'wiki']);
    const manifestBytes = readFileSync(manifestPath);
    const manifestText = new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes);
    const raw: unknown = JSON.parse(manifestText);
    if (raw && typeof raw === 'object' && 'schema_version' in raw && raw.schema_version === 2) rejectDuplicateJsonKeys(manifestText);
    const manifest = validateArticleManifest(raw, config, readImportedFiles(contentRoot));
    const report = { schema_version: manifest.schema_version, contract: manifest.contract, gate: 'pass', production_ready: true,
      topic: manifest.topic, required_keywords: manifest.required_keywords, imported_articles: manifest.articles.length,
      languages: manifest.languages, keywords_sha256: manifest.keywords_sha256, profile_sha256: manifest.profile_sha256,
      profile_file_sha256: manifest.profile_file_sha256, validator_version: manifest.validator_version,
      manifest_sha256: sha256(manifestBytes) } as const;
    if (manifest.schema_version === 2) return { ...report, mode: manifest.mode, source_scope: 'selected',
      coverage: manifest.coverage, candidate_keywords: manifest.candidate_keywords,
      selected_keywords: manifest.selected_keywords, deferred_keywords: manifest.deferred_keywords,
      policy_sha256: manifest.policy_sha256, policy_file_sha256: manifest.policy_file_sha256,
      publication_plan_sha256: manifest.publication_plan_sha256,
      publication_plan_file_sha256: manifest.publication_plan_file_sha256 } as const;
    return report;
  } catch (error) {
    if (error instanceof ImportContractError) throw error;
    throw new ImportContractError('invalid_import', `Cannot verify the required article-manifest.json and content tree: ${error instanceof Error ? error.message : String(error)}`);
  }
}
