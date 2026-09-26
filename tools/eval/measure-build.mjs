import { spawn } from 'node:child_process'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const dist = path.join(root, 'dist')
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')

async function listFiles(dir) {
  const files = []
  let entries = []
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return files
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...await listFiles(full))
    else files.push(full)
  }
  return files
}

function looksMinified(source) {
  if (!source || source.length < 80) return false
  const lineCount = source.split('\n').length
  const averageLine = source.length / lineCount
  const whitespace = (source.match(/\s/g) || []).length / source.length
  return averageLine >= 180 || whitespace < 0.12
}

function runBuild() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [viteBin, 'build'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    })
    const stderr = []
    child.stderr.on('data', (chunk) => {
      stderr.push(chunk)
    })
    child.on('error', () => resolve({ code: 1, stderr: 'failed to start vite' }))
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stderr: Buffer.concat(stderr).toString('utf8') })
    })
  })
}

const started = performance.now()
const build = await runBuild()
const buildSeconds = Math.round(((performance.now() - started) / 1000) * 1000) / 1000

const files = await listFiles(dist)
let indexHtmlPresent = 0
let cssBytes = 0
let jsBytes = 0
let jsAssetCount = 0
let jsMinified = 1

for (const file of files) {
  const rel = path.relative(dist, file)
  const info = await stat(file)
  if (rel === 'index.html') indexHtmlPresent = 1
  if (file.endsWith('.css')) cssBytes += info.size
  if (file.endsWith('.js')) {
    jsAssetCount += 1
    jsBytes += info.size
    if (info.size >= 80) {
      const source = await readFile(file, 'utf8')
      if (!looksMinified(source)) jsMinified = 0
    }
  }
}

if (jsAssetCount === 0) jsMinified = 0

const result = {
  build_seconds: buildSeconds,
  build_passed: build.code === 0 ? 1 : 0,
  index_html_present: indexHtmlPresent,
  js_asset_count: jsAssetCount,
  css_bytes: cssBytes,
  js_minified: jsMinified,
  js_bytes: jsBytes,
  asset_count: files.length,
}

process.stdout.write(`${JSON.stringify(result)}\n`)
if (build.code !== 0) {
  process.stderr.write(build.stderr)
}
