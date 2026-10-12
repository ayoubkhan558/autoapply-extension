// Run from the extension root: node tests/eligibility.browser.cjs
// Uses installed Playwright + Chromium, no live sites or user data.
const {chromium} = require('playwright');
const path = require('path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
(async () => {
 const browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || '/usr/local/bin/chromium',args:['--no-sandbox']});
 const page = await browser.newPage();
 const errors = []; page.on('pageerror',e=>errors.push(e.message));
 let passed=0;
 async function setup(html) {
  await page.goto('about:blank');
  await page.setContent('<style>input,select,textarea,button,[role=combobox],[role=radio]{min-width:100px;min-height:24px}label{display:inline-block}</style>'+html);
  await page.evaluate(()=>{window.chrome={runtime:{sendMessage:(m,cb)=>cb({ok:true,data:{answers:['TEST ANSWER']}})}};});
  for(const file of ['lib/fields.js','lib/matcher.js','content/dom.js','content/fill.js','content/panel.js','content/detect.js','content/field-ai.js']) await page.addScriptTag({path:path.join(root,file)});
  await page.evaluate(()=>{
   window.ctx={profile:{personal:{firstName:'Ada',lastName:'Lovelace',fullName:'Ada Lovelace',email:'ada@example.test'},experience:[],education:[]},flat:{'personal.firstName':'Ada','personal.lastName':'Lovelace','personal.fullName':'Ada Lovelace','personal.email':'ada@example.test','address.city':'Lahore','address.country':'Pakistan','personal.phone':'03001234567'},customFields:[],skillTokens:['javascript']};
   aaFillContext=async()=>ctx; aaLoadActiveResume=async()=>null;aaLoadActivePhoto=async()=>null;aaLoadActiveCoverLetter=async()=>null;
   aaLoadData=async()=>({activeProfileId:'test'});aaGetActiveProfile=()=>ctx.profile;aaGetResumeText=async()=>'';aaJobText=()=>'';
   aaShowFillResult=(n,remaining)=>{window.result={n,remaining}};aaRecordFill=()=>{};aaTopHost=()=> 'test';
  });
 }
 async function test(name,html,fn) {await setup(html);await fn();passed++;console.log('PASS '+name);}
 const fields='<label>First name<input name="firstName"></label><label>Last name<input name="lastName"></label><label>Email<input name="email"></label>';
 async function ids(){return page.evaluate(()=>aaEligibleControls().controls.map(e=>e.id||e.name));}
 await test('whole-token search matching; apostrophes; Bootstrap', '<form class="application bootstrap">'+fields+'<label>Research interests<input id="researchInterests"></label><label>City<input id="city" class="typeahead autosuggest autocomplete lookup"></label></form>', async()=>{
  assert.equal(await page.evaluate(()=>aaTokens("Referral’s camelCase").join(',')), 'referrals,camel,case');
  assert((await ids()).includes('city'));assert((await ids()).includes('researchInterests'));
  await page.evaluate(()=>run()); assert.equal(await page.locator('[name=firstName]').inputValue(),'Ada');
 });
 await test('isolates search, newsletter, login, payment from application', '<form class="search-bar">'+fields+'</form><form class="newsletter"><input aria-label="Email"></form><form><input aria-label="Username"><input type="password"></form><form class="checkout">'+fields+'<input type="file"></form><form id="application">'+fields+'</form>', async()=>{
  assert.equal(await page.evaluate(()=>aaCountFillable()),3);
  await page.evaluate(()=>run()); assert.equal(await page.locator('#application [name=email]').inputValue(),'ada@example.test');
  assert.equal(await page.locator('.search-bar [name=email]').inputValue(),'');
  assert.equal(await page.locator('.newsletter input').inputValue(),'');
  assert.equal(await page.locator('.checkout [name=email]').inputValue(),'');
 });
 await test('ancestor search/filter class does not contaminate application', '<main class="research-search-layout"><form id="application">'+fields+'</form></main>',async()=>assert.equal((await ids()).length,3));
 await test('hidden, inert, ancestor opacity, off-screen, readonly and honeypots', '<form class="application">'+fields+'<input id="h1" hidden><input id="h2" style="display:none"><input id="h3" style="visibility:hidden"><div style="opacity:0"><input id="h4"></div><input id="h5" style="position:absolute;left:-9999px"><div inert><input id="h6"></div><input id="trap"><input id="ro" readonly><div aria-hidden="true"><input id="h7"></div></form>',async()=>assert.deepEqual(await ids(),['firstName','lastName','email']));
 await test('search labels/types/hints and short names excluded', '<form class="application">'+fields+'<input id="q"><input name="s"><input type="search"><input id="cityFilter"><input aria-label="Search for jobs"><input enterkeyhint="search"><input autocomplete="section-a cc-name"><input autocomplete="one-time-code"></form>',async()=>assert.equal((await ids()).length,3));
 await test('other-person contact fields skipped; manager question preserved', '<form class="application">'+fields+'<input id="ref" aria-label="Referral’s email"><input id="mgr" aria-label="Manager phone"><input id="em" aria-label="Emergency contact name"><textarea id="question" aria-label="Are you a manager?"></textarea></form>',async()=>{
  assert.deepEqual(await ids(),['firstName','lastName','email','question']);
  assert.equal(await page.evaluate(()=>aaIsAiField(document.querySelector('#ref'))),false);
 });
 await test('no-form application and small filter widget', '<section id="candidate">'+fields+'</section><div class="filters"><input aria-label="City"><input aria-label="Job title"><input aria-label="ZIP"></div>',async()=>{assert.equal((await ids()).length,3);await page.evaluate(()=>run());assert.equal(await page.locator('#candidate [name=firstName]').inputValue(),'Ada');});
 await test('site chrome orphan blocked; plain orphan retained', '<header><input id="head" aria-label="First name"></header><input id="orphan" aria-label="First name">',async()=>assert.deepEqual(await ids(),['orphan']));
 await test('single-step application permitted, lone newsletter refused', '<form><label>First name<input id="step"></label><button type="submit">Continue</button></form><form><input id="signup" aria-label="Email"></form>',async()=>assert.deepEqual(await ids(),['step']));
 await test('consent stays unchecked; skills can fill; transparent proxy valid', '<form class="application">'+fields+'<label>I agree to terms<input type="checkbox" id="consent" required></label><label>JavaScript<input type="checkbox" id="skill" style="opacity:0"></label><div hidden><label>JavaScript<input id="badcheck" type="checkbox"></label></div></form>',async()=>{
  await page.evaluate(()=>run());assert.equal(await page.locator('#consent').isChecked(),false);assert.equal(await page.locator('#skill').isChecked(),true);assert.equal(await page.locator('#badcheck').isChecked(),false);
  assert((await page.evaluate(()=>result.remaining)).some(e=>e.required && /terms/.test(e.label)));
 });
 await test('lasso uses shared gate and does not fill distant fields', '<form class="application">'+fields+'<input id="search" type="search" aria-label="City"></form>',async()=>{
  await page.evaluate(async()=>{const r=document.querySelector('[name=firstName]').getBoundingClientRect();await fillWithinBox({left:r.left+2,right:r.right-2,top:r.top+2,bottom:r.bottom-2});});
  assert.equal(await page.locator('[name=firstName]').inputValue(),'Ada');assert.equal(await page.locator('[name=email]').inputValue(),'');assert.equal(await page.locator('#search').inputValue(),'');
 });
 await test('AI questions/attention lists exclude unrelated textareas', '<form class="application">'+fields+'<textarea id="why" aria-label="Why do you want this role?"></textarea></form><div class="comments"><textarea id="comment"></textarea></div>',async()=>{
  assert.deepEqual(await page.evaluate(()=>aaCollectQuestions().map(f=>f.el.id)),['why']);
  assert.equal(await page.evaluate(()=>aaIsAiField(document.querySelector('#comment'))),false);
  assert(!(await page.evaluate(()=>aaUnfilledFields(null,true))).some(e=>/comment/.test(e.label)));
  await page.evaluate(()=>aaFillSingleField(document.querySelector('#why')));assert.equal(await page.locator('#why').inputValue(),'TEST ANSWER');
 });
 await test('AI response rechecks field eligibility after page changes', '<form class="application">'+fields+'<textarea id="why" aria-label="Why this role?"></textarea></form>',async()=>{
  await page.evaluate(async()=>{chrome.runtime.sendMessage=(m,cb)=>{window.pending=cb};await aaFillSingleField(document.querySelector('#why'));document.querySelector('#why').hidden=true;pending({ok:true,data:{answers:['STALE']}});});
  assert.equal(await page.locator('#why').inputValue(),'');
 });
 await test('unsafe clicks, untyped/invalid buttons, and links refused', '<form class="application">'+fields+'<button id="default"><span id="inner">Add education</span></button><button id="bad" type="invalid">Add education</button><button id="safe" type="button">Add education</button><button id="submit" type="submit">Add education</button><a id="link" href="javascript:void(0)">Add education</a></form>',async()=>{
  assert.deepEqual(await page.evaluate(()=>['default','inner','bad','submit','link'].map(id=>aaSafeClick(document.getElementById(id)))),[false,false,false,false,false]);
  assert.equal(await page.evaluate(()=>aaFindAddButton(/^add education$/).id),'safe');
 });
 await test('submit guard cancels requestSubmit and handles overlapping async fills', '<form class="application">'+fields+'<button id="safe" type="button">Add education</button></form>',async()=>{
  const r=await page.evaluate(async()=>{const f=document.querySelector('form');let siteHandlers=0;f.addEventListener('submit',()=>siteHandlers++);document.querySelector('#safe').onclick=()=>f.requestSubmit();let resolve;const p=aaWithSubmitGuard(()=>new Promise(r=>resolve=r));aaSafeClick(document.querySelector('#safe'));const canceled=!f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));resolve();await p;return {siteHandlers,canceled};});
  assert.deepEqual(r,{siteHandlers:0,canceled:true});
  await page.waitForTimeout(1600);assert.equal(await page.evaluate(()=>AA_SUBMIT_GUARDS),0);
 });
 await test('file uploads explicitly gated; unrelated single upload not a CV', '<form class="application">'+fields+'<label>Upload CV<input id="cv" type="file"></label><input id="hidefile" type="file" hidden></form><form class="checkout"><input id="payfile" type="file"></form>',async()=>{
  assert(!(await ids()).includes('cv'));
  assert.deepEqual(await page.evaluate(()=>aaEligibleControls({allowFiles:true}).controls.filter(e=>e.type==='file').map(e=>e.id)),['cv']);
  const r=await page.evaluate(async()=>{aaLoadActiveResume=async()=>({name:'test.txt',type:'text/plain',dataUrl:'data:text/plain;base64,VEVTVA=='});let plan=await planResume();await applyResume(plan);return document.querySelector('#cv').files[0].name;});assert.equal(r,'test.txt');
 });
 await test('shadow-root traversal preserves fields and respects hidden host', '<form id="application">'+fields+'<div id="host"></div><div id="hiddenHost" hidden></div></form>',async()=>{
  await page.evaluate(()=>{for(const id of ['host','hiddenHost'])document.getElementById(id).attachShadow({mode:'open'}).innerHTML='<label>City<input id="'+id+'City"></label>';});
  assert((await ids()).includes('hostCity'));assert(!(await ids()).includes('hiddenHostCity'));
 });
 await test('repeater add-job-alert is not selected', '<form class="application">'+fields+'<button type="button" id="alert">Add job alert</button><button type="button" id="exp">Add experience</button></form>',async()=>{
  const r=await page.evaluate(async()=>{ctx.profile.experience=[{title:'Engineer'}];window.clicked=[];document.querySelectorAll('button').forEach(b=>b.onclick=()=>clicked.push(b.id));await fillRepeaterSections(ctx);return clicked;});assert.deepEqual(r,['exp']);
 });
 await test('custom dropdown clicks only its associated popup', '<form class="application">'+fields+'<button id="country" type="button" role="combobox" aria-label="Country" aria-controls="countries">Select country</button><div role="listbox" id="countries" hidden><div role="option" id="pk">Pakistan</div></div></form><div role="listbox"><div role="option" id="unrelated">Pakistan</div></div>',async()=>{
  await page.evaluate(()=>{window.clicked=[];document.querySelector('#country').onclick=()=>document.querySelector('#countries').hidden=false;document.querySelector('#pk').onclick=()=>{clicked.push('pk');document.querySelector('#country').textContent='Pakistan';};document.querySelector('#unrelated').onclick=()=>clicked.push('wrong');});
  const n=await page.evaluate(()=>aaWithSubmitGuard(()=>fillCustomSelects(ctx)));assert.equal(n,1);assert.deepEqual(await page.evaluate(()=>clicked),['pk']);
 });
 await test('custom dropdown in filter widget never opened', '<form class="application">'+fields+'</form><div class="filter"><button type="button" role="combobox" id="city" aria-label="City">Select city</button></div>',async()=>{
  await page.evaluate(()=>{window.opened=false;document.querySelector('#city').onclick=()=>opened=true;});assert.equal(await page.evaluate(()=>fillCustomSelects(ctx)),0);assert.equal(await page.evaluate(()=>opened),false);
 });
 await test('ARIA radios respect lasso scope', '<form class="application">'+fields+'<div role="radiogroup" aria-label="Gender"><div role="radio" id="male" aria-label="Male" aria-checked="false">Male</div><div role="radio" id="female" aria-label="Female" aria-checked="false">Female</div></div></form>',async()=>{
  await page.evaluate(()=>{ctx.flat['personal.gender']='Male';document.querySelectorAll('[role=radio]').forEach(r=>r.onclick=()=>r.setAttribute('aria-checked','true'));});
  await page.evaluate(async()=>{const r=document.querySelector('[name=firstName]').getBoundingClientRect();await fillWithinBox({left:r.left+2,right:r.right-2,top:r.top+2,bottom:r.bottom-2});});
  assert.equal(await page.locator('#male').getAttribute('aria-checked'),'false');await page.evaluate(()=>run());assert.equal(await page.locator('#male').getAttribute('aria-checked'),'true');
 });
 await test('native radio groups still fill', '<form class="application">'+fields+'<fieldset><legend>Gender</legend><label>Male<input type="radio" name="gender" value="Male" id="male"></label><label>Female<input type="radio" name="gender" value="Female"></label></fieldset></form>',async()=>{
  await page.evaluate(()=>{ctx.flat['personal.gender']='Male';});await page.evaluate(()=>run());assert.equal(await page.locator('#male').isChecked(),true);
 });
 assert.deepEqual(errors,[],'browser runtime errors');
 console.log(`${passed} browser regression tests passed`);await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
