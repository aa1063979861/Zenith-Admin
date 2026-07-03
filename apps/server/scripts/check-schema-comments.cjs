#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const serverRoot = path.resolve(__dirname, '..')
const sourceRoot = path.join(serverRoot, 'src')
const entityRoot = path.join(sourceRoot, 'entities')
const args = new Set(process.argv.slice(2))
const shouldCheckDatabase = args.has('--db')

const cjkPattern = /[\u3400-\u9FFF]/u
const mojibakePattern = /[�鐢鍒杩鎾鏈褰閸閻鏉瑜鎴诲瀹璁鈥]|涓€|鏃堕棿|缂栫爜/u
const columnDecoratorNames = new Set([
  'Column',
  'CreateDateColumn',
  'DeleteDateColumn',
  'PrimaryGeneratedColumn',
  'UpdateDateColumn',
])

function fail(errors) {
  console.error('Schema comment check failed:')
  for (const error of errors)
    console.error(`- ${error}`)
  process.exit(1)
}

function assertChineseComment(comment, label) {
  const errors = []
  if (!comment || !comment.trim())
    errors.push(`${label} 缺少注释`)
  else if (!cjkPattern.test(comment))
    errors.push(`${label} 注释必须包含中文：${comment}`)
  if (comment && mojibakePattern.test(comment))
    errors.push(`${label} 注释疑似乱码：${comment}`)
  return errors
}

function collectFiles(dir, suffix) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory())
      files.push(...collectFiles(fullPath, suffix))
    else if (entry.isFile() && entry.name.endsWith(suffix))
      files.push(fullPath)
  }
  return files
}

function getDecorators(node) {
  if (!ts.canHaveDecorators(node))
    return []
  return ts.getDecorators(node) || []
}

function getDecoratorName(decorator) {
  const expression = decorator.expression
  const target = ts.isCallExpression(expression) ? expression.expression : expression
  if (ts.isIdentifier(target))
    return target.text
  if (ts.isPropertyAccessExpression(target))
    return target.name.text
  return null
}

function getDecorator(node, name) {
  return getDecorators(node).find(decorator => getDecoratorName(decorator) === name)
}

function getDecoratorCall(decorator) {
  if (!decorator || !ts.isCallExpression(decorator.expression))
    return null
  return decorator.expression
}

function isStringLiteralLike(node) {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
}

function propertyNameText(name) {
  if (!name)
    return null
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name))
    return name.text
  return null
}

function readStringProperty(objectLiteral, propertyName) {
  for (const property of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(property))
      continue
    if (propertyNameText(property.name) !== propertyName)
      continue
    return isStringLiteralLike(property.initializer) ? property.initializer.text : null
  }
  return null
}

function findObjectLiteralArgument(call, index) {
  const argument = call.arguments[index]
  return argument && ts.isObjectLiteralExpression(argument) ? argument : null
}

function locationOf(sourceFile, node) {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
  return `${path.relative(serverRoot, sourceFile.fileName).replace(/\\/g, '/')}:${position.line + 1}:${position.character + 1}`
}

function readEntityComment(call) {
  if (!call)
    return null
  const firstArg = call.arguments[0]
  if (!firstArg)
    return null
  if (ts.isObjectLiteralExpression(firstArg))
    return readStringProperty(firstArg, 'comment')
  return readStringProperty(findObjectLiteralArgument(call, 1) || { properties: [] }, 'comment')
}

function readColumnComment(call) {
  if (!call)
    return null
  const firstArg = findObjectLiteralArgument(call, 0)
  if (!firstArg)
    return null
  return readStringProperty(firstArg, 'comment')
}

function checkSourceComments() {
  const errors = []
  const entityFiles = collectFiles(entityRoot, '.ts')
  let entityCount = 0
  let columnCount = 0

  for (const file of entityFiles) {
    const sourceText = fs.readFileSync(file, 'utf8')
    const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true)

    function visit(node) {
      if (ts.isClassDeclaration(node)) {
        const entityDecorator = getDecorator(node, 'Entity')
        if (entityDecorator) {
          entityCount += 1
          const label = `${locationOf(sourceFile, node)} 表`
          errors.push(...assertChineseComment(readEntityComment(getDecoratorCall(entityDecorator)), label))
        }
      }

      if (ts.isPropertyDeclaration(node)) {
        for (const decorator of getDecorators(node)) {
          const name = getDecoratorName(decorator)
          if (!columnDecoratorNames.has(name))
            continue
          columnCount += 1
          const label = `${locationOf(sourceFile, node)} 字段 ${node.name.getText(sourceFile)}`
          errors.push(...assertChineseComment(readColumnComment(getDecoratorCall(decorator)), label))
        }
      }

      ts.forEachChild(node, visit)
    }

    visit(sourceFile)
    checkRawSqlComments(sourceFile, sourceText, errors)
  }

  if (errors.length)
    fail(errors)

  console.log(`Schema source comments are valid. Tables: ${entityCount}, columns: ${columnCount}.`)
}

function checkRawSqlComments(sourceFile, sourceText, errors) {
  const commentPattern = /\bCOMMENT\s*(?:=\s*)?'([^']*)'/g
  for (const match of sourceText.matchAll(commentPattern)) {
    const position = sourceFile.getLineAndCharacterOfPosition(match.index)
    const label = `${path.relative(serverRoot, sourceFile.fileName).replace(/\\/g, '/')}:${position.line + 1}:${position.character + 1} SQL注释`
    errors.push(...assertChineseComment(match[1], label))
  }
}

function loadEnv() {
  const envPath = path.join(serverRoot, '.env')
  if (!fs.existsSync(envPath))
    return {}

  const env = {}
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#'))
      continue
    const separator = trimmed.indexOf('=')
    if (separator === -1)
      continue
    env[trimmed.slice(0, separator)] = trimmed.slice(separator + 1)
  }
  return env
}

async function checkDatabaseComments() {
  const mysql = require('mysql2/promise')
  const env = { ...loadEnv(), ...process.env }
  const database = env.DB_DATABASE || 'zenith_admin'
  const connection = await mysql.createConnection({
    host: env.DB_HOST || '127.0.0.1',
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USERNAME || 'root',
    password: env.DB_PASSWORD || '',
    database,
    charset: 'utf8mb4',
  })

  try {
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME AS tableName, TABLE_COMMENT AS comment
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME`,
      [database],
    )
    const [columns] = await connection.execute(
      `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, COLUMN_COMMENT AS comment
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      [database],
    )

    const errors = []
    for (const table of tables)
      errors.push(...assertChineseComment(table.comment, `数据库表 ${table.tableName}`))
    for (const column of columns)
      errors.push(...assertChineseComment(column.comment, `数据库字段 ${column.tableName}.${column.columnName}`))

    if (errors.length)
      fail(errors)

    console.log(`Schema database comments are valid. Tables: ${tables.length}, columns: ${columns.length}.`)
  }
  finally {
    await connection.end()
  }
}

async function main() {
  checkSourceComments()
  if (shouldCheckDatabase)
    await checkDatabaseComments()
}

main().catch((error) => {
  fail([error instanceof Error ? error.message : String(error)])
})
