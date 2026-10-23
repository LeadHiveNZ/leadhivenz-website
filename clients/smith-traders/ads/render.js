const { chromium } = require('playwright');
const path=require('path'); const base='file://'+path.resolve(process.argv[2]); const out=process.argv[3];
(async()=>{ const b=await chromium.launch();
 for (const size of ['45','sq']) for (const ad of [1,2,3]) {
  const h = size==='sq'?1080:1350;
  const ctx=await b.newContext({viewport:{width:1080,height:h},deviceScaleFactor:1});
  const p=await ctx.newPage(); await p.goto(`${base}?ad=${ad}&size=${size}`,{waitUntil:'networkidle'});
  await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(800);
  const name=`smith-traders-ad${ad}-${size==='sq'?'1080x1080':'1080x1350'}.png`;
  await p.screenshot({path:`${out}/${name}`,clip:{x:0,y:0,width:1080,height:h}}); console.log(name); await ctx.close(); }
 await b.close(); })();
