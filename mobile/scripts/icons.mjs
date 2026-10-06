// Builds the launcher icons and splash screens of both apps from the site's own PWA icons:
//   public/icon-512.png          -> assets/icon-only.png (1024, iOS and the Android legacy icon)
//   public/icon-maskable-512.png -> assets/icon-foreground.png (1024, Android adaptive foreground)
//   a plain white square         -> assets/icon-background.png and assets/splash*.png
// then runs @capacitor/assets, which writes into android/ and ios/. Run `npm run assets` after
// changing an icon and commit the result. Sharp comes with @capacitor/assets (mobile devDependency).
import {existsSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import sharp from 'sharp';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const site=resolve(root,'..','public');
const out=resolve(root,'assets');
const white={r:255,g:255,b:255,alpha:1};

async function upscale(from,to,size){
 if(!existsSync(from))throw new Error('Missing '+from);
 await sharp(from).resize(size,size,{kernel:'lanczos3',fit:'cover'}).flatten({background:white}).png().toFile(to);
}

mkdirSync(out,{recursive:true});
await upscale(resolve(site,'icon-512.png'),resolve(out,'icon-only.png'),1024);
await upscale(resolve(site,'icon-maskable-512.png'),resolve(out,'icon-foreground.png'),1024);
await sharp({create:{width:1024,height:1024,channels:4,background:white}}).png().toFile(resolve(out,'icon-background.png'));
// Splash: the icon centred on white, 2732 px square (the size @capacitor/assets expects); the dark variant is the same (the shell launches light).
const mark=await sharp(resolve(site,'icon-512.png')).resize(480,480).png().toBuffer();
for(const name of ['splash.png','splash-dark.png'])
 await sharp({create:{width:2732,height:2732,channels:4,background:white}}).composite([{input:mark,gravity:'centre'}]).png().toFile(resolve(out,name));

const bin=resolve(root,'node_modules','.bin',process.platform==='win32'?'capacitor-assets.cmd':'capacitor-assets');
const result=spawnSync(bin,['generate','--ios','--android','--iconBackgroundColor','#ffffff','--iconBackgroundColorDark','#ffffff','--splashBackgroundColor','#ffffff','--splashBackgroundColorDark','#ffffff'],{cwd:root,stdio:'inherit',shell:process.platform==='win32'});
process.exit(result.status??1);
