import { defineConfig } from 'tsup';

export default defineConfig([
  // Core (framework-agnostic)
  {
    entry: { index: 'src/index.ts' },
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,
    outDir: 'dist',
    external: ['@nestjs/common', '@nestjs/core', '@nestjs/config'],
    esbuildOptions(options) {
      options.banner = {
        js: '"use strict";',
      };
    },
  },
  // NestJS integration (separate entry point)
  {
    entry: { index: 'src/nestjs/index.ts' },
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    splitting: false,
    outDir: 'dist/nestjs',
    external: ['@nestjs/common', '@nestjs/core', '@nestjs/config', 'handlebars', 'nodemailer'],
  },
]);
