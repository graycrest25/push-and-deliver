return (async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const origin='https://admin.pushndeliver.com';
  const ids=new Map(), reverse=new Map();let seq=0;
  function demoId(v){if(!ids.has(v)){const d='demo-'+String(++seq).padStart(4,'0');ids.set(v,d);reverse.set(d,v);}return ids.get(v);}
  function clean(v,k='',route=''){
    if(Array.isArray(v))return v.map(x=>clean(x,k,route));
    if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([a,b])=>[a,clean(b,a,route)]));
    if(v==null)return v;
    const key=k.toLowerCase();
    if(typeof v==='string'){
      if(/email/.test(key))return 'demo@example.test';
      if(/phone|mobile|accountnumber/.test(key))return '+2348000000000';
      if(/imageurl|avatarurl|authorizationurl|downloadurl/.test(key))return null;
      if(/^(username|fullname|displayname|firstname|lastname|customername|promotername|accountname|bankaccountname)$/.test(key))return 'Demo account';
      if(key==='name'&&!/geography|shipping\/countries|tariff|fees|office|config/.test(route))return 'Demo account';
      if(/address/.test(key))return 'Example address, Lagos';
      if(/^(title|subject)$/.test(key)&&/notifications|support/.test(route))return 'Delivery update';
      if(/^(body|message|summary|reason|note|notes|description)$/.test(key))return 'Example record for this tutorial. Review the current details before taking action.';
      if(/password|secret|token/.test(key))return '[hidden]';
      if(/reference|platenumber|referralcode|trackingnumber/.test(key))return 'DEMO-001';
      if((/id$|uid$/.test(key))&&v.length>12)return demoId(v);
      return v.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'demo@example.test');
    }
    if(typeof v==='number'){
      if(/otp/.test(key))return 1234;
      if(/amount|balance|revenue|earning/.test(key))return 1500000;
      if(/latitude|longitude/.test(key))return 0;
    }
    return v;
  }
  const recorded=await browser.newContext({storageState:await context.storageState(),viewport:{width:1600,height:900},deviceScaleFactor:1,recordVideo:{dir:OUT+'/raw',size:{width:1600,height:900}}});
  await recorded.route('**/api/**',async route=>{
    const req=route.request();if(!['GET','HEAD','OPTIONS'].includes(req.method()))return route.fulfill({status:403,json:{error:{message:'Tutorial mode: live changes are disabled.'}}});
    let url=req.url();for(const [d,real]of reverse)url=url.split(d).join(encodeURIComponent(real));
    try{const res=await route.fetch({url});if((res.headers()['content-type']||'').includes('json'))return route.fulfill({response:res,json:clean(await res.json(),'',new URL(url).pathname)});return route.fulfill({response:res});}catch{return route.abort();}
  });
  const p=await recorded.newPage();const epoch=Date.now();
  await p.addInitScript(()=>{try{localStorage.setItem('theme','light');}catch{}});
  const scenes=[
    {route:'/dashboard',title:'Welcome to the admin workspace',text:'This silent guide shows where to work and what to check. Customer details are replaced with demo values. No live changes are submitted.',target:'h1'},
    {route:null,title:'Navigation and role access',text:'Use the sidebar to move between sections. Find a page searches the workspace. Your admin role controls access; a missing action may reflect permissions or record status.',target:'[aria-label="Toggle navigation"]'},
    {route:'/reports',title:'Reports: choose scope before reading totals',text:'Select the account or order category and review the period shown. Use Refresh for current data. Coverage warnings explain when a report is not ready.',target:'h1'},
    {route:'/users',title:'Users: search, inspect and export',text:'Search by name, email or phone. Apply filters, then open a user to review their profile and finances. Exports download all matching records in one file.',target:'input'},
    {route:'/riders',title:'Riders: check eligibility and activity',text:'Filter riders by vehicle, verification and registration dates. Open a rider for profile and financial details. Online status is a saved flag, not guaranteed live connectivity.',target:'input'},
    {route:'/rider-applications',title:'Rider applications: review before deciding',text:'Open an application to inspect identity, vehicle information, documents and approval blockers. Only use the review actions returned for that application. Verify evidence before submitting.',target:'h1'},
    {route:'/vendors',title:'Vendor applications and partners',text:'Find the relevant partner record and inspect its application details. Review documents and current status before using any available approval or management action.',target:'h1'},
    {route:'/shipment-orders',title:'Shipments: locate the right order',text:'Search with the full shipment ID, or filter by city, shipment type and status. Open a matching row to work on that shipment.',target:'input'},
    {route:null,detail:'/shipment-orders/',title:'Shipment detail: read the parcel first',text:'Check the delivery stage, customer payment status, addresses and weight. Pickup OTP appears only when returned. Rider identity, vehicle and earnings are shown separately.',target:'h1'},
    {route:null,summary:'Assess shipment charge',title:'Assess a shipment charge',text:'Where available, review the prefilled charge and weight, choose the charge type and enter a reason. Enter naira; the system submits kobo. Submit only after checking the parcel.',target:'summary'},
    {route:null,title:'Customer checkout and payment links',text:'A ready checkout offers Copy payment link and Open payment link. Get payment link retrieves an existing bill. Generate new payment link asks the backend to verify abandonment.',target:'main'},
    {route:null,title:'Payment rules that prevent mistakes',text:'An open link or closed checkout does not prove payment. Refresh authoritative status. Customer cash requires the exact due bill and evidence. Rider HQ earnings do not pay the customer bill.',target:'main'},
    {route:null,title:'HQ handoff and onward delivery',text:'Give the HQ handoff code only after receiving the parcel. It lasts ten minutes. Available actions then guide office arrival, final dispatch and delivery; payment blockers must be resolved first.',target:'main'},
    {route:'/ride-hailing',title:'Ride hailing and courier operations',text:'Filter and open a ride to inspect status, customer, rider and fare details. Use only available actions. Historical records retain their separate correction flow.',target:'h1'},
    {route:'/support-tickets',title:'Support: claim, read and respond',text:'Open a ticket and claim it when required. Read the conversation, load older messages and inspect customer images. Admin replies are text only.',target:'h1'},
    {route:null,detail:'/support-tickets/',title:'Support closure and attachment access',text:'Close a resolved ticket with a clear summary. Super admins can inspect closed tickets and history. Assigned staff access attachments on open tickets; unavailable files are labelled.',target:'h1'},
    {route:'/payments',title:'Payment review',text:'Use payment records to investigate status and references. Verify the backend result before treating a payment as complete. A redirected checkout is not proof of settlement.',target:'h1'},
    {route:'/withdrawals',title:'Withdrawals: review before transfer',text:'Open a request and verify the amount and destination. Claim it before processing where required. Record the outcome only after the real transfer is confirmed.',target:'h1'},
    {route:'/fees',title:'Fees and pricing',text:'Inspect the relevant fee or pricing record before editing. Check units, applicable service and scope. Review the saved result; do not assume every field is a naira amount.',target:'h1'},
    {route:'/export-rates',title:'Shipping tariffs and delivery zones',text:'Choose the country or tariff, review zones and weight bands, then edit the permitted draft. Inspect saved prices before publishing. Domestic delivery tariffs have their own section.',target:'h1'},
    {route:'/referrals',title:'Referrals and promoter attribution',text:'Use referral tabs and dates to narrow results. Email links open account profiles. Generated referrals show a promoter name. Use the filtered CSV for an export.',target:'h1'},
    {route:'/promoter-links',title:'Promoter links',text:'Review existing promoter links before creating or changing one. Check the intended promoter, code and active status. Referral reporting remains separate from link management.',target:'h1'},
    {route:'/coupons',title:'Coupons, rewards and game rules',text:'Review campaigns, codes and eligibility before changing incentives. Check issuance and redemption status. Game rules are managed separately and are restricted by admin role.',target:'h1'},
    {route:'/general-notifications',title:'Broadcasts: prepare an announcement',text:'Choose customers, riders or all accounts. Enter a title and message, then review before queuing. This tutorial does not send a notification.',summary:'Queue broadcast',target:'summary'},
    {route:null,title:'Broadcast history and delivery progress',text:'Open a history row for content, progress and failures. Processed includes skipped accounts. Provider acceptance does not mean a phone received or opened the message.',target:'h2'},
    {route:null,detail:'/general-notifications/',title:'Resend broadcasts carefully',text:'Confirm resend only when you intend to contact the audience again, including previous recipients. It creates a new broadcast. Retry a timeout without changing the request details.',target:'h1'},
    {route:'/files',title:'Files, uploads and evidence',text:'Upload files for the correct purpose and wait until they are ready. Use prepared evidence in the related workflow. Do not assume an upload is usable while it is still processing.',target:'h1'},
    {route:'/jobs',title:'Background jobs and audit history',text:'Use jobs to investigate queued, retrying or failed work. Review the error before an available retry action. Audit history records administrative activity for investigation.',target:'h1'},
    {route:'/head-offices',title:'Offices and service configuration',text:'Review office details and geography carefully. Delivery tariffs, international tariffs and mobile app configuration are separate areas. Confirm the intended service and location before saving.',target:'h1'},
    {route:'/admin/users',title:'Admin accounts and permissions',text:'Super admins manage membership using the existing user record. Choose the intended role and provide the required reason. Access changes can invalidate the affected account’s sessions.',target:'h1'},
    {route:'/settings',title:'Account security and safe retries',text:'Sign out when you finish. If an operation times out, check the latest record and retry unchanged details. Refresh after a conflict before starting a new operation.',target:'h1'},
    {route:'/dashboard',title:'Your daily workflow',text:'Review the overview, handle operations, resolve support, and check payment outcomes. Open the right record, verify the facts, use available actions, then refresh to confirm the result.',target:'h1'},
  ];
  const selected = scenes.splice(8,5);
  scenes.splice(0,scenes.length,...selected);
  scenes[0].route='/shipment-orders'; scenes[0].filterStatus='placed';
  scenes[2].route='/shipment-orders'; scenes[2].filterStatus='sentToHq'; scenes[2].detail='/shipment-orders/'; scenes[2].section='Customer shipment assessments';
  scenes[3].section='Payment information'; scenes[4].section='Update shipment status';
  fs.writeFileSync(OUT+'/supplementary-scenes.json',JSON.stringify(scenes,null,2));
  const clips=[];let cursor={x:1050,y:210};
  async function overlay(){await p.evaluate(()=>{
    document.querySelector('#tutorial-layer')?.remove();
    const root=document.createElement('div');root.id='tutorial-layer';root.setAttribute('data-tutorial','');root.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2147483647;font-family:Arial,sans-serif';
    root.innerHTML=`<div id="tutorial-badge" style="position:fixed;right:20px;bottom:18px;background:#101b30;color:#d9e9ff;padding:9px 14px;border-radius:8px;font-size:12px;letter-spacing:.2px;box-shadow:0 4px 18px #0002">GUIDED TOUR · DEMO DETAILS · NO LIVE CHANGES</div><div id="tutorial-cursor" style="position:fixed;left:0;top:0;width:27px;height:34px;filter:drop-shadow(0 3px 4px #0006)"><svg width="27" height="34" viewBox="0 0 27 34"><path d="M2 2L23 21L14 22L10 31L6 29L10 20L2 22Z" fill="#ffffff" stroke="#445caa" stroke-width="2.5"/></svg></div><div id="tutorial-box" style="position:fixed;width:420px;box-sizing:border-box;background:#101b30;color:white;border:2px solid #94c8ff;padding:20px 22px;border-radius:14px;box-shadow:0 12px 28px #0004"><div id="tutorial-number" style="color:#b4dafd;font-size:12px;margin-bottom:9px;letter-spacing:1px"></div><div id="tutorial-title" style="font-size:23px;line-height:1.2;font-weight:700;margin-bottom:12px"></div><div id="tutorial-text" style="font-size:18px;line-height:1.5;color:#e4edfc"></div><div style="height:3px;background:#30405d;margin-top:18px;border-radius:4px"><div id="tutorial-progress" style="height:3px;background:#b4dafd;border-radius:4px"></div></div></div>`;
    document.body.appendChild(root);
  });}
  async function position(x,y,title,text,index){await p.evaluate(({x,y,title,text,index,total})=>{
    const cursor=document.getElementById('tutorial-cursor'), box=document.getElementById('tutorial-box');
    cursor.style.transform=`translate(${x}px,${y}px)`;
    document.getElementById('tutorial-title').textContent=title;
    document.getElementById('tutorial-text').textContent=text;
    document.getElementById('tutorial-number').textContent=`STEP ${String(index+1).padStart(2,'0')} OF ${total}`;
    document.getElementById('tutorial-progress').style.width=`${(index+1)/total*100}%`;
    const w=420,h=box.getBoundingClientRect().height;
    box.style.left=Math.max(20,Math.min(innerWidth-w-20,x+30))+'px';
    box.style.top=Math.max(85,Math.min(innerHeight-h-65,y+32))+'px';
  },{x,y,title,text,index,total:32});}
  async function animateTo(point,scene,index){
    const start={...cursor};for(let n=1;n<=28;n++){const q=n/28,t=1-Math.pow(1-q,3);const x=start.x+(point.x-start.x)*t,y=start.y+(point.y-start.y)*t;await position(x,y,scene.title,scene.text,index);await p.mouse.move(x,y);await p.waitForTimeout(22);}cursor=point;
  }
  for(let i=0;i<scenes.length;i++){
    const s=scenes[i];
    try {
      if(s.route){await p.goto(origin+s.route,{waitUntil:'domcontentloaded',timeout:60000});await p.locator('#workspace-content').waitFor({timeout:30000});await p.waitForTimeout(1600);}
      if(s.filterStatus){
        const filter=p.getByLabel('Status',{exact:true});
        if(await filter.count()){await filter.selectOption(s.filterStatus);await p.getByRole('button',{name:'Apply filters',exact:true}).click();await p.waitForTimeout(1600);}
      }
      if(s.detail){const link=p.locator(`#workspace-content a[href^="${s.detail}"]`).filter({hasNotText:'Back'}).first();if(await link.count()){await link.click();await p.waitForTimeout(1700);}}
      if(s.summary){const summary=p.locator('summary').filter({hasText:s.summary}).first();if(await summary.count()){await summary.scrollIntoViewIfNeeded();const expanded=await summary.evaluate(e=>e.parentElement.open);if(!expanded)await summary.click();await p.waitForTimeout(450);}}
      await p.evaluate(()=>{for(const el of document.querySelectorAll('input[type=password]'))el.value='';});
      let target=p.locator(s.target||'h1').first();if(!(await target.count())||!(await target.isVisible()))target=p.locator('#workspace-content');
      if(s.target==='h1'||s.route)await p.evaluate(()=>window.scrollTo(0,0));
      if(s.summary){const specific=p.locator('summary').filter({hasText:s.summary}).first();if(await specific.count())target=specific;}
      if(s.title==='Broadcast history and delivery progress'){const history=p.getByRole('region',{name:'Broadcast history',exact:true});if(await history.count()){await history.scrollIntoViewIfNeeded();target=history;}}
      if(s.section){const section=p.getByRole('region',{name:s.section,exact:true});if(await section.count()){await section.scrollIntoViewIfNeeded();target=section;}}
      const box=await target.boundingBox();const point=box?{x:Math.min(1130,Math.max(310,box.x+Math.min(180,box.width/2))),y:Math.min(470,Math.max(110,box.y+Math.min(35,box.height/2)))}:{x:650,y:190};
      await overlay();await position(cursor.x,cursor.y,s.title,s.text,i+8);
      const start=(Date.now()-epoch)/1000;
      await animateTo(point,s,i+8);
      await p.waitForTimeout(500);
      await p.screenshot({path:OUT+`/scene-${String(i+9).padStart(2,'0')}.png`});
      const hold=Math.max(8500,Math.min(12000,s.text.split(/\s+/).length*300));await p.waitForTimeout(hold);
      const end=(Date.now()-epoch)/1000;
      clips.push({index:i+8,title:s.title,start,end,route:s.route||'detail'});
      console.log(JSON.stringify({scene:i+1,total:scenes.length,title:s.title}));
    }catch(e){console.log(JSON.stringify({scene:i+1,skipped:true,error:e.message.slice(0,160)}));}
  }
  const elapsed=(Date.now()-epoch)/1000;
  await p.waitForTimeout(300);const video=p.video();await recorded.close();
  const videoPath=await video.path();fs.writeFileSync(OUT+'/supplementary-recording.json',JSON.stringify({videoPath,elapsed,clips},null,2));
  return {videoPath,scenes:clips.length,elapsed};
})();
