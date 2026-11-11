const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const tempDir = path.join(rootDir, 'temp_build');
const extDir = path.resolve(rootDir, '../extension');

console.log('1. Building dashboard...');
execSync('npx vite build --outDir temp_build --emptyOutDir true', { stdio: 'inherit', cwd: rootDir });

console.log('2. Building content script...');
execSync('npx vite build -c vite.content.config.js --outDir temp_build/content_temp --emptyOutDir true', { stdio: 'inherit', cwd: rootDir });

console.log('3. Deploying updated files to extension directory...');
function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const item of fs.readdirSync(src)) {
      copyRecursive(path.join(src, item), path.join(dest, item));
    }
  } else {
    if (src.endsWith('.png') && fs.existsSync(dest)) {
      return;
    }
    fs.copyFileSync(src, dest);
  }
}

fs.copyFileSync(path.join(tempDir, 'dashboard.bundle.js'), path.join(extDir, 'dashboard.bundle.js'));
fs.copyFileSync(path.join(tempDir, 'background.js'), path.join(extDir, 'background.js'));
fs.copyFileSync(path.join(tempDir, 'dashboard.html'), path.join(extDir, 'dashboard.html'));

copyRecursive(path.join(tempDir, 'assets'), path.join(extDir, 'assets'));

fs.copyFileSync(path.join(tempDir, 'content_temp', 'content.js'), path.join(extDir, 'content.js'));
fs.copyFileSync(path.join(tempDir, 'content_temp', 'content.css'), path.join(extDir, 'content.css'));

fs.rmSync(tempDir, { recursive: true, force: true });
console.log('Deploy completed successfully!');
