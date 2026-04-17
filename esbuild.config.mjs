import esbuild from 'esbuild';
import { builtinModules } from 'module';

const prod = process.argv[2] === 'production';

const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: [
    'obsidian',
    'electron',
    ...builtinModules,
    ...builtinModules.map(m => `node:${m}`),
  ],
  format: 'cjs',
  target: 'es2020',
  logLevel: 'info',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  outfile: 'main.js',
});

if (prod) {
  await context.rebuild();
  await context.dispose();
  process.exit(0);
} else {
  await context.watch();
  console.log('watching...');
}
