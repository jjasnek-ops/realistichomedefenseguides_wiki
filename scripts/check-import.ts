import { checkArticleImport } from './import-files';
import { ARTICLE_CONTRACT, EVIDENCE_ARTICLE_CONTRACT, ImportContractError } from './import-contract';

try {
  const { config } = await import('../src/lib/config');
  const report = checkArticleImport(process.cwd(), config);
  console.log(JSON.stringify(report));
  console.error(`Article import gate: ${report.gate}`);
} catch (error) {
  console.log(JSON.stringify({ schema_version: 1, contract: ARTICLE_CONTRACT, gate: 'blocked', production_ready: false,
    supported_contracts: [ARTICLE_CONTRACT, EVIDENCE_ARTICLE_CONTRACT],
    failures: [{ reason: error instanceof ImportContractError ? error.code : 'invalid_import', details: error instanceof Error ? error.message : String(error) }] }));
  console.error('Article import gate: blocked');
  process.exitCode = 1;
}
