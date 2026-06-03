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
    console.error(`${method} ${url}: ${resp.status}`)
    console.error(text.substring(0, 300))
    return null
  }
  return JSON.parse(text)
}

// Get remote master ref
async function getMasterSha() {
  const ref = await api('GET', `${BASE}/git/refs/heads/master`)
  if (!ref) {
    console.error('Cannot find remote master branch')
    process.exit(1)
  }
  console.log('Remote master:', ref.object.sha)
  return ref.object.sha
}

// Get commit and tree
async function getCommitTree(sha) {
  const commit = await api('GET', `${BASE}/git/commits/${sha}`)
  console.log('Current tree:', commit.tree.sha)
  return commit.tree.sha
}

// Create a blob
async function createBlob(content) {
  const result = await api('POST', `${BASE}/git/blobs`, {
    content: Buffer.from(content).toString('base64'),
    encoding: 'base64'
  })
  return result.sha
}

// Get existing tree
async function getTree(sha) {
  const result = await api('GET', `${BASE}/git/trees/${sha}?recursive=1`)
  return result.tree
}

// New/modified files to add
const FILES_TO_ADD = [
  'AGENTS.md',
  '.versionrc',
  'CHANGELOG.md',
  'scripts/deploy.sh',
  'scripts/backup.sh',
  'scripts/rollback.sh',
  'scripts/push.js',
  'scripts/push-api.js',
]

const DIR = 'F:/codex/js001/Hydro'

async function main() {
  // Step 1: Get remote master commit & tree
  const masterSha = await getMasterSha()
  const baseTreeSha = await getCommitTree(masterSha)
  const existingTree = await getTree(baseTreeSha)
  
  // Step 2: Create new tree entries (keep all existing + add/replace our files)
  const treeEntries = []
  
  // Keep all existing entries that we'ren't replacing
  for (const entry of existingTree) {
    if (!FILES_TO_ADD.includes(entry.path) && entry.path !== 'package.json' && entry.path !== '.gitignore') {
      treeEntries.push({
        path: entry.path,
        mode: entry.mode,
        type: entry.type,
        sha: entry.sha
      })
    }
  }
  
  // Add our new/changed files
  for (const file of FILES_TO_ADD) {
    const filePath = path.join(DIR, file)
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8')
      const sha = await createBlob(content)
      console.log(`  Blob ${file}: ${sha}`)
      treeEntries.push({
        path: file.replace(/\\/g, '/'),
        mode: '100644',
        type: 'blob',
        sha
      })
    }
  }
  
  // Also update package.json and .gitignore
  for (const file of ['package.json', '.gitignore']) {
    const filePath = path.join(DIR, file)
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8')
      const sha = await createBlob(content)
      console.log(`  Blob ${file}: ${sha}`)
      treeEntries.push({
        path: file,
        mode: '100644',
        type: 'blob',
        sha
      })
    }
  }
  
  // Step 3: Create new tree
  const newTree = await api('POST', `${BASE}/git/trees`, {
    base_tree: baseTreeSha,
    tree: treeEntries
  })
  if (!newTree) {
    console.error('Failed to create tree')
    process.exit(1)
  }
  console.log('New tree:', newTree.sha)
  
  // Step 4: Create commit
  const newCommit = await api('POST', `${BASE}/git/commits`, {
    message: 'chore: add dev tooling (AGENTS.md, scripts, version management)',
    tree: newTree.sha,
    parents: [masterSha],
    author: { name: 'echocc00', email: '286043314+echocc00@users.noreply.github.com' }
  })
  if (!newCommit) {
    console.error('Failed to create commit')
    process.exit(1)
  }
  console.log('New commit:', newCommit.sha)
  
  // Step 5: Update master ref
  await api('PATCH', `${BASE}/git/refs/heads/master`, {
    sha: newCommit.sha,
    force: false
  })
  console.log('Updated refs/heads/master')
  
  // Step 6: Create base-deploy branch
  await api('POST', `${BASE}/git/refs`, {
    ref: 'refs/heads/base-deploy',
    sha: newCommit.sha
  })
  console.log('Created refs/heads/base-deploy')
  
  console.log('Done!')
}

main().catch(e => console.error('Fatal:', e.message || e))
