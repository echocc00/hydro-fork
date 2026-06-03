// Push via GitHub REST API using git references
// This bypasses git HTTP protocol entirely
const fs = require('fs')
const child_process = require('child_process')

const TOKEN = process.env.GH_TOKEN
const OWNER = 'echocc00'
const REPO = 'js001'
const BASE_URL = `https://api.github.com/repos/${OWNER}/${REPO}/git`

// Use fetch with dispatcher for proxy support
// We rely on NODE_EXTRA_CA_CERTS and the proxy being set at system level

async function apiRequest(path, method, body) {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`
  const headers = {
    'Authorization': `Bearer ${TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (body) headers['Content-Type'] = 'application/json'
  
  const opts = { method, headers }
  if (body) opts.body = JSON.stringify(body)
  
  const resp = await fetch(url, opts)
  const text = await resp.text()
  if (!resp.ok) {
    console.error(`  API ${method} ${path}: ${resp.status}`)
    console.error(`  ${text.substring(0, 500)}`)
    return null
  }
  return JSON.parse(text)
}

async function getRef(branch) {
  const data = await apiRequest(`/git/refs/heads/${branch}`, 'GET')
  if (data) {
    console.log(`  Remote ${branch} ref: ${data.object.sha}`)
    return data.object.sha
  }
  return null
}

async function createOrUpdateRef(branch, sha) {
  const existing = await getRef(branch)
  if (existing) {
    // Update existing ref
    const result = await apiRequest(`/git/refs/heads/${branch}`, 'PATCH', {
      sha,
      force: false
    })
    if (result) console.log(`  Updated ${branch} -> ${sha}`)
    return !!result
  } else {
    // Create new ref
    const result = await apiRequest(`/git/refs`, 'POST', {
      ref: `refs/heads/${branch}`,
      sha
    })
    if (result) console.log(`  Created ${branch} -> ${sha}`)
    return !!result
  }
}

function execGit(cmd) {
  return child_process.execSync(`"D:\\AI\\git\\Git\\bin\\git.exe" -c safe.directory=F:/codex/js001/Hydro ${cmd}`, {
    cwd: 'F:/codex/js001/Hydro',
    encoding: 'utf-8'
  }).trim()
}

async function main() {
  const branches = ['master', 'base-deploy']
  
  for (const branch of branches) {
    console.log(`Pushing ${branch}...`)
    const sha = execGit(`rev-parse ${branch}`)
    console.log(`  Local sha: ${sha}`)
    await createOrUpdateRef(branch, sha)
    console.log('')
  }
  console.log('Done.')
}

main().catch(e => console.error('Error:', e.message))
