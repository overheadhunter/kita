import { defineConfig } from 'vitest/config'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'

// separate from vite.config.ts, so the Cloudflare dev-server plugin does not start during tests
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['shared/**/*.test.ts', 'src/**/*.test.ts'],
        },
      },
      {
        plugins: [
          cloudflareTest(async () => ({
            wrangler: { configPath: './wrangler.jsonc' },
            miniflare: {
              // fixed secret instead of .dev.vars, so tests do not depend on local configuration
              bindings: {
                STAFF_TOKEN: 'staff-token',
                TEST_MIGRATIONS: await readD1Migrations('migrations'),
              },
            },
          })),
        ],
        test: {
          name: 'worker',
          include: ['worker/**/*.test.ts'],
          setupFiles: ['worker/test/apply-migrations.ts'],
        },
      },
    ],
  },
})
