/* Dawaa Pharmacy deploy sanity check */
const fs = require('fs');
const path = require('path');

const required = ['package.json', 'vercel.json', 'index.html', 'src/App.tsx'];
let ok = true;
for (const file of required) {
  if (!fs.existsSync(path.join(process.cwd(), file))) {
    console.error(`Missing required file: ${file}`);
    ok = false;
  }
}

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < 22 || nodeMajor >= 23) {
  console.warn(`Warning: recommended Node.js is 22.x, current is ${process.versions.node}`);
}
if (pkg.engines?.node !== '22.x') {
  console.error('package.json engines.node must be 22.x');
  ok = false;
}
if (pkg.packageManager !== 'yarn@1.22.22') {
  console.error('package.json packageManager must be yarn@1.22.22');
  ok = false;
}

const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
if (!String(vercel.installCommand || '').includes('yarn@1.22.22')) {
  console.error('vercel.json must install with yarn@1.22.22');
  ok = false;
}
if (vercel.outputDirectory !== 'dist') {
  console.error('vercel.json outputDirectory must be dist');
  ok = false;
}
if (!ok) process.exit(1);
console.log('Dawaa deploy sanity check passed ✅');
