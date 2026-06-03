const fs = require('fs')
const git = require('isomorphic-git')
const http = require('isomorphic-git/http/node')
const { HttpsProxyAgent } = require('https-proxy-agent')

const TOKEN = process.env.GH_TOKEN
const PROXY = process.env.HTTPS_PROXY || 'http://127.0.0.1:10808'
const dir = 'F:/codex/js001/Hydro'

// Create a custom HTTP client that routes through the proxy
const agent = new HttpsProxyAgent(PROXY)

const customHttp = {
  request: async (opts) => {
    opts.agent = agent
    return http.request(opts)
  }
}

const onAuth = () => ({ username: TOKEN, password: 'x-oauth-basic' })

async function push(branch) {
  console.log(`Pushing ${branch} via proxy ${PROXY}...`)
  try {
    const result = await git.push({
      fs, http: customHttp, dir,
      remote: 'origin',
      remoteRef: `refs/heads/${branch}`,
      ref: `refs/heads/${branch}`,
      force: false,
      onAuth,
      onMessage: (msg) => console.log('  ', msg),
    })
    console.log(`  ${branch} push result:`, result.ok ? 'OK' : 'FAILED')
    if (result.error) console.log('  Error:', result.error)
  } catch (e) {
    console.error(`  ${branch} push error:`, e.message)
  }
}

async function main() {
  console.log('Proxy:', PROXY)
  await push('master')
  await push('base-deploy')
}

main().then(() => console.log('Done.'))
