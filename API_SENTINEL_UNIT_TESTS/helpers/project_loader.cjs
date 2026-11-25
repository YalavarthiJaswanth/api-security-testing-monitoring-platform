const path = require('node:path');
const fs = require('node:fs');
const Module = require('node:module');

// Auto-detect repository root when nested inside API_SENTINEL, or fall back to workspace path
const REPO_PARENT_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_PROJECT_ROOT = fs.existsSync(path.join(REPO_PARENT_ROOT, 'backend', 'package.json'))
  ? REPO_PARENT_ROOT
  : '/Users/michael/.gemini/antigravity/scratch/api-security-testing-monitoring-platform';
const PROJECT_ROOT = process.env.API_SENTINEL_ROOT || DEFAULT_PROJECT_ROOT;

// Ensure isolated deterministic test environment variables before loading backend config
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-jwt-secret-key-do-not-use-in-prod';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
process.env.ENCRYPTION_MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY || '12345678901234567890123456789012';
process.env.SSRF_STRICT = 'true';
process.env.ALLOWED_HOSTS = 'localhost,127.0.0.1,vulnerable-lab';

const backendPkg = path.join(PROJECT_ROOT, 'backend', 'package.json');
const frontendPkg = path.join(PROJECT_ROOT, 'frontend', 'package.json');

if (!fs.existsSync(backendPkg)) {
  throw new Error(`Original project backend not found at ${PROJECT_ROOT}/backend`);
}

const backendRequire = Module.createRequire(backendPkg);
const frontendRequire = Module.createRequire(frontendPkg);

function requireBackend(relativeDistPath) {
  const fullPath = path.join(PROJECT_ROOT, 'backend', 'dist', relativeDistPath);
  return backendRequire(fullPath);
}

/**
 * Transpiles and evaluates a TypeScript / TSX file from frontend/src in memory
 * without touching or writing any files in the original project directory.
 */
function loadFrontendModule(relativeSrcPath, moduleOverrides = {}) {
  const ts = frontendRequire('typescript');
  const fullPath = path.join(PROJECT_ROOT, 'frontend', 'src', relativeSrcPath);
  const sourceCode = fs.readFileSync(fullPath, 'utf8');

  const transpiled = ts.transpileModule(sourceCode, {
    fileName: fullPath,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true
    }
  });

  const mod = { exports: {} };
  const customRequire = (specifier) => {
    if (Object.prototype.hasOwnProperty.call(moduleOverrides, specifier)) {
      return moduleOverrides[specifier];
    }
    return frontendRequire(specifier);
  };

  const fn = new Function('exports', 'require', 'module', '__filename', '__dirname', transpiled.outputText);
  fn(mod.exports, customRequire, mod, fullPath, path.dirname(fullPath));
  return mod.exports;
}

module.exports = {
  PROJECT_ROOT,
  backendRequire,
  frontendRequire,
  requireBackend,
  loadFrontendModule
};
