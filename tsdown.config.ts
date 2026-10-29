import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/skill-hook-entry.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node22.18',
  clean: true,
  dts: false,
});
