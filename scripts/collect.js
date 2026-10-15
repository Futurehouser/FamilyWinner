// Copia el exe portable y el APK a release/ con los nombres que espera el auto-updater.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'release');
fs.mkdirSync(out, { recursive: true });

const files = [
  [path.join(root, 'dist', 'FamilyWinner-Portable.exe'), 'FamilyWinner-Portable.exe'],
  [path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'), 'FamilyWinner.apk']
];
for (const [src, name] of files) {
  if (!fs.existsSync(src)) { console.error('Falta ' + src); process.exitCode = 1; continue; }
  fs.copyFileSync(src, path.join(out, name));
  console.log('release/' + name);
}
