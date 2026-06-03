const fs = require('fs')
const path = require('path')

const TOKEN = process.env.GH_TOKEN
if (!TOKEN) { console.error('Set GH_TOKEN env var'); process.exit(1) }

const OWNER = 'echocc00', REPO = 'js001'
const BASE = `https://api.github.com/repos/${OWNER}/${REPO}`
const AUTH = { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }

async function api(method, url, body) {
  const opts = { method, headers: { ...AUTH } }
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body) }
  const resp = await fetch(url, opts)
  const text = await resp.text()
  if (!resp.ok) { console.error(`${method} ${url.split('/').slice(-2).join('/')}: ${resp.status}`, text.substring(0,200)); return null }
  return JSON.parse(text)
}

async function getRefSha(branch) {
  const ref = await api('GET', `${BASE}/git/refs/heads/${branch}`)
  if (!ref) return null
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

const HYDRO_DIR = 'F:/codex/js001/Hydro'
const ROOT_DIR = 'F:/codex/js001'
const FILES = [
  { local: path.join(HYDRO_DIR, 'scripts/setup-judge.sh'), remote: 'scripts/setup-judge.sh' },
  { local: path.join(ROOT_DIR, 'AGENTS.md'), remote: 'AGENTS.md' },
]

async function main() {
  const masterSha = await getRefSha('master')
  if (!masterSha) { console.error('master branch not found'); process.exit(1) }
  console.log('Remote master:', masterSha.substring(0,7))

  const baseTreeSha = await getTreeSha(masterSha)
  console.log('Base tree:', baseTreeSha.substring(0,7))

  const treeEntries = []
  for (const {local, remote} of FILES) {
    if (fs.existsSync(local)) {
      const content = fs.readFileSync(local, 'utf-8')
      const sha = await createBlob(content)
      console.log(`  Blob ${remote}: ${sha.substring(0,7)}`)
      treeEntries.push({ path: remote.replace(/\\/g, '/'), mode: '100644', type: 'blob', sha })
    } else {
      console.log(`  SKIP (not found): ${local}`)
    }
  }

  const newTree = await api('POST', `${BASE}/git/trees`, { base_tree: baseTreeSha, tree: treeEntries })
  if (!newTree) { process.exit(1) }
  console.log('New tree:', newTree.sha.substring(0,7))

  const newCommit = await api('POST', `${BASE}/git/commits`, {
    message: 'feat: add judge setup script + AGENTS.md judge docs',
    tree: newTree.sha,
    parents: [masterSha],
    author: { name: 'echocc00', email: '286043314+echocc00@users.noreply.github.com' }
  })
  if (!newCommit) { process.exit(1) }
  console.log('New commit:', newCommit.sha.substring(0,7))

  // Update master
  await api('PATCH', `${BASE}/git/refs/heads/master`, { sha: newCommit.sha, force: false })
  console.log('master updated')

  // Also update base-deploy
  const baseDeployRef = await api('PATCH', `${BASE}/git/refs/heads/base-deploy`, { sha: newCommit.sha, force: false })
  if (baseDeployRef) console.log('base-deploy updated')

  console.log('DONE - pushed to GitHub')
}

main().catch(e => console.error('Fatal:', e.message))
