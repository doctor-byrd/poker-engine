import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'], // Output both CommonJS and ES Modules
  dts: true,              // Automatically generate .d.ts files
  splitting: false,
  sourcemap: true,
  clean: true,            // Clean the dist folder before each build
});
