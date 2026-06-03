const fs = require('fs');
const TOKEN = process.env.GH_TOKEN;
const OWNER = 'echocc00', REPO = 'js001', BASE = 'https://api.github.com/repos/' + OWNER + '/' + REPO;
const h = { Authorization: 'Bearer ' + TOKEN, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };

async function api(method, url, body) {
  const opts = { method, headers: { ...h } };
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const resp = await fetch(url, opts);
  const text = await resp.text();
  if (!resp.ok) { console.error(method, resp.status, text.substring(0,200)); return null; }
  return JSON.parse(text);
}

(async () => {
  const ref = await api('GET', BASE + '/git/refs/heads/master');
  const masterSha = ref.object.sha;
  const commit = await api('GET', BASE + '/git/commits/' + masterSha);
  const baseTree = commit.tree.sha;
  console.log('Base:', masterSha.substring(0,7));
  
  const files = ['packages/video/package.json','packages/video/tsconfig.json','packages/video/index.ts','packages/video/templates/video_main.html','packages/video/templates/video_detail.html','packages/video/templates/video_edit.html'];
  const treeEntries = [];
  for (const file of files) {
    const content = fs.readFileSync('F:/codex/js001/Hydro/' + file, 'utf-8');
    const blob = await api('POST', BASE + '/git/blobs', { content: Buffer.from(content).toString('base64'), encoding: 'base64' });
    console.log('  ' + file.split('/').pop() + ': ' + blob.sha.substring(0,7));
    treeEntries.push({ path: file, mode: '100644', type: 'blob', sha: blob.sha });
  }
  
  const tree = await api('POST', BASE + '/git/trees', { base_tree: baseTree, tree: treeEntries });
  console.log('Tree:', tree.sha.substring(0,7));
  
  const newCommit = await api('POST', BASE + '/git/commits', {
    message: 'feat: add video learning plugin with domain-level permissions',
    tree: tree.sha,
    parents: [masterSha],
    author: { name: 'echocc00', email: '286043314+echocc00@users.noreply.github.com' }
  });
  console.log('Commit:', newCommit.sha.substring(0,7));
  
  await api('PATCH', BASE + '/git/refs/heads/master', { sha: newCommit.sha, force: false });
  await api('PATCH', BASE + '/git/refs/heads/base-deploy', { sha: newCommit.sha, force: false });
  console.log('Pushed');
})();
