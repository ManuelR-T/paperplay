import { AnalysisHttpError } from '../server/analysis/security';
export function getUsageStore(): never {
  throw new AnalysisHttpError(503, 'The hosted API requires its shared D1 quota store. No local or in-memory fallback is enabled.');
}
