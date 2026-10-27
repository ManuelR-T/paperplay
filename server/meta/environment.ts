import 'server-only';
import { readMetaConfig } from './config';

export function serverMetaConfig() {
  return readMetaConfig(process.env);
}
