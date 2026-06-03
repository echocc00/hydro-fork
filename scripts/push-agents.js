const fs = require('fs');
const TOKEN = process.env.GH_TOKEN;
const OWNER = 'echocc00', REPO = 'js001', BASE = 'https://api.github.com/repos/' + OWNER + '/' + REPO;
const h = { Authorization: 'Bearer ' + TOKEN, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };

async function api(method, url, body) {
  const opts = { method, headers: { ...h } };
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const resp = await fetch(url, opts);
  const text = await resp.text();
  if (!resp.ok) { console.error(method, resp.status); return null; }
  return JSON.parse(text);
}

(async () => {
  let agents = fs.readFileSync('F:/codex/js001/Hydro/AGENTS.md', 'utf-8');
  agents = agents.replace('### 下一步 (Day 3)', '### 已完成 (Day 3)\n\n- [x] 视频学习插件开发完成 (6 files)\n- [x] 编译通过零错误\n- [x] PERM: VIEW_VIDEO / CREATE_VIDEO / EDIT_VIDEO\n\n### 下一步 (Day 3b)\n\n1. 测试机 git pull + build + restart\n2. 编辑 ~/.hydro/addon.json 加入 @hydrooj/video\n3. 访问 /video 验证\n\n### 当前状态');
  
  const ref = await api('GET', BASE + '/git/refs/heads/master');
  const commit = await api('GET', BASE + '/git/commits/' + ref.object.sha);
  const agentsBlob = await api('POST', BASE + '/git/blobs', { content: Buffer.from(agents).toString('base64'), encoding: 'base64' });
  const tree = await api('POST', BASE + '/git/trees', { base_tree: commit.tree.sha, tree: [{ path: 'AGENTS.md', mode: '100644', type: 'blob', sha: agentsBlob.sha }] });
  const newCommit = await api('POST', BASE + '/git/commits', { message: 'docs: progress update for video plugin', tree: tree.sha, parents: [ref.object.sha], author: { name: 'echocc00', email: '286043314+echocc00@users.noreply.github.com' } });
  await api('PATCH', BASE + '/git/refs/heads/master', { sha: newCommit.sha, force: false });
  await api('PATCH', BASE + '/git/refs/heads/base-deploy', { sha: newCommit.sha, force: false });
  console.log('Done:', newCommit.sha.substring(0,7));
})();
