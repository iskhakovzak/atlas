import {existsSync,readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';

// Vite treats a project rooted at /app ambiguously when it also has app/app/page.tsx.
// Catch the observed silent homepage/application-page collision before releasing a Linux image.
export function checkVpsPageChunks(source) {
  const pageChunk=route=>{
    const escaped=route.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const match=source.match(new RegExp('pattern:[`"\']'+escaped+'[`"\'],patternParts:[\\s\\S]{0,500}?__loadPage:(\\w+)'));
    if(!match)throw new Error('Cannot verify VPS route '+route);
    const loader=source.match(new RegExp('\\b'+match[1]+'=\\(\\)=>import\\([`"\']([^`"\']+)[`"\']\\)'));
    if(!loader)throw new Error('Cannot verify VPS route loader '+route);
    return loader[1];
  };
  if(pageChunk('/')===pageChunk('/app'))throw new Error('VPS build collision: / and /app load the same page chunk');
}

// The VPS server answers hashed assets with their build-time .br/.gz (scripts/precompress-static.mjs, 3 November 2026):
// an image without them would quietly fall back to Caddy's on-the-fly compression.
export function checkPrecompressedAssets(clientDir) {
  const root=path.join(clientDir,'_next','static');
  const scripts=readdirSync(root,{recursive:true}).map(String).filter(file=>/\.(js|css)$/.test(file));
  const missing=scripts.filter(file=>!existsSync(path.join(root,file+'.br'))&&readFileSync(path.join(root,file)).length>=1024);
  if(!scripts.length||missing.length)throw new Error('VPS build: hashed assets without .br: '+(missing.slice(0,5).join(', ')||'no assets found'));
  return scripts.length;
}

if(process.argv[1]?.replaceAll('\\','/').endsWith('/check-vps-build.mjs')) {
  checkVpsPageChunks(readFileSync('dist/server/index.js','utf8'));
  console.log('VPS homepage and app page have distinct server chunks');
  console.log(`VPS hashed assets precompressed: ${checkPrecompressedAssets('dist/client')} JS/CSS files`);
}
