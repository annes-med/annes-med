const fs=require('fs'),vm=require('vm');
const code=fs.readFileSync(process.argv[2],'utf8');
// ---- mock sheet ----
const grid=[];const sheet={
  appendRow:r=>grid.push(r.slice()), setFrozenRows(){}, setRightToLeft(){},
  getLastRow:()=>grid.length, getLastColumn:()=>Math.max(...grid.map(r=>r.length)),
  getRange:(r,c,nr=1,nc=1)=>({
    getValues:()=>Array.from({length:nr},(_,i)=>Array.from({length:nc},(_,j)=>(grid[r-1+i]||[])[c-1+j]??'')),
    getValue:()=>(grid[r-1]||[])[c-1]??'', setValue:v=>{(grid[r-1]=grid[r-1]||[])[c-1]=v},
    setFontWeight(){return this},setBackground(){return this},setFontColor(){return this},setDataValidation(){return this},getRow:()=>r}),
  getDataRange:()=>({getValues:()=>grid.map(r=>r.slice())}),
};
let ss={getSheetByName:()=>grid.length?sheet:null,insertSheet:()=>sheet,toast:m=>log.push('TOAST '+m)};
const props={ECOTRACK_BASE:'https://world-express.ecotrack.dz/',ECOTRACK_TOKEN:'tok',PRODUCT_PRICE:'2500',CUSTOMER_PAYS_DELIVERY:'1'};
const log=[],calls=[],mails=[];
// ---- mock ecotrack: knows only 58 wilayas ----
const communes={16:[{nom:'Bab El Oued',wilaya_id:16,code_postal:'16009',has_stop_desk:1}],28:[{nom:'Bou Saada',wilaya_id:28,code_postal:'28016',has_stop_desk:1},{nom:"M'Sila",wilaya_id:28}]};
function fetchMock(url,opt){calls.push({url,method:opt.method,payload:opt.payload,auth:opt.headers.Authorization});
  const u=new URL(url),p=u.pathname.replace('/api/v1/','');let body;
  if(opt.headers.Authorization!=='Bearer tok') return resp(401,{message:'Unauthenticated'});
  if(p==='get/wilayas') body=Array.from({length:58},(_,i)=>({wilaya_id:i+1,wilaya_name:'W'+(i+1)}));
  else if(p==='get/communes') body=communes[u.searchParams.get('wilaya_id')]||[];
  else if(p==='get/fees') body={livraison:[{wilaya_id:16,tarif:'400',tarif_stopdesk:'250'},{wilaya_id:28,tarif:'700',tarif_stopdesk:'450'}]};
  else if(p==='create/order') body={success:true,tracking:'WEX'+opt.payload.reference};
  else if(p==='valid/order') body={success:true};
  else if(p==='get/trackings/info'){const ts=u.searchParams.getAll('trackings[]');body={};ts.forEach(t=>body[t]={tracking:t,status:'En livraison'});}
  else return resp(404,{message:'nf'});
  return resp(200,body);}
const resp=(c,b)=>({getResponseCode:()=>c,getContentText:()=>JSON.stringify(b)});
const cache={};
const ctx={console,
  SpreadsheetApp:{getActiveSpreadsheet:()=>ss,newDataValidation:()=>({requireValueInList(){return this},build(){}}),getUi:()=>{throw new Error('no ui')}},
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]??null,setProperty:(k,v)=>props[k]=v})},
  CacheService:{getScriptCache:()=>({get:k=>cache[k]??null,put:(k,v)=>cache[k]=v})},
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  MailApp:{sendEmail:m=>mails.push(m)}, Session:{getEffectiveUser:()=>({getEmail:()=>'owner@example.com'})},
  ContentService:{createTextOutput:t=>({setMimeType(){return this},getContent:()=>t}),MimeType:{JSON:'json'}},
  UrlFetchApp:{fetch:fetchMock}, ScriptApp:{}, DriveApp:{}};
vm.createContext(ctx);vm.runInContext(code,ctx);
const R=f=>JSON.parse(f.getContent());
// 1) two orders + duplicate + invalid
const base={phone:'0555123456',delivery:'إلى المنزل',qty:'2',address:'حي 100 مسكن'};
console.log('order1',R(ctx.doPost({parameter:{...base,orderId:'A1',name:'زبون 1',wilaya:'16 - الجزائر',commune:'باب الوادي',commune_fr:'Bab El Oued',wilaya_code:'16',wilaya_code_58:'16'}})));
console.log('order2',R(ctx.doPost({parameter:{...base,qty:'1',delivery:'إلى مكتب التوصيل',orderId:'B2',name:'زبون 2',wilaya:'68 - بوسعادة',commune:'بوسعادة',commune_fr:'Bou Saâda',wilaya_code:'68',wilaya_code_58:'28'}})));
console.log('dup   ',R(ctx.doPost({parameter:{...base,orderId:'A1',name:'زبون 1',wilaya:'16 - الجزائر',commune:'باب الوادي'}})));
console.log('bad   ',R(ctx.doPost({parameter:{...base,phone:'123',orderId:'C3',name:'x',wilaya:'16',commune:'y'}})));
console.log('mails',mails.length,'| rows',grid.length-1);
console.log('fee GET',R(ctx.doGet({parameter:{action:'fee',w:'68',w58:'28'}})));
// 2) confirm both, send
const h=Object.fromEntries(grid[0].map((c,i)=>[c,i]));
grid[1][h['الحالة']]='مؤكَّد';grid[2][h['الحالة']]='مؤكَّد';
ctx.sendConfirmed();
calls.filter(c=>c.url.includes('create/order')).forEach(c=>console.log('CREATE',JSON.stringify(c.payload)));
console.log('valid calls',calls.filter(c=>c.url.includes('valid/order')).length);
for(const r of grid.slice(1)) console.log('ROW',r[h['رقم الطلب']],'|',r[h['الحالة']],'|',r[h['رقم التتبع']],'|',r[h['حالة التوصيل']]);
// 3) tracking
ctx.refreshTracking();
for(const r of grid.slice(1)) console.log('TRACK',r[h['رقم التتبع']],'|',r[h['حالة التوصيل']]);
// 4) wrong token
props.ECOTRACK_TOKEN='bad';for(const k in cache)delete cache[k];grid[1][h['الحالة']]='مؤكَّد';grid[1][h['رقم التتبع']]='';
ctx.sendConfirmed();console.log('BADTOKEN',grid[1][h['الحالة']],'|',grid[1][h['حالة التوصيل']]);
console.log(log.join('\n'));
