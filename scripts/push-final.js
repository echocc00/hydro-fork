const fs = require('fs')
const path = require('path')

const TOKEN = process.env.GH_TOKEN
const OWNER = 'echocc00'
const REPO = 'js001'
const BASE = `https://api.github.com/repos/${OWNER}/${REPO}`
const AUTH = { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }

async function api(method, url, body) {
  const opts = { method, headers: { ...AUTH } }
  if (body) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  const resp = await fetch(url, opts)
  const text = await resp.text()
  if (!resp.ok) {
    console.error(`${method} ${url.split('/').slice(-2).join('/')}: ${resp.status}`)
    console.error(text.substring(0, 300))
    return null
  }
  return JSON.parse(text)
}

async function getMasterSha() {
  const ref = await api('GET', `${BASE}/git/refs/heads/master`)
  console.log('Remote master:', ref.object.sha)
  return ref.object.sha
}

async function getTreeSha(commitSha) {
  const commit = await api('GET', `${BASE}/git/commits/${commitSha}`)
  return commit.tree.sha
}

async function createBlob(content) {
  const result = await api('POST', `${BASE}/git/blobs`, {
    content: Buffer.from(content).toString('base64'),
    encoding: 'base64'
  })
  return result.sha
}

const DIR = 'F:/codex/js001/Hydro'
const FILES = [
  'AGENTS.md',
  '.versionrc',
  'CHANGELOG.md',
  'scripts/deploy.sh',
  'scripts/backup.sh',
  'scripts/rollback.sh',
  'scripts/push.js',
  'scripts/push-api.js',
  'scripts/push-full.js',
  'package.json',
  '.gitignore',
]

async function main() {
  const masterSha = await getMasterSha()
  const baseTreeSha = await getTreeSha(masterSha)
  console.log('Base tree:', baseTreeSha)
  
  // Create blobs for all files
  const treeEntries = []
  for (const file of FILES) {
    const filePath = path.join(DIR, file)
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8')
      const sha = await createBlob(content)
      console.log(`  Blob ${file}: ${sha.substring(0,7)}`)
      treeEntries.push({
        path: file.replace(/\\/g, '/'),
        mode: '100644',
        type: 'blob',
        sha
      })
    }
  }
  
  // Create tree: ONLY include new files, use base_tree for the rest
  console.log(`Creating tree with ${treeEntries.length} entries on base ${baseTreeSha.substring(0,7)}...`)
  const newTree = await api('POST', `${BASE}/git/trees`, {
    base_tree: baseTreeSha,
    tree: treeEntries
  })
  if (!newTree) { process.exit(1) }
  console.log('New tree:', newTree.sha)
  
  // Create commit
  const newCommit = await api('POST', `${BASE}/git/commits`, {
    message: 'chore: add dev tooling (AGENTS.md, scripts, version management)',
    tree: newTree.sha,
    parents: [masterSha],
    author: { name: 'echocc00', email: '286043314+echocc00@users.noreply.github.com' }
  })
  if (!newCommit) { process.exit(1) }
  console.log('New commit:', newCommit.sha)
  
  // Update master
  await api('PATCH', `${BASE}/git/refs/heads/master`, { sha: newCommit.sha, force: false })
  console.log('Master updated')
  
  // Create base-deploy
  const refResult = await api('POST', `${BASE}/git/refs`, {
    ref: 'refs/heads/base-deploy',
    sha: newCommit.sha
  })
  if (refResult) console.log('base-deploy created:', refResult.ref)
  
  console.log('DONE')
}

main().catch(e => console.error('Fatal:', e.message))
