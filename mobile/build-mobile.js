const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const wwwDir = path.join(__dirname, 'www');
if (!fs.existsSync(wwwDir)) {
  fs.mkdirSync(wwwDir, { recursive: true });
}

console.log('📦 Building mobile web bundle...');

esbuild.build({
  entryPoints: [path.join(__dirname, 'src', 'mobile-app.js')],
  bundle: true,
  outfile: path.join(wwwDir, 'mobile-bundle.js'),
  minify: true,
  sourcemap: false,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
}).then(() => {
  // Copy static files
  fs.copyFileSync(path.join(__dirname, 'src', 'index.html'), path.join(wwwDir, 'index.html'));
  fs.copyFileSync(path.join(__dirname, 'src', 'ar.html'), path.join(wwwDir, 'ar.html'));
  fs.copyFileSync(path.join(__dirname, 'src', 'mobile-viewer.css'), path.join(wwwDir, 'mobile-viewer.css'));
  console.log('✅ Mobile bundle created successfully in mobile/www/');
}).catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
