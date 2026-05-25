/**
 * scripts/build-with-env.cjs
 * Carrega .env.build e executa electron-builder com as variáveis injetadas.
 * Uso: node scripts/build-with-env.cjs [-- ...electron-builder args]
 */

const fs   = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const envFile = path.join(__dirname, '..', '.env.build')
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    process.env[key] = val
  }
  console.log('[build-with-env] .env.build carregado — credenciais embutidas no build')
} else {
  console.warn('[build-with-env] .env.build não encontrado — build sem credenciais embutidas')
}

// Extrai args extras passados após "--"
const extraArgs = process.argv.slice(2)

const result = spawnSync(
  process.execPath,
  [
    path.join(__dirname, '..', 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js'),
    '--win', '--publish', 'always',
    ...extraArgs,
  ],
  {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, NODE_NO_WARNINGS: '1', ComSpec: process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe' },
    stdio: 'inherit',
    shell: false,
  }
)

process.exit(result.status ?? 1)
