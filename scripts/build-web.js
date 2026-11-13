// Builds Edita's web view into ui/ (bundled editor, page, images) and writes src/generated/licenses.json
// for Help > License & Attribution: Edita's own licence plus every JavaScript package that ends up in the
// bundle and every Rust crate compiled into Edita.exe. Run by `pnpm run build:web` (and by tauri build/dev).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..');
const ui = path.join(root, 'ui');
const generated = path.join(root, 'src', 'generated');
const licensesFile = path.join(generated, 'licenses.json');
const LICENSE_FILE = /^(licen[cs]e|copying)([.-].*)?$/i;

const bundle = (metafile) => esbuild.build({
  entryPoints: [path.join(root, 'src', 'renderer.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'chrome120',
  outfile: path.join(ui, 'renderer.js'),
  metafile,
  logLevel: 'warning',
});

function licenseText(dir, files) {
  const names = files || fs.readdirSync(dir).filter((f) => LICENSE_FILE.test(f)).sort();
  return names.map((f) => {
    try { return fs.readFileSync(path.join(dir, f), 'utf8').trim(); } catch { return ''; }
  }).filter(Boolean).join('\n\n----------\n\n');
}

// JavaScript packages whose code is in the bundle (from esbuild's list of input files).
function jsPackages(meta) {
  const dirs = new Set();
  for (const input of Object.keys(meta.inputs)) {
    const m = /^(.*node_modules[\\/](?:@[^\\/]+[\\/])?[^\\/]+)[\\/]/.exec(input.replace(/^\.pnpm/, 'node_modules/.pnpm'));
    if (m) dirs.add(path.resolve(root, m[1]));
  }
  return [...dirs].map((dir) => {
    const json = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    return {
      name: json.name,
      version: json.version,
      license: typeof json.license === 'string' ? json.license : (json.license && json.license.type) || 'see text',
      homepage: json.homepage || '',
      text: licenseText(dir),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

// Rust crates linked into Edita.exe on Windows (normal dependencies; not build tools or macros).
function rustCrates(texts) {
  const meta = JSON.parse(execFileSync('cargo', ['metadata', '--format-version', '1', '--filter-platform',
    'x86_64-pc-windows-msvc', '--manifest-path', path.join(root, 'src-tauri', 'Cargo.toml')],
  { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }));
  const byId = new Map(meta.packages.map((p) => [p.id, p]));
  const nodes = new Map(meta.resolve.nodes.map((n) => [n.id, n]));
  const seen = new Set();
  const queue = [meta.resolve.root];
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    for (const dep of nodes.get(id).deps) {
      if (!dep.dep_kinds.some((k) => k.kind === null)) continue;
      const pkg = byId.get(dep.pkg);
      if (pkg.targets.every((t) => t.kind.includes('proc-macro'))) continue;
      queue.push(dep.pkg);
    }
  }
  seen.delete(meta.resolve.root);
  return [...seen].map((id) => byId.get(id)).map((p) => {
    const dir = path.dirname(p.manifest_path);
    const text = p.license_file ? licenseText(dir, [p.license_file]) : licenseText(dir);
    let textId = -1;
    if (text) {
      textId = texts.indexOf(text);
      if (textId < 0) textId = texts.push(text) - 1;
    }
    return { name: p.name, version: p.version, license: p.license || 'see text', homepage: p.repository || p.homepage || '', textId };
  }).sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
}

(async () => {
  fs.mkdirSync(generated, { recursive: true });
  if (!fs.existsSync(licensesFile)) fs.writeFileSync(licensesFile, '{"edita":{},"packages":[],"crates":[],"texts":[]}');
  const first = await bundle(true);

  const pkg = require(path.join(root, 'package.json'));
  const texts = [];
  const crates = rustCrates(texts);
  const licenses = {
    edita: {
      license: pkg.license,
      notice: fs.readFileSync(path.join(root, 'NOTICE'), 'utf8').trim(),
      text: fs.readFileSync(path.join(root, 'LICENSE'), 'utf8').trim(),
    },
    packages: jsPackages(first.metafile),
    crates,
    texts,
  };
  fs.writeFileSync(licensesFile, JSON.stringify(licenses));
  await bundle(false);

  fs.mkdirSync(path.join(ui, 'assets'), { recursive: true });
  fs.copyFileSync(path.join(root, 'src', 'index.html'), path.join(ui, 'index.html'));
  // Edita's own logo (About box) and the Vidyasagar Robotics Academy logo (Help windows).
  fs.copyFileSync(path.join(root, 'assets', 'icon.png'), path.join(ui, 'assets', 'icon.png'));
  fs.copyFileSync(path.join(root, 'logo.png'), path.join(ui, 'assets', 'vra-logo.png'));
  const size = fs.statSync(path.join(ui, 'renderer.js')).size;
  console.log(`ui/ built: renderer.js ${(size / 1024).toFixed(0)} KB; licences: ${licenses.packages.length} packages, ${crates.length} crates`);
})().catch((err) => { console.error(err); process.exit(1); });
