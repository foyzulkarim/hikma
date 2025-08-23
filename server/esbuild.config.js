import { build } from 'esbuild';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read tsconfig.json to get path mappings
const tsconfig = JSON.parse(readFileSync('./tsconfig.json', 'utf8'));
const paths = tsconfig.compilerOptions.paths || {};

// Convert TypeScript path mappings to esbuild aliases
const alias = {};
for (const [key, value] of Object.entries(paths)) {
  const aliasKey = key.replace('/*', '');
  const aliasValue = resolve(__dirname, value[0].replace('/*', ''));
  alias[aliasKey] = aliasValue;
}

const buildOptions = {
  entryPoints: ['src/server.ts'],
  bundle: true,
  outdir: 'dist',
  platform: 'node',
  target: 'es2022',
  format: 'esm',
  sourcemap: true,
  alias,
  external: [
    // Mark all node_modules as external
    '@fastify/*',
    'fastify',
    'dotenv',
    'prisma',
    '@prisma/*',
    // Add other external dependencies as needed
  ],
  loader: {
    '.ts': 'ts',
  },
  resolveExtensions: ['.ts', '.js'],
  tsconfig: './tsconfig.json',
};

// Build function
export async function buildProject() {
  try {
    console.log('Building with esbuild...');
    await build(buildOptions);
    console.log('Build completed successfully!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

// Run build if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  buildProject();
}