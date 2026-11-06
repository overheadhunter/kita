import type { D1Migration } from 'cloudflare:test'

// bindings only present in tests, see vitest.config.ts
declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[]
    }
  }
}
