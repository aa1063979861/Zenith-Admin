const fs = require('node:fs')
const path = require('node:path')

const serverRoot = path.resolve(__dirname, '..')
const sourceRoot = path.join(serverRoot, 'src')
const seedFile = path.join(sourceRoot, 'database', 'database-seed.service.ts')

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath, files)
      continue
    }
    if (entry.name.endsWith('.ts'))
      files.push(fullPath)
  }
  return files
}

function quotedValues(text) {
  return [...text.matchAll(/'([^']+)'/g)].map(match => match[1])
}

const seedSource = fs.readFileSync(seedFile, 'utf8')
const seedCodes = [...seedSource.matchAll(/\bcode:\s*'([^']+)'/g)].map(match => match[1])
const seedCodeSet = new Set(seedCodes)
const duplicatedSeedCodes = [...new Set(seedCodes.filter((code, index) => seedCodes.indexOf(code) !== index))].sort()

const missing = []
for (const file of walk(sourceRoot)) {
  const source = fs.readFileSync(file, 'utf8')
  for (const match of source.matchAll(/@Require(?:All)?Permissions\(([\s\S]*?)\)/g)) {
    for (const code of quotedValues(match[1])) {
      if (!seedCodeSet.has(code)) {
        missing.push({
          file: path.relative(serverRoot, file).replace(/\\/g, '/'),
          code,
        })
      }
    }
  }
}

if (duplicatedSeedCodes.length || missing.length) {
  if (duplicatedSeedCodes.length)
    console.error(`重复的种子权限编码：${duplicatedSeedCodes.join(', ')}`)
  if (missing.length) {
    console.error('接口引用了未在种子数据中声明的权限编码：')
    for (const item of missing)
      console.error(`- ${item.file}: ${item.code}`)
  }
  process.exit(1)
}

console.log(`permission checks passed (${seedCodeSet.size} seed codes)`)
