const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')

const scanRoots = [
  'src',
  'apps/server/src',
  'vite.config.js',
]

const ignoredDirs = new Set([
  '.git',
  '.runtime',
  'dist',
  'node_modules',
  'uploads',
])

const allowedIsInFiles = new Set([
  normalizePath('apps/server/src/modules/dictionaries/dto/create-dictionary-item.dto.ts'),
  normalizePath('apps/server/src/modules/permissions/dto/create-permission.dto.ts'),
  normalizePath('apps/server/src/modules/permissions/dto/update-permission.dto.ts'),
  normalizePath('apps/server/src/modules/system-parameters/dto/create-system-parameter.dto.ts'),
  normalizePath('apps/server/src/modules/system-parameters/dto/update-system-parameter.dto.ts'),
])

const allowedUploadsLiteralFiles = new Set([
  normalizePath('apps/server/src/common/upload.constants.ts'),
])

const rules = [
  {
    id: 'forbidden-client-system-ip',
    pattern: /202\.61\.88\.108/g,
    message: 'External client system URLs must come from system parameters.',
  },
  {
    id: 'removed-runapi-proxy',
    pattern: /runapi|https:\/\/runapi\.co/g,
    message: 'The unused runapi proxy must not be reintroduced.',
  },
  {
    id: 'all-page-size-constant',
    pattern: /pageSize:\s*100000/g,
    message: 'Use ALL_PAGE_SIZE instead of a literal 100000 page size.',
  },
  {
    id: 'upload-root-constant',
    pattern: /join\(process\.cwd\(\),\s*['"]uploads['"]/g,
    message: 'Use UPLOAD_ROOT_DIR instead of a literal uploads path segment.',
  },
  {
    id: 'upload-url-prefix-constant',
    pattern: /['"`]\/uploads\//g,
    message: 'Use UPLOAD_URL_PREFIX instead of a literal /uploads/ URL prefix.',
    allow: file => allowedUploadsLiteralFiles.has(file),
  },
  {
    id: 'business-dto-inline-is-in',
    pattern: /@IsIn\(\[/g,
    message: 'Use shared constants for @IsIn arrays; only stable platform enum DTOs are allowlisted.',
    allow: file => allowedIsInFiles.has(file),
  },
]

const files = scanRoots.flatMap(root => collectFiles(path.join(ROOT, root)))
const findings = []

for (const file of files) {
  const relativeFile = normalizePath(path.relative(ROOT, file))
  const text = fs.readFileSync(file, 'utf8')
  for (const rule of rules) {
    if (rule.allow?.(relativeFile))
      continue
    for (const match of text.matchAll(rule.pattern)) {
      const line = lineNumberAt(text, match.index || 0)
      findings.push({ rule: rule.id, file: relativeFile, line, message: rule.message })
    }
  }
}

if (findings.length) {
  console.error('Hardcoded scan failed:')
  for (const finding of findings)
    console.error(`- ${finding.file}:${finding.line} [${finding.rule}] ${finding.message}`)
  process.exit(1)
}

console.log('Hardcoded scan passed.')

function collectFiles(target) {
  if (!fs.existsSync(target))
    return []
  const stat = fs.statSync(target)
  if (stat.isFile())
    return isSourceFile(target) ? [target] : []
  const entries = fs.readdirSync(target, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name))
      continue
    const entryPath = path.join(target, entry.name)
    if (entry.isDirectory())
      files.push(...collectFiles(entryPath))
    else if (isSourceFile(entryPath))
      files.push(entryPath)
  }
  return files
}

function isSourceFile(file) {
  return /\.(?:js|cjs|mjs|ts|vue)$/.test(file)
}

function normalizePath(value) {
  return value.replace(/\\/g, '/')
}

function lineNumberAt(text, index) {
  let line = 1
  for (let i = 0; i < index; i += 1) {
    if (text.charCodeAt(i) === 10)
      line += 1
  }
  return line
}
