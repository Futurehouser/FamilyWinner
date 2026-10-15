// Prepara www/: copia las cartas y el icono, escribe la versión y la propaga a Android.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const www = path.join(root, 'www');

// Cartas
const src = path.join(root, 'Cards');
const dst = path.join(www, 'cards');
fs.mkdirSync(dst, { recursive: true });
const cards = fs.readdirSync(src).filter(f => /\.jpe?g$/i.test(f));
for (const f of cards) fs.copyFileSync(path.join(src, f), path.join(dst, f.toLowerCase()));
if (cards.length !== 42) console.warn(`Aviso: se esperaban 42 cartas y hay ${cards.length}`);

// Icono
fs.copyFileSync(path.join(root, 'build', 'icon.png'), path.join(www, 'icon.png'));

// Versión
fs.writeFileSync(path.join(www, 'js', 'version.js'), `window.FW_VERSION = '${pkg.version}';\n`);

// Versión de Android (versionCode = mayor*10000 + menor*100 + parche)
const gradle = path.join(root, 'android', 'app', 'build.gradle');
if (fs.existsSync(gradle)) {
  const [ma, mi, pa] = pkg.version.split('.').map(n => parseInt(n, 10) || 0);
  const code = ma * 10000 + mi * 100 + pa;
  let g = fs.readFileSync(gradle, 'utf8');
  g = g.replace(/versionCode \d+/, `versionCode ${code}`).replace(/versionName "[^"]*"/, `versionName "${pkg.version}"`);
  fs.writeFileSync(gradle, g);
}

console.log(`www sincronizado: ${cards.length} cartas, v${pkg.version}`);
