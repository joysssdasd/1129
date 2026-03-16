import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');
const SUPABASE_FUNCTIONS_DIR = path.join(ROOT, 'supabase', 'functions');
const MANIFEST_PATH = path.join(ROOT, 'edge-functions.manifest.json');

function walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }

    if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function extractInvocations(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const regex = /functions\.invoke\(\s*['"`]([^'"`]+)['"`]/g;
  const items = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    const rawName = match[1];
    const normalizedName = rawName.split('?')[0];
    const line = content.slice(0, match.index).split('\n').length;

    items.push({
      file: path.relative(ROOT, filePath),
      line,
      rawName,
      normalizedName,
    });
  }

  return items;
}

function readManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(`Manifest not found: ${MANIFEST_PATH}`);
  }

  const raw = fs.readFileSync(MANIFEST_PATH, 'utf8').replace(/^\uFEFF/, '');
  const json = JSON.parse(raw);
  if (!Array.isArray(json.functions)) {
    throw new Error('Manifest format invalid: "functions" must be an array');
  }

  const map = new Map();
  for (const item of json.functions) {
    if (!item?.name || !item?.source) {
      throw new Error('Manifest entry must contain "name" and "source"');
    }
    if (map.has(item.name)) {
      throw new Error(`Duplicate function in manifest: ${item.name}`);
    }
    map.set(item.name, item);
  }

  return map;
}

function readLocalFunctionDirs() {
  if (!fs.existsSync(SUPABASE_FUNCTIONS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(SUPABASE_FUNCTIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== '_shared')
    .map((d) => d.name)
    .sort();
}

function main() {
  const manifest = readManifest();
  const localDirs = readLocalFunctionDirs();
  const localSet = new Set(localDirs);

  const sourceFiles = walkFiles(SRC_DIR);
  const invocations = sourceFiles.flatMap(extractInvocations);
  const invokedNames = [...new Set(invocations.map((x) => x.normalizedName))].sort();

  const errors = [];
  const warnings = [];

  for (const invocation of invocations) {
    if (invocation.rawName.includes('?')) {
      warnings.push(
        `${invocation.file}:${invocation.line} uses query string in function name: ${invocation.rawName}`
      );
    }
  }

  for (const name of invokedNames) {
    if (!manifest.has(name)) {
      errors.push(`Invoked function missing in manifest: ${name}`);
      continue;
    }

    const entry = manifest.get(name);
    if (entry.source === 'repo' && !localSet.has(name)) {
      errors.push(`Manifest says repo function but folder is missing: ${name}`);
    }
  }

  for (const [name, entry] of manifest.entries()) {
    if (entry.source === 'repo' && !localSet.has(name)) {
      errors.push(`Repo function in manifest has no local implementation folder: ${name}`);
    }
  }

  for (const dir of localDirs) {
    if (!manifest.has(dir)) {
      errors.push(`Local function folder missing in manifest: ${dir}`);
    }
  }

  const manifestUnused = [...manifest.keys()].filter((name) => !invokedNames.includes(name)).sort();

  console.log('Edge function consistency report');
  console.log('--------------------------------');
  console.log(`Invoked in src: ${invokedNames.length}`);
  console.log(`Manifest entries: ${manifest.size}`);
  console.log(`Local function folders: ${localDirs.length}`);

  if (warnings.length) {
    console.log('\nWarnings:');
    for (const item of warnings) {
      console.log(`- ${item}`);
    }
  }

  if (manifestUnused.length) {
    console.log('\nManifest entries not currently invoked:');
    for (const name of manifestUnused) {
      console.log(`- ${name}`);
    }
  }

  if (errors.length) {
    console.error('\nErrors:');
    for (const item of errors) {
      console.error(`- ${item}`);
    }
    process.exit(1);
  }

  console.log('\nNo consistency errors found.');
}

main();
