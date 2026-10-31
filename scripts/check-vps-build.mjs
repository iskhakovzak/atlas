import {readFileSync} from 'node:fs';

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

if(process.argv[1]?.replaceAll('\\','/').endsWith('/check-vps-build.mjs')) {
  checkVpsPageChunks(readFileSync('dist/server/index.js','utf8'));
  console.log('VPS homepage and app page have distinct server chunks');
}
