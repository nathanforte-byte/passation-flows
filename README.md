# passation-flows

Animated visual flows (n8n-style) for every project / automation in Nathan's stack.

Static site, zero build. Deploys to Vercel as one project.

## Structure

```
index.html              # landing — grid of cards from manifest.json
manifest.json           # source of truth: [{slug, title, status, icon, tags, ...}]
shared/
  flow.css              # common styles (dark grid, nodes, edges, drawer)
  flow.js               # generic canvas engine (pan/zoom, play, animation)
flows/
  <slug>.html           # data-only file: declares window.FLOW = {nodes, edges, walk, details}
```

## Add a new flow

1. Drop a file in `flows/<slug>.html` based on an existing one (copy `find-company-contacts.html`).
2. Edit the `window.FLOW` object: `nodes`, `edges`, `walk`, `details`, optional `rules`.
3. Add a card entry in `manifest.json` with `status: "live"`.
4. Commit + push — Vercel auto-deploys.

## Flow data shape

```js
window.FLOW = {
  meta: { title, file },
  canvas: { w, h },
  nodes: { id: { x, y, kind, ic, nm, ttl, sb } },   // kind ∈ trig|exa|gem|code|out|if|db|api
  edges: [[from, fromSide, to, toSide, label, cls]], // sides l|r|t|b · cls lp|t|f|''
  walk:  ['id1','id2',...],                          // animation sequence (token path)
  details: { id: { h, t, d, io, code, ct, rules } },
  rules:  [['Title','desc']]                         // shown when a node's details.rules=true
};
```

## Local dev

```bash
python3 -m http.server 8090
# open http://localhost:8090
```

## Deploy

Vercel static, no config needed. `vercel --prod` from the repo root.
