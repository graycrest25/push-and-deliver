const { chromium } = require('/Users/macbook/Development/projects/push-and-deliver/node_modules/playwright');
const readline = require('node:readline');
const fs = require('node:fs');
const path = require('node:path');
const OUT = path.resolve('brag-output/work');
let browser, context, page, recordingPage, recordingStarted;
const identifiers = new Set();
function sanitize(value, key = '', route = '') {
  if (Array.isArray(value)) return value.map(v => sanitize(v, key, route));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,sanitize(v,k,route)]));
  const k = key.toLowerCase();
  if (value == null) return value;
  if (typeof value === 'string') {
    if (/email/.test(k)) return 'demo@example.test';
    if (/phone|mobile|accountnumber/.test(k)) return '+2348000000000';
    if (/imageurl|avatarurl|authorizationurl|downloadurl/.test(k)) return null;
    if (/^(username|fullname|displayname|firstname|lastname|name|customername|promotername|accountname|bankaccountname)$/.test(k)) return 'Demo account';
    if (/address/.test(k)) return 'Example address, Lagos';
    if (/^(title|subject)$/.test(k) && /notifications|support/.test(route)) return 'Delivery update';
    if (/^(body|message|summary|reason|note|notes|description)$/.test(k)) return 'Example details for this tutorial. Review the current record before taking action.';
    if (/password|secret|token/.test(k)) return '[hidden]';
    if (/reference|trackingnumber|platenumber|referralcode/.test(k)) return 'DEMO-001';
    if ((/id$|uid$|^id$/.test(k)) && value.length>12) identifiers.add(value);
    return value;
  }
  if (typeof value === 'number') {
    if (/otp/.test(k)) return 1234;
    if (/amount|balance|revenue|earning/.test(k)) return 1500000;
    if (/latitude|longitude/.test(k)) return 0;
  }
  return value;
}
async function protect(ctx) {
  await ctx.route('**/api/**', async route => {
    const req = route.request();
    if (!['GET','HEAD','OPTIONS'].includes(req.method())) return route.fulfill({status:403,json:{error:{message:'Tutorial mode: no live changes are submitted.'}}});
    try {
      const res = await route.fetch();
      if ((res.headers()['content-type']||'').includes('json')) return route.fulfill({response:res,json:sanitize(await res.json(),'',new URL(req.url()).pathname)});
      return route.fulfill({response:res});
    } catch { return route.abort(); }
  });
}
async function scrub() {
  await page.evaluate(ids => {
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes){if(node.parentElement?.closest('script,style,[data-tutorial]'))continue;let text=node.textContent;for(const id of ids)text=text.split(id).join('DEMO-RECORD');text=text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'demo@example.test');node.textContent=text;}
    for(const el of document.querySelectorAll('input')){if(el.type==='password')el.value='';}
  }, [...identifiers]);
}
async function main(command) {
  if (command.type==='login') {
    browser=await chromium.launch({channel:'chrome',headless:true});
    context=await browser.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1});
    page=await context.newPage();
    await page.goto('https://admin.pushndeliver.com/sign-in',{waitUntil:'domcontentloaded',timeout:60000});
    await page.getByLabel('Email',{exact:true}).waitFor({timeout:60000});
    await page.getByLabel('Email',{exact:true}).fill(command.email);
    await page.getByLabel('Password',{exact:true}).fill(command.password);
    await page.getByRole('button',{name:'Sign In',exact:true}).click();
    await page.locator('#workspace-content').waitFor({timeout:60000});
    await protect(context);await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('#workspace-content').waitFor({timeout:60000});
    await page.waitForTimeout(1500);await scrub();
    console.log(JSON.stringify({ok:true,phase:'signed-in',path:new URL(page.url()).pathname}));
  } else if (command.type==='eval') {
    const result=await (new Function('page','context','browser','fs','OUT','scrub',`return (async()=>{${command.code}})()`))(page,context,browser,fs,OUT,scrub);
    console.log(JSON.stringify({ok:true,result}));
  } else if(command.type==='close') {await browser.close();console.log(JSON.stringify({ok:true,closed:true}));process.exit(0);}
}
const rl=readline.createInterface({input:process.stdin,terminal:false});
let chain=Promise.resolve();
rl.on('line',line=>{chain=chain.then(()=>main(JSON.parse(line))).catch(e=>console.log(JSON.stringify({ok:false,error:e.message.replace(/https?:\/\/\S+/g,'[URL]')})));});
console.log('Browser controller ready. Credentials will remain in memory.');
