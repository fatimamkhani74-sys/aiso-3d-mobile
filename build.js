const esbuild = require('esbuild');

console.log('Building bundle.js...');
esbuild.build({
  entryPoints: ['viewer.js'],
  bundle: true,
  outfile: 'bundle.js',
  format: 'esm',
  target: ['chrome120'],
  loader: { '.png': 'dataurl', '.hdr': 'file' }
}).then(() => console.log('✅ Bundle built successfully!'))
  .catch(err => {
    console.error('❌ Bundle build failed:', err);
    process.exit(1);
  });
