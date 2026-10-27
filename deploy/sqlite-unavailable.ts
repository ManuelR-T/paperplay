/** Cloudflare uses D1. This sentinel must never become a hidden local quota fallback. */
export class DatabaseSync {
  constructor() { throw new Error('Local SQLite is unavailable in this Worker. Inject the shared D1 quota store.'); }
}
