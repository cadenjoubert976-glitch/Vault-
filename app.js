/* Vault — personal money app. Data lives only on this device (localStorage). */
(function(){
'use strict';
var LS_KEY='vault_v2',PIN_KEY='vault_pin',DPM=30.44;
var MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var MONL=['January','February','March','April','May','June','July','August','September','October','November','December'];
var WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
var PAL={
 light:{fixed:'#9BA8A0',business:'#0B3D2A',goals:'#5FD39A',emergency:'#16A35F',invest:'#0B6B3E',fun:'#A8E6C4',buffer:'#D3E2D8',unused:'#EDF2EE',extra:['#7FB79A','#3E7F5E','#C3D9CB','#5E8F75'],red:'#D9483B'},
 dark:{fixed:'#4A5A50',business:'#E8F5EC',goals:'#7BE3AE',emergency:'#22C26E',invest:'#128048',fun:'#B5F0CF',buffer:'#2A4434',unused:'#16201A',extra:['#5C9E7C','#9CCBB2','#2F6B4C','#C8E6D5'],red:'#F0675A'}
};
var PAYOPTS=[{v:'debit',label:'Debit card'},{v:'credit',label:'Credit card'},{v:'order',label:'Debit order'},{v:'other',label:'Cash / other'}];
var PAYNAME={debit:'Debit card',credit:'Credit card',order:'Debit order',other:'Cash / other'};

/* ---------- helpers ---------- */
function uid(){return Math.random().toString(36).slice(2,9);}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function num(v){if(typeof v==='number')return isFinite(v)?v:0;var s=String(v==null?'':v).replace(/[^0-9.,\-]/g,'');if(!s)return 0;
 var c=s.lastIndexOf(','),d=s.lastIndexOf('.'),k=Math.max(c,d);
 if(k>=0){var after=s.length-k-1;if((c>=0&&d>=0)||(after>=1&&after<=2))s=s.slice(0,k).replace(/[.,]/g,'')+'.'+s.slice(k+1);else s=s.replace(/[.,]/g,'');}
 var n=parseFloat(s);return isFinite(n)?n:0;}
function fmtIn(v){if(v===''||v==null)return '';var n=num(v);return n.toLocaleString('en-US',{minimumFractionDigits:(Math.round(n*100)%100)?2:0,maximumFractionDigits:2});}
function fmtInputs(scope){scope.querySelectorAll('input[inputmode=decimal]').forEach(function(i){if(i.value!=='')i.value=fmtIn(i.value);if(!i.dataset.fmt){i.dataset.fmt=1;i.addEventListener('blur',function(){if(i.value!=='')i.value=fmtIn(i.value);});}});}
function R(n){n=Math.round(+n||0);return (n<0?'−R':'R')+Math.abs(n).toLocaleString('en-US');}
function R2(n){n=+n||0;return (n<0?'−R':'R')+Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}
function kfmt(v){if(Math.abs(v)>=1000){var k=v/1000;return 'R'+(k%1?k.toFixed(1):k)+'k';}return 'R'+Math.round(v);}
function ymP(s){var p=String(s).split('-');return {y:+p[0],m:+p[1]};}
function addM(s,k){var p=ymP(s);var t=p.y*12+(p.m-1)+k;return Math.floor(t/12)+'-'+String(t%12+1).padStart(2,'0');}
function mLeft(fromYM,deadline){var a=ymP(fromYM);var d=new Date(deadline+'T00:00:00');if(isNaN(d))return 1;return (d.getFullYear()-a.y)*12+(d.getMonth()+1-a.m)+1;}
function ymL(s,long){var p=ymP(s);return (long?MONL:MON)[p.m-1]+' '+p.y;}
function dL(d){var x=new Date(d+'T00:00:00');if(isNaN(x))return d||'';return x.getDate()+' '+MON[x.getMonth()]+' '+x.getFullYear();}
function tyEnd(ym){var p=ymP(ym);return p.m>=3?p.y+1:p.y;}
function trunc(s,n){s=String(s);return s.length>n?s.slice(0,n-1)+'…':s;}
function clone(o){return JSON.parse(JSON.stringify(o));}
function todayISO(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function thisYM(){return todayISO().slice(0,7);}
function ord(n){return n+((n%10===1&&n!==11)?'st':(n%10===2&&n!==12)?'nd':(n%10===3&&n!==13)?'rd':'th');}
function findById(arr,id){for(var i=0;i<arr.length;i++)if(arr[i].id===id)return arr[i];return null;}
function sumObj(o){return Object.keys(o||{}).reduce(function(a,k){return a+(+o[k]||0);},0);}

/* ---------- state ---------- */
function blankState(){return {
 v:2,updatedAt:0,lastBackup:0,
 settings:{funTarget:600,funFloor:300,funShare:0.35,bufferPct:0.05,bufferMin:100,efMonths:3,efShare:0.6,payday:25,tfsaLimit:46000,tfsaUsed:0,dadGift:0,theme:'light',fuelPrice:30.24,fuelMonth:''},
 buckets:[
  {id:'fixed',name:'Fixed costs',why:'The stuff that leaves anyway. Paid first so nothing bounces.'},
  {id:'business',name:'Business',amount:0,why:"Owner's contribution, kept in its own account so business and personal never mix."},
  {id:'goals',name:'Goals',why:'Deadline goals get paid first: the exact monthly amount that lands each one on time.'},
  {id:'emergency',name:'Emergency fund',why:"3 months of costs so a broken car or a short month doesn't wreck you."},
  {id:'invest',name:'Investing',why:'Long-term TFSA money. Start early and let compounding work.'},
  {id:'fun',name:'Fun',why:'Going out, treats, the odd online order. Never zero.'},
  {id:'buffer',name:'Buffer',why:"Small cushion for price jumps and forgotten costs."}
 ],
 costs:[],goals:[],
 ef:{saved:0},pf:{monthly:0,start:thisYM(),balance:''},
 bank:{anchor:0,anchorDate:todayISO(),anchorAt:Date.now(),actual:0},
 nw:{tfsa:0,cc:0,other:0,otherLabel:'Other assets'},
 cc:{limit:1000,owedStart:0,startAt:Date.now()},autoPosted:{},
 current:{month:thisYM(),salary:0,dad:0,extras:[],tx:[],adj:[],roll:{}},
 history:[]
};}
function migrate(o){
 var b=blankState();
 if(!o||typeof o!=='object')return b;
 o.v=2;
 o.settings=Object.assign({},b.settings,o.settings||{});
 if(!o.buckets||!o.buckets.length)o.buckets=b.buckets;
 o.costs=o.costs||[];o.goals=o.goals||[];
 o.ef=o.ef||{saved:0};o.pf=o.pf||b.pf;o.bank=o.bank||b.bank;o.nw=Object.assign({},b.nw,o.nw||{});
 o.current=Object.assign({},b.current,o.current||{});
 ['extras','tx','adj'].forEach(function(k){if(!Array.isArray(o.current[k]))o.current[k]=[];});
 if(!o.current.roll||typeof o.current.roll!=='object')o.current.roll={};
 o.history=o.history||[];
 if(!o.settings.fuelMonth)o.settings.fuelMonth=thisYM();
 if(!o.cc)o.cc={limit:1000,owedStart:num((o.nw||{}).cc)||0,startAt:Date.now()};
 if(!o.autoPosted)o.autoPosted={};
 if(!o.cash)o.cash={start:0,startAt:Date.now()};
 o.costs.forEach(function(c){
  if(!c.id)c.id=uid();
  if(c.fuel===undefined&&/fuel|petrol/i.test(c.name||'')&&c.freq==='monthly'){c.fuel=true;c.litres=Math.round(num(c.amount)/(o.settings.fuelPrice||30)*10)/10;}
 });
 o.current.tx.forEach(function(t){if(!t.id)t.id=uid();});
 return o;
}
var S=null;
try{S=JSON.parse(localStorage.getItem(LS_KEY)||'null');}catch(e){S=null;}
var firstRun=!S;
S=migrate(S);

var tab='plan',moreSub='nw',openMonth=null,locked=false,histFilter='all',bankOpen=false;
var hh=(location.hash||'').slice(1);
if(['plan','spend','goals','history','more'].indexOf(hh)>=0)tab=hh;

function save(msg){autoPost();S.updatedAt=Date.now();try{localStorage.setItem(LS_KEY,JSON.stringify(S));}catch(e){toast('Storage full or blocked');}render();if(msg)toast(msg);}
function pal(){return PAL[document.documentElement.dataset.theme==='dark'?'dark':'light'];}
function applyTheme(){var t=S.settings.theme;if(t==='auto')t=(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';document.documentElement.dataset.theme=t;var m=document.querySelector('meta[name=theme-color]');if(m)m.content=t==='dark'?'#040705':'#0F8A4F';}

/* ---------- money maths ---------- */
function costM(c){if(c.fuel)return num(c.litres)*num(S.settings.fuelPrice);var a=num(c.amount);if(c.freq==='days')return a*DPM/Math.max(1,num(c.days)||30);if(c.freq==='yearly')return a/12;return a;}
function costEach(c){return c.fuel?costM(c):num(c.amount);}
function B(id){for(var i=0;i<S.buckets.length;i++)if(S.buckets[i].id===id)return S.buckets[i];return {id:id,name:id,why:''};}
function ratioOf(h){if(h.actual==null||h.actual==='')return 1;var p=h.plannedSave||0;return p>0?Math.max(0,num(h.actual))/p:1;}
function goalSaved(g,before){var s=num(g.saved);S.history.forEach(function(h){if(before&&h.month>=before)return;var r=ratioOf(h);s+=((h.goalAlloc&&h.goalAlloc[g.id])||0)*r+((h.directed&&h.directed[g.id])||0);});return s;}
function efSaved(before){var s=num(S.ef.saved);S.history.forEach(function(h){if(before&&h.month>=before)return;var r=ratioOf(h);s+=((h.alloc&&h.alloc.emergency)||0)*r+((h.directed&&h.directed.emergency)||0);});return s;}
function bucketColor(id){var p=pal();if(String(id).indexOf('goal:')===0)return p.goals;if(p[id])return p[id];var cs=S.buckets.filter(function(b){return b.custom;});var i=cs.findIndex(function(b){return b.id===id;});return p.extra[(i<0?0:i)%p.extra.length];}
function isMove(id){return id==='paidfor'||id==='cashin'||id==='ccpay'||id==='business'||id==='emergency'||id==='invest'||id==='goals'||String(id).indexOf('goal:')===0;}
function targetName(v){if(v==='ccpay')return 'Credit card payment';if(v==='cashin')return 'Cash in';if(v==='paidfor')return 'Paid for someone';if(String(v).indexOf('goal:')===0){var g=findById(S.goals,v.slice(5));return g?g.name:'Goal';}return B(v).name;}

function compute(){
 var st=S.settings,cur=S.current,m=cur.month;
 var extrasSplit=0,directed={},dirTotal=0;
 cur.extras.forEach(function(e){var a=num(e.amount);if(!e.to||e.to==='split')extrasSplit+=a;else{directed[e.to]=(directed[e.to]||0)+a;dirTotal+=a;}});
 var income=num(cur.salary)+num(cur.dad)+extrasSplit;
 var fixed=S.costs.reduce(function(a,c){return a+costM(c);},0);
 var biz=num(B('business').amount);
 var customs=S.buckets.filter(function(b){return b.custom;});
 var customTotal=customs.reduce(function(a,b){return a+num(b.amount);},0);
 var needs=fixed+biz+customTotal,L=income-needs,efTarget=st.efMonths*needs,efNow=efSaved(m)+(directed.emergency||0);
 var goals=S.goals.map(function(g){var saved=goalSaved(g,m)+(directed[g.id]||0);var rem=Math.max(0,num(g.target)-saved);var ml0=mLeft(m,g.deadline);var ml=Math.max(1,ml0);var need=(g.inSplit&&rem>0)?rem/ml:0;return {g:g,saved:saved,rem:rem,ml:ml,past:String(g.deadline)<todayISO(),need:need,alloc:0};});
 var G=goals.reduce(function(a,x){return a+x.need;},0);
 var alloc={fixed:fixed,business:biz,goals:0,emergency:0,invest:0,fun:0,buffer:0};
 customs.forEach(function(b){alloc[b.id]=num(b.amount);});
 var warn=null,avail=L-st.funFloor-st.bufferMin;
 if(L<=0){alloc.fun=st.funFloor;warn={type:'deficit',amount:needs+st.funFloor-income};}
 else if(G>avail){
  var f=avail>0?avail/G:0;goals.forEach(function(x){x.alloc=x.need*f;});alloc.goals=Math.max(0,avail);
  if(avail>=0){alloc.fun=st.funFloor;alloc.buffer=st.bufferMin;}else{alloc.fun=Math.min(st.funFloor,L);alloc.buffer=Math.max(0,L-alloc.fun);}
  var short=G-Math.max(0,avail),big=goals.slice().sort(function(a,b){return b.need-a.need;})[0],nn=big.need-short,sug=[];
  if(nn<=0)sug.push('Pause <b>'+esc(big.g.name)+'</b> this month, or push its date way out.');
  else sug.push('Push <b>'+esc(big.g.name)+'</b> to <b>'+ymL(addM(m,Math.ceil(big.rem/nn)-1),true)+'</b> (then it needs '+R(nn)+'/month).');
  var top=S.costs.slice().sort(function(a,b){return costM(b)-costM(a);}).slice(0,2);
  if(top.length)sug.push('Or cut '+R(short)+' from costs. Biggest: '+top.map(function(c){return esc(c.name)+' '+R(costM(c));}).join(', ')+'.');
  sug.push('Or put overtime / sales money into the split.');
  warn={type:'short',amount:short,sug:sug};
 }else{
  goals.forEach(function(x){x.alloc=x.need;});alloc.goals=G;
  var Rm=L-G,fun=Math.min(st.funTarget,Math.max(st.funFloor,Rm*st.funShare)),buf=Math.max(st.bufferMin,Rm*st.bufferPct),rest=Rm-fun-buf;
  if(rest<0){buf=st.bufferMin;fun=Math.max(Math.min(st.funFloor,Rm),Rm-buf);rest=Math.max(0,Rm-fun-buf);}
  var gap=Math.max(0,efTarget-efNow),ef=gap>0?Math.min(gap,rest*st.efShare):0;
  alloc.emergency=ef;alloc.invest=rest-ef;alloc.fun=fun;alloc.buffer=buf;
 }
 var keys=Object.keys(alloc);
 keys.forEach(function(k){alloc[k]=Math.round(alloc[k]);});
 goals.forEach(function(x){x.alloc=Math.round(x.alloc);});
 alloc.goals=goals.reduce(function(a,x){return a+x.alloc;},0);
 if(!warn||warn.type==='short'){var sum=keys.reduce(function(a,k){return a+alloc[k];},0);alloc.buffer=Math.max(0,alloc.buffer+(Math.round(income)-sum));}
 // budgets = plan + rollover + covers
 var bud={};keys.forEach(function(k){if(k!=='goals')bud[k]=alloc[k];});
 goals.forEach(function(x){bud['goal:'+x.g.id]=x.alloc;});
 var roll=cur.roll||{};Object.keys(roll).forEach(function(k){bud[k]=(bud[k]||0)+num(roll[k]);});
 (cur.adj||[]).forEach(function(a){bud[a.from]=(bud[a.from]||0)-num(a.amount);bud[a.to]=(bud[a.to]||0)+num(a.amount);});
 var saveAmt=alloc.goals+alloc.emergency+alloc.invest;
 return {income:income,rollTotal:sumObj(roll),fixed:fixed,biz:biz,customs:customs,needs:needs,L:L,G:G,goals:goals,alloc:alloc,bud:bud,warn:warn,efTarget:efTarget,efNow:efNow,directed:directed,dirTotal:dirTotal,saveAmt:saveAmt,saveRate:income>0?saveAmt/income:0};
}
function spentMap(txs){var m={};(txs||[]).forEach(function(t){m[t.bucket]=(m[t.bucket]||0)+num(t.amount);});return m;}

/* rows of bucket budget vs used, in display order */
function trackRows(c,txs,bud){
 var sp=spentMap(txs),rows=[];bud=bud||c.bud;
 S.buckets.forEach(function(b){
  if(b.id==='goals'){c.goals.forEach(function(x){var k='goal:'+x.g.id;if(!x.g.inSplit&&!sp[k])return;rows.push({id:k,name:x.g.name,budget:bud[k]||0,used:sp[k]||0,move:true,outside:!x.g.inSplit});});return;}
  rows.push({id:b.id,name:b.name,budget:bud[b.id]||0,used:sp[b.id]||0,move:isMove(b.id)});
 });
 return rows;
}

/* pay period */
function payPeriod(){
 var pd=S.settings.payday||25,t=new Date(),today=new Date(t.getFullYear(),t.getMonth(),t.getDate());
 function mk(y,m){var last=new Date(y,m+1,0).getDate();return new Date(y,m,Math.min(pd,last));}
 var thisPd=mk(t.getFullYear(),t.getMonth()),start,end;
 if(today>=thisPd){start=thisPd;end=mk(t.getFullYear(),t.getMonth()+1);}else{start=mk(t.getFullYear(),t.getMonth()-1);end=thisPd;}
 var total=Math.round((end-start)/864e5),gone=Math.round((today-start)/864e5),left=Math.max(1,Math.round((end-today)/864e5));
 return {start:start,end:end,total:total,gone:gone,left:left,elapsed:Math.min(1,gone/Math.max(1,total)),daysToPay:Math.round((end-today)/864e5)};
}
function safeToSpend(c){
 var rows=trackRows(c,S.current.tx),pp=payPeriod();
 var sp=rows.filter(function(r){return r.id==='fun'||r.id==='buffer';});
 var bud=sp.reduce(function(a,r){return a+r.budget;},0),used=sp.reduce(function(a,r){return a+r.used;},0),left=bud-used;
 var fun=rows.filter(function(r){return r.id==='fun';})[0]||{budget:0,used:0};
 var usedPct=bud>0?used/bud:0;
 return {left:left,perDay:Math.max(0,left)/pp.left,days:pp.left,pp:pp,usedPct:usedPct,fast:usedPct>pp.elapsed+0.1&&used>0,fun:fun};
}

/* score: how am I doing */
function scoreNow(c){
 var rows=trackRows(c,S.current.tx),pp=payPeriod(),tips=[],pts=0;
 var spend=rows.filter(function(r){return !r.move&&r.id!=='fixed';});
 var sb=spend.reduce(function(a,r){return a+r.budget;},0),su=spend.reduce(function(a,r){return a+r.used;},0),up=sb>0?su/sb:0;
 // 1 pace (30)
 var paceRatio=pp.elapsed>0.02?up/pp.elapsed:up*5;var pace=paceRatio<=1.05?30:paceRatio<=1.3?20:paceRatio<=1.6?10:0;pts+=pace;
 var earned={pace:pace,over:0,moved:0,rate:0,bank:0},MAX={pace:30,over:20,moved:25,rate:15,bank:10,cc:0};
 if(pace===30)tips.push({id:'pace',k:'ok',t:'Spending pace is good: '+Math.round(up*100)+'% of your spending money used, '+Math.round(pp.elapsed*100)+'% of the month gone.'});
 else tips.push({id:'pace',k:pace>=20?'mid':'bad',t:'You\'re spending fast: '+Math.round(up*100)+'% used with only '+Math.round(pp.elapsed*100)+'% of the month gone. Slow down to '+R(safeToSpend(c).perDay)+'/day.'});
 // 2 nothing over (20)
 var over=rows.filter(function(r){return !r.move&&r.used>r.budget+0.5;});var ov=Math.max(0,20-over.length*8);pts+=ov;earned.over=ov;
 if(over.length)tips.push({id:'over',k:'bad',t:over.map(function(r){return esc(r.name)+' is over by '+R(r.used-r.budget);}).join(', ')+'. Tap "Cover it" on the Spend tab to move money from another bucket.'});
 else tips.push({id:'over',k:'ok',t:'No bucket is over budget.'});
 // 3 savings moved (25)
 var mv=rows.filter(function(r){return r.move&&!r.outside&&r.budget>0;});var mb=mv.reduce(function(a,r){return a+r.budget;},0),mu=mv.reduce(function(a,r){return a+Math.min(r.used,r.budget);},0);
 var grace=pp.gone<=3;var mpts=mb<=0?25:(grace?25:Math.round(25*Math.min(1,mu/mb)));pts+=mpts;earned.moved=mpts;
 if(mb>0&&!grace&&mu<mb-1)tips.push({id:'moved',k:mpts>=15?'mid':'bad',t:R(mb-mu)+' of savings/transfers not moved yet. Move it and log it on the Spend tab so it doesn\'t get spent.'});
 else if(mb>0)tips.push({id:'moved',k:'ok',t:grace?'Payday week: move your savings and business money in the next few days.':'All savings moved for this month.'});
 // 4 save rate (15)
 var sr=c.saveRate;var spts=Math.round(15*Math.min(1,sr/0.3));pts+=spts;earned.rate=spts;
 tips.push({id:'rate',k:sr>=0.3?'ok':sr>=0.2?'mid':'bad',t:'Saving '+Math.round(sr*100)+'% of income'+(sr>=0.3?'. That\'s the target for living at home.':'. Aim for 30%+: put overtime and sales money into goals.')});
 // 5 bank check (10)
 var bi=bankInfo(),ad=Math.abs(bi.diff),bpts=ad<50?10:ad<300?5:0;pts+=bpts;earned.bank=bpts;
 if(bpts<10)tips.push({id:'bank',k:bpts?'mid':'bad',t:'Bank check is '+R(ad)+' '+(bi.diff<0?'short':'over')+'. Log any missing purchases or debit orders.'});
 var cci=ccInfo();if(cci.pct>0.3)tips.push({id:'cc',k:cci.pct>0.7?'bad':'mid',t:'Credit card is '+Math.round(cci.pct*100)+'% used ('+R(cci.owed)+' of '+R(cci.limit)+'). Pay it down before the statement date. Under 30% helps your credit score.'});
 var td=S.current.tipDone||{};
 tips.forEach(function(t){var o=td[t.id];if(o===true&&t.k!=='ok'){pts+=(MAX[t.id]||0)-(earned[t.id]||0);t.k='ok';t.mine=1;}else if(o===false&&t.k==='ok'){pts-=(earned[t.id]||0);t.k='bad';t.mine=1;}});
 var grade=pts>=85?'Crushing it':pts>=70?'On track':pts>=50?'Watch it':'Off track';
 var order={bad:0,mid:1,ok:2};tips.sort(function(a,b){return order[a.k]-order[b.k];});
 return {score:Math.round(pts),grade:grade,tips:tips};
}
function finalScore(rec){
 var tx=rec.tx||[],sp=spentMap(tx),pts=0,bud=rec.bud||{};
 var spendIds=Object.keys(bud).filter(function(k){return !isMove(k)&&k!=='fixed';});
 var sb=spendIds.reduce(function(a,k){return a+(bud[k]||0);},0),su=spendIds.reduce(function(a,k){return a+(sp[k]||0);},0);
 pts+=sb<=0||su<=sb?30:su<=sb*1.15?20:su<=sb*1.3?10:0;
 var over=Object.keys(bud).filter(function(k){return !isMove(k)&&(sp[k]||0)>(bud[k]||0)+0.5;}).length;pts+=Math.max(0,20-over*8);
 var r=ratioOf(rec);pts+=Math.round(25*Math.min(1,r));
 pts+=Math.round(15*Math.min(1,(rec.income>0?rec.plannedSave/rec.income:0)/0.3));
 pts+=10;
 return Math.round(pts);
}
function gradeOf(p){return p>=85?'Crushing it':p>=70?'On track':p>=50?'Watch it':'Off track';}

function tfsaInfo(c){
 var st=S.settings,te=tyEnd(S.current.month),used=num(st.tfsaUsed);
 S.history.forEach(function(h){if(tyEnd(h.month)===te){used+=((h.alloc&&h.alloc.invest)||0)*ratioOf(h)+((h.directed&&h.directed.invest)||0);}});
 used+=(c.directed.invest||0);
 var cp=ymP(S.current.month),rem=(te*12+1)-(cp.y*12+cp.m-1)+1;
 var gift=num(st.dadGift)>0&&!(c.directed.invest)&&ymP(S.current.month).m!==3?num(st.dadGift):0;
 return {te:te,used:used,rem:rem,gift:gift,projected:used+rem*c.alloc.invest+gift,limit:num(st.tfsaLimit)};
}
function pfInfo(){
 var pf=S.pf,cur=ymP(S.current.month),st=ymP(pf.start||thisYM()),months=Math.max(0,(cur.y*12+cur.m)-(st.y*12+st.m));
 var fromStatement=num(pf.balance)>0,now=fromStatement?num(pf.balance):months*num(pf.monthly);
 var ct=null;S.goals.forEach(function(g){if(/cape/i.test(g.name))ct=g;});
 var dl=ct?ct.deadline:addM(S.current.month,36)+'-28',toMove=Math.max(0,mLeft(S.current.month,dl)-1),atMove=now+toMove*num(pf.monthly);
 return {now:now,fromStatement:fromStatement,months:months,atMove:atMove,moveYM:dl.slice(0,7),potNow:now/3,potMove:atMove/3};
}
function stays(bucket){if(bucket==='emergency')return true;if(String(bucket).indexOf('goal:')===0){var g=findById(S.goals,bucket.slice(5));return !!(g&&g.inSplit);}return false;}
function bankInfo(){
 var bk=S.bank,today=todayISO(),pd=S.settings.payday||25,inc=0,paydays=[],ym=String(bk.anchorDate).slice(0,7),guard=0;
 while(guard++<60){var d=ym+'-'+String(pd).padStart(2,'0');if(d>today)break;
  if(d>bk.anchorDate){var hr=null;S.history.forEach(function(h){if(h.month===ym)hr=h;});var amt;
   if(hr)amt=hr.income+sumObj(hr.directed);
   else{amt=num(S.current.salary)+num(S.current.dad);if(ym===S.current.month)amt+=S.current.extras.reduce(function(a,e){return a+num(e.amount);},0);}
   inc+=amt;paydays.push({d:d,amt:amt});}
  ym=addM(ym,1);}
 var all=[];S.history.forEach(function(h){(h.tx||[]).forEach(function(t){all.push(t);});});(S.current.tx||[]).forEach(function(t){all.push(t);});
 var out=0,internal=0,items=[];
 all.forEach(function(t){var d=t.date||'',after=d?(d>bk.anchorDate||(d===bk.anchorDate&&(t.at||0)>bk.anchorAt)):(t.at||0)>bk.anchorAt;if(!after||t.card==='credit'||t.card==='cash'||t.card==='other')return;if(stays(t.bucket))internal+=num(t.amount);else{out+=num(t.amount);items.push(t);}});
 var expected=num(bk.anchor)+inc-out;
 return {expected:expected,inc:inc,out:out,internal:internal,paydays:paydays,items:items,diff:num(bk.actual)-expected};
}
function allTx(){var a=[];S.history.forEach(function(h){(h.tx||[]).forEach(function(t){a.push(t);});});(S.current.tx||[]).forEach(function(t){a.push(t);});return a;}
function ccInfo(){var c=S.cc,owed=num(c.owedStart);allTx().forEach(function(t){if((t.at||0)<=c.startAt)return;if(t.card==='credit'&&t.bucket!=='ccpay')owed+=num(t.amount);if(t.bucket==='ccpay')owed-=num(t.amount);});owed=Math.max(0,Math.round(owed*100)/100);var lim=num(c.limit)||1000;return {owed:owed,limit:lim,avail:lim-owed,pct:owed/lim};}
/* fixed costs with a date come off by themselves on that day */
function autoPost(){
 if(firstRun)return;var t=new Date(),ym=thisYM(),td=todayISO(),last=new Date(t.getFullYear(),t.getMonth()+1,0).getDate(),changed=false;
 chargeItems().forEach(function(x){if(x.freq!=='monthly'||!x.day)return;var d=ym+'-'+String(Math.min(x.day,last)).padStart(2,'0');if(d>td)return;var key=x.id+'|'+ym;if(S.autoPosted[key])return;S.autoPosted[key]=1;changed=true;
  if(S.current.tx.some(function(tx){return tx.note===x.name&&String(tx.date||'').slice(0,7)===ym;}))return;
  S.current.tx.push({id:uid(),src:'auto',amount:Math.round(x.amt*100)/100,note:x.name,bucket:x.biz?'business':'fixed',card:x.card==='credit'?'credit':'debit',date:d,at:new Date(d+'T08:00:00').getTime()});});
 if(changed){S.updatedAt=Date.now();try{localStorage.setItem(LS_KEY,JSON.stringify(S));}catch(e){}}
}
function cashInfo(){var c=S.cash,b=num(c.start);allTx().forEach(function(t){if((t.at||0)<=c.startAt)return;if(t.bucket==='cashin')b+=num(t.amount);else if(t.card==='cash')b-=num(t.amount);});return Math.round(b*100)/100;}
function cashFlow(){
 var bal=cashInfo(),m=modal('<h3 class="serif">Cash on hand</h3><div class="sub2">'+R2(bal)+' in your wallet. Cash buys come off here, not your bank.</div><button class="btn g block" data-cs="atm">Took cash from the ATM</button><button class="btn line block" style="margin-top:8px" data-cs="swap">Paid on my card, they gave me cash</button><button class="btn line block" style="margin-top:8px" data-cs="got">Got cash (sale, gift, change)</button><button class="btn line block" style="margin-top:8px" data-cs="count">Counted my cash: set the amount</button>');
 m.addEventListener('click',function(e){var b=e.target.closest('[data-cs]');if(!b)return;m.remove();var w=b.dataset.cs;
  if(w==='swap'){sheet('Paid for someone',[{k:'who',label:'Who / what for',value:'',ph:'e.g. lunch for Nick'},{k:'amount',label:'Amount you paid on your card',type:'money',value:''},{k:'card',label:'Paid with',type:'chips',options:[{v:'debit',label:'Debit card',c:'#18A862'},{v:'credit',label:'Credit card',c:'#2a2f2c'}],value:'debit'},{k:'cash',label:'Cash they gave you (blank = same amount)',type:'money',value:''}],function(o){var a=num(o.amount);if(!(a>0)){toast('Add the amount you paid');return false;}var cg=o.cash===''?a:num(o.cash),nm=o.who||'someone',now=Date.now();
    S.current.tx.push({id:uid(),src:'manual',at:now,amount:Math.round(a*100)/100,note:'Paid for '+nm,bucket:'paidfor',card:o.card||'debit',date:todayISO()});
    if(cg>0)S.current.tx.push({id:uid(),src:'manual',at:now+1,amount:Math.round(cg*100)/100,note:'Cash from '+nm,bucket:'cashin',card:'other',date:todayISO()});
    save('Card −'+R(a)+' · cash +'+R(cg)+'. Your buckets don\'t change');},null,'Your card pays, your wallet gets the cash back. It isn\'t your spending, so no bucket changes. The money just moves from your card to your cash.','Save');return;}
  if(w==='count'){sheet('How much cash do you have?',[{k:'amount',label:'Cash in your wallet',type:'money',value:bal}],function(o){S.cash.start=num(o.amount);S.cash.startAt=Date.now();save('Cash set to '+R2(num(o.amount)));});return;}
  sheet(w==='atm'?'ATM withdrawal':'Cash in',[{k:'amount',label:'How much',type:'money',value:''},{k:'note',label:'What was it',value:w==='atm'?'ATM withdrawal':'',ph:'e.g. sold airsoft kit'}],function(o){var a=num(o.amount);if(!(a>0)){toast('Add an amount');return false;}
   S.current.tx.push({id:uid(),src:'manual',at:Date.now(),amount:Math.round(a*100)/100,note:o.note||(w==='atm'?'ATM withdrawal':'Cash in'),bucket:'cashin',card:w==='atm'?'debit':'other',date:todayISO()});save(R(a)+' added to cash'+(w==='atm'?', taken off your bank':''));},null,w==='atm'?'Moves money from your bank to your wallet. Your buckets don\'t change; log what you buy with it as Cash.':'Cash that didn\'t come from your bank. Sales for the MacBook? Also add them under Money in → extra money.');
 });
}
function cardsHTML(){var bi=bankInfo(),cc=ccInfo(),pc=Math.min(100,cc.pct*100),col=cc.pct<=0.3?'#3FDC8C':cc.pct<=0.7?'#E3A73A':'#F0675A';
 var chip='<i class="emv"></i>',wave='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="rgba(255,255,255,.8)" stroke-width="1.8"><path d="M8 7a7 7 0 010 10M12 5a10 10 0 010 14M16 3a13 13 0 010 18"/></svg>';
 return '<div class="cards"><div class="pcard debit" data-act="bankEdit"><div class="pc-top"><b>DEBIT</b>'+wave+'</div>'+chip+'<div><div class="pc-amt serif">'+R2(S.bank.actual)+'</div><div class="pc-sub">in your bank · should be '+R(bi.expected)+'</div></div></div><div class="pcard credit" data-act="ccPay"><div class="pc-top"><b>CREDIT</b>'+wave+'</div>'+chip+'<div><div class="pc-amt serif">'+R(cc.avail)+' <small>left</small></div><div class="pc-bar"><i style="width:'+pc.toFixed(1)+'%;background:'+col+'"></i></div><div class="pc-sub">'+R(cc.owed)+' of '+R(cc.limit)+' used · tap to pay</div></div></div><div class="pcard cash" data-act="cash"><div><div class="pc-top"><b>CASH</b></div><div class="pc-amt serif">'+R2(cashInfo())+'</div></div><div class="pc-sub" style="text-align:right">on hand<br>tap to update</div></div></div>';}
function netWorth(){var p=pfInfo(),inPF=!!S.nw.includePF;var items=[{k:'Bank (all accounts)',v:num(S.bank.actual)},{k:'Cash on hand',v:cashInfo()},{k:'TFSA / investments',v:num(S.nw.tfsa)},{k:'Provident fund'+(p.fromStatement?'':' (est.)'),v:p.now,off:!inPF},{k:S.nw.otherLabel||'Other assets',v:num(S.nw.other)},{k:'Credit card owed',v:-ccInfo().owed}];return {items:items,total:items.reduce(function(a,i){return a+(i.off?0:i.v);},0)};}
function chargeItems(){var l=S.costs.map(function(x){return {id:x.id,name:x.name,amt:costEach(x),freq:x.fuel?'fuel':x.freq,day:x.day,card:x.card,biz:false,days:x.days,prev:x.prevAmount,cost:x};});var b=B('business');if(num(b.amount)>0)l.unshift({id:'business',name:b.name+' debit order',amt:num(b.amount),freq:'monthly',day:b.day,card:b.card||'order',biz:true});return l;}
function nextCharge(day){var t=new Date(),y=t.getFullYear(),m=t.getMonth();function mk(yy,mm){var last=new Date(yy,mm+1,0).getDate();return new Date(yy,mm,Math.min(day,last));}var today=new Date(y,m,t.getDate()),d=mk(y,m),passed=d<today,nx=passed?mk(y,m+1):d;return {passed:passed,next:nx,days:Math.round((nx-today)/864e5)};}
function firstWednesday(){var t=new Date(),d=new Date(t.getFullYear(),t.getMonth(),1);while(d.getDay()!==3)d.setDate(d.getDate()+1);return d;}
function fuelDue(){var fw=firstWednesday(),t=new Date();var today=new Date(t.getFullYear(),t.getMonth(),t.getDate());return S.costs.some(function(c){return c.fuel;})&&today>=fw&&S.settings.fuelMonth!==thisYM();}

/* ---------- svg ---------- */
function arc(cx,cy,ro,ri,a,b){var lg=(b-a)>Math.PI?1:0;function p(r,t){return (cx+r*Math.cos(t)).toFixed(2)+','+(cy+r*Math.sin(t)).toFixed(2);}return 'M'+p(ro,a)+' A'+ro+','+ro+' 0 '+lg+' 1 '+p(ro,b)+' L'+p(ri,b)+' A'+ri+','+ri+' 0 '+lg+' 0 '+p(ri,a)+' Z';}
function donut(slices,cVal,cLbl,size){
 size=size||160;var cx=size/2,cy=size/2,ro=size/2-4,ri=ro*0.64;
 slices=slices.filter(function(s){return s.v>0.5;});
 var total=slices.reduce(function(a,s){return a+s.v;},0)||1,a0=-Math.PI/2,gap=slices.length>1?0.025:0,out='';
 if(!slices.length)out='<circle cx="'+cx+'" cy="'+cy+'" r="'+((ro+ri)/2)+'" fill="none" stroke="'+pal().unused+'" stroke-width="'+(ro-ri)+'"/>';
 slices.forEach(function(s){var ang=s.v/total*Math.PI*2,a1=a0+ang,sA=a0+gap/2,eA=a1-gap/2;if(ang>=Math.PI*2-0.001)eA=sA+Math.PI*2-0.0005;if(eA<=sA)eA=sA+0.002;out+='<path d="'+arc(cx,cy,ro,ri,sA,eA)+'" fill="'+s.c+'"><title>'+esc(s.n)+' '+R(s.v)+'</title></path>';var pc=s.v/total*100;if(pc>=3.5&&!s.noPct){var md=(a0+a1)/2,lr=(ro+ri)/2,hx=s.c.replace('#','');var lum=(0.299*parseInt(hx.substr(0,2),16)+0.587*parseInt(hx.substr(2,2),16)+0.114*parseInt(hx.substr(4,2),16))/255;out+='<text x="'+(cx+Math.cos(md)*lr).toFixed(1)+'" y="'+(cy+Math.sin(md)*lr).toFixed(1)+'" text-anchor="middle" dominant-baseline="central" style="font-size:'+(size*(pc>=7?0.062:0.046))+'px;font-weight:800;fill:'+(lum>0.55?'#0A0A0A':'#FFFFFF')+'">'+Math.round(pc)+'%</text>';}a0=a1;});
 return '<svg viewBox="0 0 '+size+' '+size+'">'+out+'<text x="'+cx+'" y="'+(cy+2)+'" text-anchor="middle" class="serif" style="font-size:'+(size*0.15)+'px;fill:var(--text)">'+esc(cVal)+'</text><text x="'+cx+'" y="'+(cy+size*0.13)+'" text-anchor="middle" style="font-size:'+(size*0.055)+'px;letter-spacing:.15em;font-weight:800;fill:var(--muted)">'+esc(cLbl)+'</text></svg>';
}
/* donut with % labels outside the ring, joined by leader lines */
function donutCall(slices,cVal,cLbl){
 var W=200,H=200,cx=100,cy=100,ro=50,ri=32;
 slices=slices.filter(function(s){return s.v>0.5;});
 var total=slices.reduce(function(a,s){return a+s.v;},0)||1,a0=-Math.PI/2,gap=slices.length>1?0.03:0,paths='',calls=[];
 if(!slices.length)paths='<circle cx="'+cx+'" cy="'+cy+'" r="'+((ro+ri)/2)+'" fill="none" stroke="'+pal().unused+'" stroke-width="'+(ro-ri)+'"/>';
 slices.forEach(function(s){var ang=s.v/total*Math.PI*2,a1=a0+ang,sA=a0+gap/2,eA=a1-gap/2;if(ang>=Math.PI*2-0.001)eA=sA+Math.PI*2-0.0005;if(eA<=sA)eA=sA+0.002;
  paths+='<path d="'+arc(cx,cy,ro,ri,sA,eA)+'" fill="'+s.c+'"><title>'+esc(s.n)+' '+R(s.v)+'</title></path>';
  var pc=s.v/total*100,mid=(a0+a1)/2;if(!s.noPct&&pc>=0.5)calls.push({pc:pc,mid:mid,c:s.c,side:Math.cos(mid)>=0?1:-1,y:cy+Math.sin(mid)*(ro+13)});a0=a1;});
 [1,-1].forEach(function(side){var arr=calls.filter(function(c){return c.side===side;}).sort(function(a,b){return a.y-b.y;}),g=14,top=10,bot=H-8,i;
  for(i=0;i<arr.length;i++)arr[i].ly=i===0?Math.max(top,arr[i].y):Math.max(arr[i].y,arr[i-1].ly+g);
  for(i=arr.length-1;i>=0;i--)arr[i].ly=i===arr.length-1?Math.min(arr[i].ly,bot):Math.min(arr[i].ly,arr[i+1].ly-g);});
 var lines='',txt='';
 calls.forEach(function(c){var ex=cx+Math.cos(c.mid)*(ro+2),ey=cy+Math.sin(c.mid)*(ro+2),kx=cx+c.side*(ro+11),tx=cx+c.side*(ro+19);
  lines+='<polyline points="'+ex.toFixed(1)+','+ey.toFixed(1)+' '+kx+','+c.ly.toFixed(1)+' '+(tx-c.side*3)+','+c.ly.toFixed(1)+'" fill="none" stroke="var(--muted)" stroke-width=".8" opacity=".7"/><circle cx="'+ex.toFixed(1)+'" cy="'+ey.toFixed(1)+'" r="1.6" fill="'+c.c+'"/>';
  txt+='<text x="'+tx+'" y="'+c.ly.toFixed(1)+'" dominant-baseline="central" text-anchor="'+(c.side>0?'start':'end')+'" style="font-size:10.5px;font-weight:800;fill:var(--text)">'+(c.pc<1?'<1':Math.round(c.pc))+'%</text>';});
 return '<svg viewBox="0 0 '+W+' '+H+'">'+lines+paths+txt+'<text x="'+cx+'" y="'+(cy+2)+'" text-anchor="middle" class="serif" style="font-size:17px;fill:var(--text)">'+esc(cVal)+'</text><text x="'+cx+'" y="'+(cy+15)+'" text-anchor="middle" style="font-size:7px;letter-spacing:.15em;font-weight:800;fill:var(--muted)">'+esc(cLbl)+'</text></svg>';
}
function niceStep(x){if(x<=0)return 1;var p=Math.pow(10,Math.floor(Math.log10(x))),n=x/p;return (n<=1?1:n<=2?2:n<=5?5:10)*p;}
function bars(items,ghost){
 var W=360,H=220,pl=40,pr=8,pt=20,pb=28,ih=H-pt-pb;
 var max=Math.max.apply(null,[1].concat(items.map(function(i){return Math.max(i.v,i.plan||0);})));
 var step=niceStep(max/4),top=step*Math.ceil(max/step),out='';
 for(var k=0;k<=top/step;k++){var y=pt+ih-(k*step/top)*ih;out+='<line class="grid-l" x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y+'" y2="'+y+'"/><text class="ax" x="'+(pl-6)+'" y="'+(y+3)+'" text-anchor="end">'+kfmt(k*step)+'</text>';}
 var n=items.length,cw=(W-pl-pr)/Math.max(1,n),bw=Math.min(30,cw*0.52);
 items.forEach(function(it,i){var x=pl+cw*i+(cw-bw)/2,h=Math.max(ghost?0:2,(it.v/top)*ih),y=pt+ih-h,col=ghost?'var(--line)':(it.bad?'var(--red)':'var(--g)');
  out+='<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+h.toFixed(1)+'" rx="5" fill="'+col+'"/>';
  if(it.plan&&!ghost){var py=pt+ih-(it.plan/top)*ih;out+='<line x1="'+(x-4).toFixed(1)+'" x2="'+(x+bw+4).toFixed(1)+'" y1="'+py.toFixed(1)+'" y2="'+py.toFixed(1)+'" stroke="var(--text)" stroke-width="1.5" stroke-dasharray="3 2" opacity=".6"/>';}
  if(!ghost)out+='<text class="bv" x="'+(x+bw/2).toFixed(1)+'" y="'+(y-6).toFixed(1)+'" text-anchor="middle"'+(it.bad?' style="fill:var(--red)"':'')+'>'+kfmt(it.v)+'</text>';
  out+='<text class="ax" x="'+(x+bw/2).toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle">'+esc(it.label)+'</text>';});
 return '<svg viewBox="0 0 '+W+' '+H+'">'+out+'</svg>';
}
function ring(p){var r=40,c=2*Math.PI*r,col=p>=70?'var(--g)':p>=50?'var(--amber)':'var(--red)';return '<svg viewBox="0 0 96 96"><circle cx="48" cy="48" r="'+r+'" fill="none" stroke="var(--line)" stroke-width="9"/><circle cx="48" cy="48" r="'+r+'" fill="none" stroke="'+col+'" stroke-width="9" stroke-linecap="round" stroke-dasharray="'+(c*p/100).toFixed(1)+' '+c.toFixed(1)+'" transform="rotate(-90 48 48)"/><text x="48" y="54" text-anchor="middle" class="serif" style="font-size:30px;fill:var(--text)">'+p+'</text></svg>';}
/* green-to-budget, red-past-budget bar */
function perfBar(used,budget){
 var scale=Math.max(used,budget,1),g=Math.min(used,budget)/scale*100,r=Math.max(0,used-budget)/scale*100,mark=budget>0&&used>budget?budget/scale*100:null;
 return '<div class="bar">'+(g>0?'<i style="width:'+g.toFixed(1)+'%"></i>':'')+(r>0?'<i class="over" style="width:'+r.toFixed(1)+'%"></i>':'')+(mark!==null?'<span class="mark" style="left:calc('+mark.toFixed(1)+'% - 1px)"></span>':'')+'</div>';
}

/* ---------- icons ---------- */
var I={
 plan:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/><path d="M12 3.5V8.5M20.5 12h-5"/></svg>',
 spend:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>',
 goals:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M5 21V4m0 0h11l-2 4 2 4H5"/></svg>',
 history:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 20h16M7 16v-5M12 16V6M17 16v-8"/></svg>',
 more:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
 x:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>',
 edit:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
 sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
 moon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/></svg>',
 lock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>',
 scan:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3M8 12h8"/></svg>',
 chev:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>',
 check:'<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
 warn:'<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 8v5M12 16.5v.5"/><circle cx="12" cy="12" r="9"/></svg>'
};

/* ---------- render ---------- */
var root=document.getElementById('root');
function logoSrc(){return document.documentElement.dataset.theme==='dark'?'logo-dark.png':'logo-light.png';}
function brand(){var dark=document.documentElement.dataset.theme==='dark';return '<div class="brand"><div class="logo"><img src="'+logoSrc()+'" alt="">VAULT</div><div class="hbtns">'+(localStorage.getItem(PIN_KEY)?'<button class="hb" data-act="lockNow" aria-label="Lock">'+I.lock+'</button>':'')+'<button class="hb" data-act="theme" aria-label="Theme">'+(dark?I.sun:I.moon)+'</button></div></div>';}
function render(){
 applyTheme();
 if(firstRun){root.innerHTML=vWelcome();return;}
 var h=brand()+'<div class="view">';
 if(tab==='plan')h+=vPlan();else if(tab==='spend')h+=vSpend();else if(tab==='goals')h+=vGoals();else if(tab==='history')h+=vHistory();else h+=vMore();
 h+='<div class="foot">Your money coach, not a licensed financial adviser. Data stays on this phone. Back it up in More → Settings.</div></div>';
 h+='<nav>'+[['plan','Plan'],['spend','Spend'],['goals','Goals'],['history','History'],['more','More']].map(function(t){return '<button data-tab="'+t[0]+'" class="'+(tab===t[0]?'on':'')+'">'+I[t[0]]+t[1]+'</button>';}).join('')+'</nav>';
 if(tab==='plan'||tab==='spend')h+='<button class="fab" data-act="addMenu" aria-label="Add">+</button>';
 root.innerHTML=h;
 fmtInputs(root);
}
function vWelcome(){return '<div class="welcome"><img src="'+logoSrc()+'" alt=""><div class="eyebrow">Welcome to</div><div class="bigt serif">Vault</div><p class="sub" style="max-width:320px;margin:10px auto 26px">Your money, your plan. Everything stays on this phone.</p><button class="btn g block" data-act="import">Load my backup</button><button class="btn line block" style="margin-top:10px" data-act="fresh">Start fresh</button><p class="hint">Got the old Vault? Open it, go to More → Costs &amp; Buckets → Copy backup, then tap "Load my backup" and paste it.</p></div>';}

function planVsActual(c,rows,title){
 var p=pal(),planSl=[],actSl=[],used=0,leg='';
 rows.forEach(function(r){var col=bucketColor(r.id);planSl.push({n:r.name,v:Math.max(0,r.budget),c:col});actSl.push({n:r.name,v:r.used,c:r.used>r.budget+0.5&&!r.move?p.red:col});used+=r.used;});
 var planTotal=planSl.reduce(function(a,s){return a+s.v;},0);
 if(planTotal-used>0)actSl.push({n:'Not used yet',v:planTotal-used,c:p.unused,noPct:true});
 leg='<div class="legend"><div class="lr h"><span>Bucket</span><span>Plan</span><span>Now</span></div>'+rows.filter(function(r){return r.budget>0||r.used>0;}).map(function(r){var ov=!r.move&&r.used>r.budget+0.5;var pp=planTotal>0?Math.round(r.budget/planTotal*100):0,up=r.budget>0?Math.round(r.used/r.budget*100):(r.used>0?100:0);return '<div class="lr"><span class="bname"><span class="dot" style="background:'+bucketColor(r.id)+'"></span>'+esc(r.name)+'</span><span>'+R(r.budget)+'<small class="pc">'+pp+'% of plan</small></span><span class="'+(ov?'rt':r.used>0?'gt':'')+'">'+R(r.used)+'<small class="pc">'+up+(r.move?'% moved':'% used')+'</small></span></div>';}).join('')+'</div>';
 return '<div class="card"><div class="card-h"><h3>'+(title||'Plan vs now')+'</h3>'+(title?'<span class="mini">'+R(used)+' used</span>':'<button class="btn soft sm" data-act="stats">Stats &amp; forecast →</button>')+'</div><div class="duo"'+(title?'':' data-act="stats" style="cursor:pointer"')+'><div>'+donutCall(planSl,R(planTotal),'PLAN')+'<div class="lbl">WHAT IT SHOULD BE</div></div><div>'+donutCall(actSl,R(used),'USED')+'<div class="lbl">WHAT IT IS NOW</div></div></div>'+leg+'</div>';
}
function perfCard(rows,title){
 var h='<div class="card"><div class="card-h"><h3>'+(title||'Performance')+'</h3><span class="mini">green = within budget · red = over</span></div>';
 rows.filter(function(r){return r.budget>0||r.used>0;}).forEach(function(r){var over=r.used-r.budget,isOver=over>0.5&&!r.move;
  var status=r.move?(r.outside?'Paid from savings':(r.used+0.5>=r.budget?'<span class="gt">Moved ✓</span>':R(Math.max(0,r.budget-r.used))+' still to move')):(isOver?'<span class="rt">Over by '+R(over)+'</span>':R(r.budget-r.used)+' left');
  h+='<div class="perf"><div class="between"><div class="bname"><span class="dot" style="background:'+bucketColor(r.id)+'"></span>'+esc(r.name)+'</div><b>'+R(r.used)+' <span class="mini">/ '+R(r.budget)+'</span></b></div>'+perfBar(r.used,r.budget)+'<div class="between"><span class="mini">'+status+'</span>'+(isOver&&tab==='spend'?'<button class="btn soft sm" data-act="cover" data-id="'+esc(r.id)+'">Cover it</button>':'')+'</div></div>';});
 return h+'</div>';
}

function vPlan(){
 var c=compute(),cur=S.current,st=S.settings,ss=safeToSpend(c),sc=scoreNow(c),rows=trackRows(c,cur.tx),h='';
 // hero: safe to spend
 h+='<div class="hero"><div class="eyebrow">Safe to spend today</div><div class="big serif">'+R(ss.perDay)+'</div><div class="sub">'+R(Math.max(0,ss.left))+' fun + buffer left for '+ss.days+' day'+(ss.days>1?'s':'')+' · payday '+(ss.pp.daysToPay===0?'today':'in '+ss.pp.daysToPay+' days')+'</div><div class="chips">'+(ss.fast?'<span class="hchip bad">Spending fast: '+Math.round(ss.usedPct*100)+'% used, '+Math.round(ss.pp.elapsed*100)+'% of month gone</span>':'<span class="hchip">On pace ✓ '+Math.round(ss.usedPct*100)+'% used · '+Math.round(ss.pp.elapsed*100)+'% of month gone</span>')+'</div></div>';
 h+=cardsHTML();
 // score
 h+='<div class="card"><div class="score">'+ring(sc.score)+'<div><h3>How you\'re doing</h3><h2 class="serif">'+sc.grade+'</h2><div class="mini">Score out of 100: pace, budgets, savings moved, save rate, bank check</div></div></div><ul class="tips">'+sc.tips.map(function(t){return '<li data-act="tipToggle" data-id="'+t.id+'" data-k="'+t.k+'" style="cursor:pointer"><b class="ic '+t.k+'">'+(t.k==='ok'?'✓':t.k==='mid'?'!':'✕')+'</b><span>'+t.t+(t.mine?' <span class="mini">· changed by you</span>':'')+'</span></li>';}).join('')+'</ul><div class="hint">Tap a ✓ or ✕ to change it yourself, e.g. if you already moved your savings. Resets each month.</div></div>';
 if(fuelDue())h+='<div class="alert info"><b>Fuel price changed this month</b>SA fuel prices change on the first Wednesday. Check the new price per litre and update it so your fuel budget is right.<div style="margin-top:10px"><button class="btn g sm" data-act="fuelPrice">Update fuel price</button></div></div>';
 if(c.warn&&c.warn.type==='deficit')h+='<div class="alert"><b>Your costs are '+R(c.warn.amount)+' more than what\'s coming in.</b>Goals are paused this month. Fun stays at '+R(st.funFloor)+'. Cut a cost or add income.</div>';
 else if(c.warn&&c.warn.type==='short')h+='<div class="alert"><b>You\'re '+R(c.warn.amount)+' short of fully funding your goals.</b><ul>'+c.warn.sug.map(function(s){return '<li>'+s+'</li>';}).join('')+'</ul></div>';
 c.goals.forEach(function(x){if(x.past&&x.rem>0)h+='<div class="alert info"><b>'+esc(x.g.name)+': deadline passed</b>Still '+R(x.rem)+' to go. Update the date or mark it done in Goals.</div>';});
 // bank check
 var bi=bankInfo(),ad=Math.abs(bi.diff);
 h+='<div class="card"><div class="card-h"><h3>Bank check</h3>'+(ad<10?'<span class="chip g">Spot on ✓</span>':bi.diff<0?'<span class="chip r">'+R(ad)+' missing</span>':'<span class="chip a">'+R(ad)+' extra</span>')+'</div>';
 h+='<div class="between" style="align-items:flex-end"><div><div class="mini">Should be in your bank</div><div class="serif" style="font-size:38px;line-height:1.05;margin-top:4px">'+R(bi.expected)+'</div></div><div style="text-align:right"><div class="mini" style="margin-bottom:6px">Actually in your bank</div><div class="money"><span>R</span><input inputmode="decimal" style="width:90px" data-bank="actual" value="'+esc(S.bank.actual)+'"></div></div></div>';
 h+='<div class="note">'+R2(S.bank.anchor)+' on '+dL(S.bank.anchorDate)+(bi.inc?' + '+R(bi.inc)+' pay':'')+' − '+R2(bi.out)+' logged out'+(bi.internal?' · '+R(bi.internal)+' moved to savings pockets':'')+' · <a href="#" class="gt" data-act="bankList">'+(bankOpen?'hide':'see what\'s counted')+'</a></div>';
 if(bankOpen){h+='<div style="margin-top:8px">'+(bi.items.length?bi.items.slice().sort(function(a,b){return (b.date||'')>(a.date||'')?1:-1;}).map(function(t){return '<div class="tx"><div class="l"><span class="dot" style="background:'+bucketColor(t.bucket)+'"></span><div><div class="n">'+esc(t.note||targetName(t.bucket))+'</div><div class="mini">'+dL(t.date)+' · '+esc(targetName(t.bucket))+(t.src==='auto'?' · auto':'')+'</div></div></div><div class="row"><b>−'+R2(t.amount)+'</b><button class="icon-btn" data-act="editTx" data-id="'+t.id+'">'+I.edit+'</button></div></div>';}).join(''):'<div class="hint">Nothing logged since then.</div>')+'<div class="hint">Something here that didn\'t actually leave your bank (yet), or happened before '+dL(S.bank.anchorDate)+'? Tap ✏️ to fix the date, change it to Credit/Cash, or delete it.</div></div>';}
 if(ad>=10)h+='<div class="note">'+(bi.diff<0?'Your bank has <b class="rt">'+R(ad)+' less</b> than expected. Something isn\'t logged: a debit order, a swipe or bank fees.':'Your bank has <b class="gt">'+R(ad)+' more</b> than expected. Maybe something was logged twice, or money came in that isn\'t on the plan.')+'</div>';
 h+='<div class="row" style="gap:8px;margin-top:12px"><button class="btn line" style="flex:1" data-act="debits">+ Log debit orders</button><button class="btn line" style="flex:1" data-act="reanchor">Start fresh today</button></div></div>';
 // plan vs actual
 h+=planVsActual(c,rows);
 // money in
 h+='<div class="card"><div class="card-h"><h3>Money in · '+ymL(cur.month,true)+'</h3><span class="gt" style="font-weight:800">'+R(c.income)+'</span></div>';
 h+='<div class="field"><label>Salary<small>Nett, off your payslip</small></label><div class="money"><span>R</span><input inputmode="decimal" data-cur="salary" value="'+esc(cur.salary)+'"></div></div>';
 h+='<div class="field"><label>Dad<small>Monthly</small></label><div class="money"><span>R</span><input inputmode="decimal" data-cur="dad" value="'+esc(cur.dad)+'"></div></div>';
 if(c.rollTotal)h+='<div class="field"><label>Rolled over<small>Leftover from last month</small></label><b class="gt">'+R(c.rollTotal)+'</b></div>';
 var opts=[['split','Split it normally'],['emergency',B('emergency').name],['invest',B('invest').name+' (TFSA)']].concat(S.goals.map(function(g){return [g.id,'Goal: '+g.name];}));
 cur.extras.forEach(function(e){h+='<div style="padding:12px 0;border-bottom:1px solid var(--line)"><div class="row"><input class="txt" placeholder="What was it? (overtime, sale…)" data-extra="'+e.id+'" data-f="label" value="'+esc(e.label)+'"><div class="money"><span>R</span><input inputmode="decimal" style="width:80px" data-extra="'+e.id+'" data-f="amount" value="'+esc(e.amount)+'"></div></div><div class="row" style="margin-top:8px"><select class="txt" data-extra="'+e.id+'" data-f="to">'+opts.map(function(o){return '<option value="'+o[0]+'"'+((e.to||'split')===o[0]?' selected':'')+'>'+esc(o[1])+'</option>';}).join('')+'</select><button class="icon-btn" data-act="delExtra" data-id="'+e.id+'">'+I.x+'</button></div></div>';});
 h+='<button class="btn ghost" data-act="addExtra">+ Add extra money</button></div>';
 // fixed expenses with dates
 var ch=chargeItems(),fixedTot=c.fixed+c.biz;
 ch.forEach(function(x){if(x.day&&x.freq==='monthly')x.n=nextCharge(x.day);});
 ch.sort(function(a,b){if(a.n&&b.n)return a.n.next-b.n.next;if(a.n)return -1;if(b.n)return 1;return b.amt-a.amt;});
 var still=ch.reduce(function(a,x){return a+(x.n&&!x.n.passed?x.amt:0);},0);
 h+='<div class="card"><div class="card-h"><h3>Fixed expenses</h3><span class="mini">'+R(fixedTot)+'/mo · '+R(still)+' still to come off</span></div>';
 ch.forEach(function(x){
  var dt=x.n?x.n.next:null,sub='';
  if(x.freq==='fuel')sub=num(x.cost.litres)+' L × '+R2(S.settings.fuelPrice)+'/L';
  else if(x.freq==='days')sub=R(x.amt)+' every '+x.days+' days';
  else if(x.freq==='yearly')sub=R(x.amt)+' once a year';
  else if(x.n)sub=(x.n.days===0?'<span class="gt">Today</span>':x.n.days===1?'<span class="gt">Tomorrow</span>':WD[dt.getDay()]+' · in '+x.n.days+' days')+(x.n.passed?' · <span class="gt">off this month ✓</span>':'');
  else sub='Every month · <a href="#" class="gt" data-act="'+(x.biz?'editBiz':'editCost')+'" data-id="'+x.id+'">add the date</a>';
  if(x.card)sub+=' · '+PAYNAME[x.card];
  var up=x.prev&&x.amt>x.prev+0.5?' <span class="chip r" style="padding:2px 7px;font-size:10px">↑ '+R(x.amt-x.prev)+'</span>':'';
  var mo=x.biz?x.amt:costM(x.cost);
  h+='<div class="tx"><div class="l">'+(dt?'<div class="datebox'+(x.n.days<=3?' soon':'')+'"><div class="m">'+MON[dt.getMonth()].toUpperCase()+'</div><div class="d">'+dt.getDate()+'</div></div>':'<div class="datebox"><div class="m">'+(x.freq==='fuel'?'FUEL':x.freq==='days'?'EVERY':x.freq==='yearly'?'YEAR':'DAY')+'</div><div class="d" style="font-size:'+(x.freq==='days'?'13':'15')+'px">'+(x.freq==='fuel'?'⛽':x.freq==='days'?x.days+'d':x.freq==='yearly'?'1×':'?')+'</div></div>')+'<div><div class="n">'+esc(x.name)+up+'</div><div class="mini">'+sub+'</div></div></div><div class="row"><b>'+R(mo)+'</b><button class="icon-btn" data-act="'+(x.biz?'editBiz':'editCost')+'" data-id="'+x.id+'" aria-label="Edit">'+I.edit+'</button>'+(x.biz?'':'<button class="icon-btn" data-act="delCost" data-id="'+x.id+'" aria-label="Remove">'+I.x+'</button>')+'</div></div>';});
 if(!ch.length)h+='<div class="hint" style="margin:0">No fixed expenses yet.</div>';
 h+='<button class="btn ghost" data-act="addCost">+ Add a fixed expense</button></div>';
 // split table
 h+='<div class="card"><div class="card-h"><h3>The split</h3><span class="chip '+(c.saveRate>=0.3?'g':c.saveRate>=0.2?'a':'r')+'">Saving '+Math.round(c.saveRate*100)+'%</span></div><table>';
 S.buckets.forEach(function(b){var v=c.alloc[b.id]||0,pct=c.income>0?v/c.income*100:0;
  h+='<tr><td><div class="bname"><span class="dot" style="background:'+bucketColor(b.id)+'"></span>'+esc(b.name)+'</div><div class="why">'+esc(b.why||'')+'</div></td><td class="amt">'+R(v)+'<small>'+Math.round(pct)+'%</small></td></tr>';
  if(b.id==='goals')c.goals.forEach(function(x){h+='<tr class="subr"><td><div class="bname">↳ '+esc(x.g.name)+'</div></td><td class="amt">'+(x.g.inSplit?R(x.alloc):'from sales')+'</td></tr>';});
  if(b.id==='emergency')h+='<tr class="subr"><td><div class="bname">↳ '+R(c.efNow)+' of '+R(c.efTarget)+(c.efNow>=c.efTarget?' · full ✓':'')+'</div></td><td></td></tr>';});
 h+='</table></div>';
 h+='<button class="btn g block" data-act="lock">Lock in '+ymL(cur.month,true)+' & start '+ymL(addM(cur.month,1))+'</button><div class="hint" style="text-align:center;margin-bottom:16px">Do this on payday. Saves the month to History.</div>';
 // performance at bottom
 h+=perfCard(rows,'Performance this month');
 return h;
}

function vSpend(){
 var c=compute(),rows=trackRows(c,S.current.tx),ss=safeToSpend(c),h='';
 var spendRows=rows.filter(function(r){return !r.move;}),bud=spendRows.reduce(function(a,r){return a+r.budget;},0),used=spendRows.reduce(function(a,r){return a+r.used;},0),left=bud-used;
 h+='<div class="top"><div><div class="eyebrow">'+ymL(S.current.month,true)+' · spending</div><div class="bigt serif'+(left<0?' rt':'')+'">'+R(left)+'</div><div class="sub">'+(left<0?'over your spending budget':'left to spend')+' · '+R(used)+' of '+R(bud)+' used</div></div><span class="chip '+(ss.fun.budget-ss.fun.used<0?'r':'g')+'">Fun left '+R(ss.fun.budget-ss.fun.used)+'</span></div>';
 h+=cardsHTML();
 h+='<div class="acts2"><button class="btn g" data-act="scan">'+I.scan+'Scan total</button><button class="btn line" style="height:56px" data-act="addTx">+ Add manually</button></div>';
 h+=perfCard(spendRows,'Spending buckets');
 h+=perfCard(rows.filter(function(r){return r.move;}),'Money to move');
 var txs=S.current.tx.slice().sort(function(a,b){return (b.date||'')<(a.date||'')?-1:(b.date||'')>(a.date||'')?1:(b.at||0)-(a.at||0);});
 h+='<div class="card"><div class="card-h"><h3>This month</h3><span class="mini">'+txs.length+' item'+(txs.length===1?'':'s')+'</span></div>';
 if(!txs.length)h+='<div class="hint" style="margin:0">Nothing logged yet. Tap + after you buy something.</div>';
 txs.forEach(function(t){h+='<div class="tx"><div class="l"><span class="dot" style="background:'+bucketColor(t.bucket)+'"></span><div><div class="n">'+esc(t.note||targetName(t.bucket))+'</div><div class="mini">'+esc(targetName(t.bucket))+' · '+(t.date?dL(t.date):'')+(t.card==='credit'?' · credit':t.card==='cash'?' · cash':'')+(t.src==='scan'?' · scanned':'')+(t.src==='auto'?' · auto':'')+'</div></div></div><div class="row"><b>'+R2(t.amount)+'</b><button class="icon-btn" data-act="editTx" data-id="'+t.id+'">'+I.edit+'</button></div></div>';});
 h+='</div>';
 if((S.current.adj||[]).length)h+='<div class="card"><div class="card-h"><h3>Money moved between buckets</h3></div>'+S.current.adj.map(function(a,i){return '<div class="tx"><div class="l"><div><div class="n">'+R(a.amount)+' · '+esc(targetName(a.from))+' → '+esc(targetName(a.to))+'</div></div></div><button class="icon-btn" data-act="delAdj" data-i="'+i+'">'+I.x+'</button></div>';}).join('')+'</div>';
 return h;
}

function goalCard(x,isEF,c){
 var g=x.g,pct=Math.min(100,num(g.target)>0?x.saved/num(g.target)*100:0),h='<div class="card">';
 h+='<div class="between" style="align-items:flex-start"><div><b style="font-size:17px">'+esc(g.name)+'</b><div class="row" style="flex-wrap:wrap;gap:6px;margin-top:6px">';
 if(isEF)h+='<span class="chip">'+S.settings.efMonths+' months of costs</span>'+(pct>=100?'<span class="chip g">Full ✓</span>':'<span class="chip g">'+R(c.alloc.emergency)+' this month</span>');
 else{h+='<span class="chip">by '+dL(g.deadline)+'</span>';if(pct>=100)h+='<span class="chip g">Done ✓</span>';else if(!g.inSplit)h+='<span class="chip a">From sales / other</span>';else if(x.past)h+='<span class="chip r">Deadline passed</span>';else h+='<span class="chip '+(x.alloc+0.5>=x.need?'g':'r')+'">'+R(x.need)+'/mo needed</span>';}
 h+='</div></div><button class="icon-btn" data-act="'+(isEF?'editEF':'editGoal')+'" data-id="'+(g.id||'')+'">'+I.edit+'</button></div>';
 h+='<div class="goal-amt serif">'+R(x.saved)+' <small>of '+R(g.target)+'</small></div><div class="bar"><i style="width:'+pct.toFixed(1)+'%"></i></div>';
 h+='<div class="between"><span class="mini">'+Math.round(pct)+'% there</span><span class="mini">'+(pct>=100?'Nice.':R(Math.max(0,num(g.target)-x.saved))+' to go'+(isEF?'':' · '+x.ml+' month'+(x.ml>1?'s':'')+' left'))+'</span></div>';
 if(g.note)h+='<div class="note">'+esc(g.note)+'</div>';
 return h+'</div>';
}
function vGoals(){
 var c=compute(),h='<div class="top"><div><div class="eyebrow">Goals</div><div class="bigt serif">'+R(c.goals.reduce(function(a,x){return a+x.saved;},0)+c.efNow)+'</div><div class="sub">saved across everything</div></div></div>';
 h+=goalCard({g:{name:B('emergency').name,target:Math.round(c.efTarget),note:'Target = '+S.settings.efMonths+' × monthly costs ('+R(c.needs)+'). Keep it in a separate savings pocket, not the TFSA.'},saved:c.efNow},true,c);
 c.goals.forEach(function(x){h+=goalCard(x,false,c);});
 var p=pfInfo();
 if(num(S.pf.monthly)>0||p.fromStatement){h+='<div class="card"><div class="between"><b style="font-size:17px">Provident fund</b><button class="icon-btn" data-act="editPF">'+I.edit+'</button></div><div class="row" style="gap:6px;margin-top:6px"><span class="chip">'+(p.fromStatement?'From statement':'Estimate')+'</span><span class="chip a">Not counted as cash</span></div><div class="goal-amt serif">'+R(p.now)+' <small>in the fund</small></div><div class="split4" style="grid-template-columns:1fr 1fr"><div><div class="v serif gt">'+R(p.potNow)+'</div><div class="k">Savings pot now</div></div><div><div class="v serif">'+R(p.potMove)+'</div><div class="k">Pot by '+ymL(p.moveYM)+'</div></div></div><div class="note">Two-pot rules: when you resign you can only take the savings pot (⅓), taxed. The other ⅔ stays locked until retirement.</div></div>';}
 h+='<button class="btn ghost" data-act="addGoal">+ Add a goal</button>';
 return h;
}

function thisMonthCard(){
 var txs=(S.current.tx||[]).slice().sort(function(a,b){return (b.date||'')<(a.date||'')?-1:(b.date||'')>(a.date||'')?1:(b.at||0)-(a.at||0);});
 var tot={},spentAll=0;txs.forEach(function(t){tot[t.bucket]=(tot[t.bucket]||0)+num(t.amount);if(!isMove(t.bucket))spentAll+=num(t.amount);});
 var keys=Object.keys(tot).sort(function(a,b){return tot[b]-tot[a];});
 if(histFilter!=='all'&&histFilter!=='spend'&&!tot[histFilter])histFilter='all';
 var shown=txs.filter(function(t){return histFilter==='all'||(histFilter==='spend'?!isMove(t.bucket):t.bucket===histFilter);});
 var shownTot=shown.reduce(function(a,t){return a+num(t.amount);},0);
 var h='<div class="card"><div class="card-h"><h3>'+ymL(S.current.month,true)+' · so far</h3><span class="mini">'+txs.length+' item'+(txs.length===1?'':'s')+'</span></div>';
 h+='<div class="between" style="align-items:flex-end;margin-bottom:12px"><div><div class="mini">Spent this month</div><div class="serif" style="font-size:36px;line-height:1.05">'+R2(spentAll)+'</div></div><div style="text-align:right"><div class="mini">Showing</div><b>'+R2(shownTot)+'</b></div></div>';
 if(!txs.length)return h+'<div class="hint" style="margin:0">Nothing logged this month yet. Tap + on the Plan or Spend tab after you buy something.</div></div>';
 h+='<div class="chips" style="margin-bottom:6px"><button class="copt'+(histFilter==='all'?' on':'')+'" data-act="hf" data-v="all">All · '+R(sumObj(tot))+'</button><button class="copt'+(histFilter==='spend'?' on':'')+'" data-act="hf" data-v="spend">Spending only · '+R(spentAll)+'</button>'+keys.map(function(k){return '<button class="copt'+(histFilter===k?' on':'')+'" data-act="hf" data-v="'+esc(k)+'"><span class="dot" style="background:'+bucketColor(k)+'"></span>'+esc(targetName(k))+' · '+R(tot[k])+'</button>';}).join('')+'</div>';
 var lastDate='';
 shown.forEach(function(t){
  if(t.date!==lastDate){lastDate=t.date;h+='<div class="mini" style="margin:14px 0 2px;font-weight:800;letter-spacing:.08em;text-transform:uppercase">'+(t.date===todayISO()?'Today':dL(t.date))+'</div>';}
  h+='<div class="tx"><div class="l"><span class="dot" style="background:'+bucketColor(t.bucket)+'"></span><div><div class="n">'+esc(t.note||'(no description)')+'</div><div class="mini"><b style="color:var(--text);font-weight:700">'+esc(targetName(t.bucket))+'</b> · '+(t.card==='credit'?'Credit card':t.card==='cash'?'Cash':t.card==='other'?'Other':'Debit card')+(t.src==='auto'?' · auto':t.src==='scan'?' · scanned':'')+'</div></div></div><div class="row"><b>'+R2(t.amount)+'</b><button class="icon-btn" data-act="editTx" data-id="'+t.id+'" aria-label="Edit">'+I.edit+'</button></div></div>';});
 return h+'</div>';
}
function monthSaved(x){return ((x.actual==null||x.actual==='')?x.plannedSave:num(x.actual))+sumObj(x.directed);}
function vHistory(){
 var hs=S.history.slice().sort(function(a,b){return a.month<b.month?-1:1;}),h='',tot=0,plan=0;
 hs.forEach(function(x){tot+=monthSaved(x);plan+=x.plannedSave+sumObj(x.directed);});
 var avg=hs.length?Math.round(hs.reduce(function(a,x){return a+(x.score||finalScore(x));},0)/hs.length):0;
 h+='<div class="top"><div><div class="eyebrow">History</div><div class="bigt serif">'+R(tot)+'</div><div class="sub">saved + invested since you started</div></div>'+(hs.length?'<span class="chip '+(avg>=70?'g':avg>=50?'a':'r')+'">Avg score '+avg+'</span>':'')+'</div>';
 h+=thisMonthCard();
 if(!hs.length){h+='<div class="card"><div class="chart">'+bars([2,3,2.5,4,3.5,5].map(function(v,i){return {label:MON[i],v:v*1000};}),true)+'</div><div class="hint" style="text-align:center">Lock in your first month on the Plan tab (on payday) and your history starts here.</div></div>';return h;}
 var last=hs.slice(-8);
 h+='<div class="card"><div class="card-h"><h3>Saved per month</h3><span class="mini">dashed = plan</span></div><div class="chart">'+bars(last.map(function(x){return {label:MON[ymP(x.month).m-1],v:monthSaved(x),plan:x.plannedSave+sumObj(x.directed)};}),false)+'</div></div>';
 h+='<div class="card"><div class="card-h"><h3>Spent per month</h3><span class="mini">dashed = spending budget · red = over</span></div><div class="chart">'+bars(last.map(function(x){var sp=(x.tx||[]).filter(function(t){return !isMove(t.bucket);}).reduce(function(a,t){return a+num(t.amount);},0);var b=Object.keys(x.bud||{}).filter(function(k){return !isMove(k);}).reduce(function(a,k){return a+x.bud[k];},0);return {label:MON[ymP(x.month).m-1],v:sp,plan:b,bad:b>0&&sp>b};}),false)+'</div></div>';
 hs.slice().reverse().forEach(function(x){
  var sc=x.score||finalScore(x),open=openMonth===x.month,spent=(x.tx||[]).filter(function(t){return !isMove(t.bucket);}).reduce(function(a,t){return a+num(t.amount);},0);
  h+='<div class="card mcard'+(open?' open':'')+'" data-month="'+x.month+'"><div class="between"><div><b style="font-size:17px">'+ymL(x.month,true)+'</b><div class="mini">In '+R(x.income)+' · saved '+R(monthSaved(x))+' · spent '+R(spent)+'</div></div><div class="row"><span class="chip '+(sc>=70?'g':sc>=50?'a':'r')+'">'+sc+' · '+gradeOf(sc)+'</span><span class="chev">'+I.chev+'</span></div></div>';
  if(open){
   var fake={goals:S.goals.map(function(g){return {g:g};})},rows=[];var sp=spentMap(x.tx||[]);
   Object.keys(x.bud||{}).forEach(function(k){rows.push({id:k,name:targetName(k),budget:x.bud[k]||0,used:sp[k]||0,move:isMove(k)});});
   if(!x.bud){Object.keys(x.alloc||{}).forEach(function(k){if(k!=='goals')rows.push({id:k,name:targetName(k),budget:x.alloc[k]||0,used:sp[k]||0,move:isMove(k)});});}
   h+='<div style="margin-top:14px" data-stop="1">'+planVsActual(fake,rows,'Plan vs what happened').replace('class="card"','class="card" style="box-shadow:none;margin:0 0 12px;padding:0;border:0"')+perfCard(rows,'Buckets').replace('class="card"','class="card" style="box-shadow:none;margin:0 0 12px;padding:0;border:0"');
   h+='<div class="field"><label>Actually moved to savings<small>Blank = moved the plan ('+R(x.plannedSave)+')</small></label><div class="money"><span>R</span><input inputmode="decimal" style="width:80px" data-hist="'+x.month+'" placeholder="'+Math.round(x.plannedSave)+'" value="'+(x.actual==null?'':esc(x.actual))+'"></div></div>';
   if(x.nw)h+='<div class="field"><label>Net worth that month</label><b>'+R(x.nw)+'</b></div>';
   if((x.tx||[]).length)h+='<div style="margin-top:8px">'+(x.tx||[]).slice().sort(function(a,b){return (b.date||'')>(a.date||'')?1:-1;}).map(function(t){return '<div class="tx"><div class="l"><span class="dot" style="background:'+bucketColor(t.bucket)+'"></span><div><div class="n">'+esc(t.note||targetName(t.bucket))+'</div><div class="mini">'+esc(targetName(t.bucket))+' · '+dL(t.date)+'</div></div></div><b>'+R2(t.amount)+'</b></div>';}).join('')+'</div>';
   h+='<button class="btn line block" style="margin-top:12px" data-act="delHist" data-m="'+x.month+'">Delete this month</button></div>';}
  h+='</div>';});
 return h;
}

function vMore(){
 var h='<div class="seg">'+[['nw','NET WORTH'],['costs','BUCKETS'],['coach','COACH'],['settings','SETTINGS']].map(function(s){return '<button data-sub="'+s[0]+'" class="'+(moreSub===s[0]?'on':'')+'">'+s[1]+'</button>';}).join('')+'</div>';
 if(moreSub==='nw')return h+vNW();if(moreSub==='costs')return h+vCosts();if(moreSub==='coach')return h+vCoach();return h+vSettings();
}
function vNW(){
 var nw=netWorth(),h='<div class="top"><div><div class="eyebrow">Net worth</div><div class="bigt serif'+(nw.total<0?' rt':'')+'">'+R(nw.total)+'</div><div class="sub">everything you own minus what you owe</div></div></div>';
 var max=Math.max.apply(null,nw.items.map(function(i){return Math.abs(i.v);}).concat([1]));
 h+='<div class="card">'+nw.items.map(function(i){return '<div class="perf"'+(i.off?' style="opacity:.45"':'')+'><div class="between"><span style="font-weight:700">'+esc(i.k)+(i.off?' <span class="mini">· not counted</span>':'')+'</span><b class="'+(i.v<0?'rt':'')+'">'+R(i.v)+'</b></div><div class="bar"><i class="'+(i.v<0?'over':'')+'" style="width:'+(Math.abs(i.v)/max*100).toFixed(1)+'%'+(i.off?';background:var(--dim)':'')+'"></i></div></div>';}).join('')+'<div class="tog" style="margin-top:12px"><span>Count provident fund in net worth<br><span class="mini">Leave off until you know the real balance</span></span><div class="sw'+(S.nw.includePF?' on':'')+'" data-act="togglePF"></div></div></div>';
 h+='<div class="card"><div class="card-h"><h3>Update values</h3></div><div class="field"><label>Bank total<small>Same as Bank check</small></label><div class="money"><span>R</span><input inputmode="decimal" data-bank="actual" value="'+esc(S.bank.actual)+'"></div></div><div class="field"><label>TFSA / investments<small>Value in your EasyEquities app</small></label><div class="money"><span>R</span><input inputmode="decimal" data-nw="tfsa" value="'+esc(S.nw.tfsa)+'"></div></div><div class="field"><label><input class="txt" style="height:34px;width:150px" data-nw="otherLabel" value="'+esc(S.nw.otherLabel)+'"><small>e.g. car value</small></label><div class="money"><span>R</span><input inputmode="decimal" data-nw="other" value="'+esc(S.nw.other)+'"></div></div><div class="field"><label>Credit card owed<small>Tracked from your credit purchases. Fix it here if it\'s off</small></label><div class="money"><span>R</span><input inputmode="decimal" data-ccset="1" value="'+esc(ccInfo().owed)+'"></div></div><div class="field"><label>Credit card limit</label><div class="money"><span>R</span><input inputmode="decimal" data-cclimit="1" value="'+esc(S.cc.limit)+'"></div></div><div class="hint">Provident fund comes from the Goals tab. Each time you lock a month, your net worth gets saved to History.</div></div>';
 var pts=S.history.filter(function(x){return x.nw!=null;}).slice(-8);
 if(pts.length>1)h+='<div class="card"><div class="card-h"><h3>Net worth over time</h3></div><div class="chart">'+bars(pts.map(function(x){return {label:MON[ymP(x.month).m-1],v:Math.max(0,x.nw)};}),false)+'</div></div>';
 return h;
}
function vCosts(){
 var c=compute(),st=S.settings,h='<div class="card"><div class="card-h"><h3>Buckets</h3></div>';
 S.buckets.forEach(function(b){h+='<div style="padding:12px 0;border-bottom:1px solid var(--line)"><div class="row"><span class="dot" style="background:'+bucketColor(b.id)+'"></span><input class="txt" data-bucket="'+b.id+'" data-f="name" value="'+esc(b.name)+'">'+((b.id==='business'||b.custom)?'<div class="money"><span>R</span><input inputmode="decimal" style="width:70px" data-bucket="'+b.id+'" data-f="amount" value="'+esc(b.amount)+'"></div>':'')+(b.custom?'<button class="icon-btn" data-act="delBucket" data-id="'+b.id+'">'+I.x+'</button>':'')+'</div><textarea class="txt" style="margin-top:8px;min-height:50px;font-size:13px" data-bucket="'+b.id+'" data-f="why">'+esc(b.why)+'</textarea></div>';});
 h+='<button class="btn ghost" data-act="addBucket">+ Add a bucket (fixed amount)</button></div>';
 h+='<div class="card"><div class="card-h"><h3>Split rules</h3></div>';
 [['funTarget','Fun: aim for','Max fun when there\'s room',1],['funFloor','Fun: never below','Even in a tight month',1],['efMonths','Emergency fund months','Months of costs to hold',0],['payday','Payday','Day of the month you get paid',0],['tfsaUsed','TFSA: put in so far','This tax year (from 1 Mar)',1],['dadGift','Expected TFSA lump sum','e.g. a birthday gift going in',1]].forEach(function(f){h+='<div class="field"><label>'+f[1]+'<small>'+f[2]+'</small></label><div class="money">'+(f[3]?'<span>R</span>':'')+'<input inputmode="decimal" style="width:'+(f[3]?90:44)+'px" data-set="'+f[0]+'" value="'+esc(st[f[0]])+'"></div></div>';});
 h+='<div class="field"><label>Emergency fund saved before the app<small>Starting balance</small></label><div class="money"><span>R</span><input inputmode="decimal" style="width:90px" data-ef="saved" value="'+esc(S.ef.saved)+'"></div></div></div>';
 return h;
}
function vCoach(){
 var c=compute(),t=tfsaInfo(c),inc=c.income||1,h='',needsP=Math.round(c.fixed/inc*100),bizP=Math.round(c.biz/inc*100),saveP=Math.round(c.saveRate*100),funP=Math.round(c.alloc.fun/inc*100);
 h+='<div class="card coach"><h3>Your rule</h3><h2 class="serif">Living-at-home split</h2><div class="split4"><div><div class="v serif">'+needsP+'%</div><div class="k">Needs</div><div class="t">≤ 45%</div></div><div><div class="v serif">'+bizP+'%</div><div class="k">Business</div><div class="t">your call</div></div><div><div class="v serif gt">'+saveP+'%</div><div class="k">Save</div><div class="t">30%+</div></div><div><div class="v serif">'+funP+'%</div><div class="k">Fun</div><div class="t">5–10%</div></div></div><p>50/30/20 is built for people paying rent. You pay none, so flip it: <b>save 30%+</b>. Order every month: costs → business → deadline goals → emergency fund → TFSA → fun. Fun never hits zero.</p></div>';
 var over=t.projected-t.limit,pct=Math.min(100,t.used/Math.max(1,t.limit)*100);
 h+='<div class="card coach"><h3>Tax-free savings (TFSA)</h3><h2 class="serif">R46,000 a year, tax-free</h2><ul><li><b>R46,000 per tax year</b> (1 Mar – end Feb) since 1 March 2026, <b>R500,000 lifetime</b>.</li><li>Go over = <b>40% penalty</b> on the extra.</li><li>Withdraw and that room is gone. Long-term money only.</li></ul><div class="between" style="margin-top:12px"><span class="mini">This tax year (ends Feb '+t.te+')</span><span class="mini">'+R(t.used)+' / '+R(t.limit)+'</span></div><div class="bar"><i style="width:'+pct.toFixed(1)+'%"></i></div><p class="mini">Projected by end Feb: <b class="gt">'+R(t.projected)+'</b></p>'+(over>0?'<div class="alert" style="margin:8px 0 0"><b>'+R(over)+' over the limit</b>Put that part in on or after 1 March (new tax year).</div>':'')+'</div>';
 h+='<div class="card coach"><h3>Business money</h3><h2 class="serif">Keep it separate</h2><ul><li>Your monthly debit order is your <b>owner\'s contribution</b>. Keep the business in its own account.</li><li>All business costs come out of that account, never your personal card.</li><li>Log every contribution and receipt. As a sole proprietor, profit is personal income for SARS.</li></ul></div>';
 h+='<div class="card coach"><h3>Credit score</h3><h2 class="serif">Use less of the limit</h2><p>Paying off straight away is good. What hurts is the statement showing the card maxed out. Keep the reported balance under ~30% of your limit: pay before the statement date, or get a higher limit and spend the same.</p></div>';
 h+='<div class="card coach"><h3>Fuel</h3><h2 class="serif">Changes once a month</h2><p>SA fuel prices change on the first Wednesday of each month. Your fuel budget is litres × price, so when the app reminds you, type the new price and your plan updates. Coastal prices are a bit lower than inland.</p></div>';
 return h;
}
function vSettings(){
 var st=S.settings,pin=!!localStorage.getItem(PIN_KEY),h='';
 h+='<div class="card"><div class="card-h"><h3>Theme</h3></div><div class="chips">'+[['light','Green & white'],['dark','Green & black'],['auto','Match phone']].map(function(o){return '<button class="copt'+(st.theme===o[0]?' on':'')+'" data-act="setTheme" data-v="'+o[0]+'">'+o[1]+'</button>';}).join('')+'</div></div>';
 h+='<div class="card"><div class="card-h"><h3>PIN lock</h3>'+(pin?'<span class="chip g">On</span>':'<span class="chip">Off</span>')+'</div><p class="mini" style="margin:0 0 12px">Locks the app when you open it or come back after a minute. It\'s a privacy screen, so if you forget the PIN you\'ll need your backup.</p>'+(pin?'<div class="row"><button class="btn line" style="flex:1" data-act="setPin">Change PIN</button><button class="btn line danger" style="flex:1" data-act="removePin">Remove PIN</button></div>':'<button class="btn g block" data-act="setPin">Set a 4-digit PIN</button>')+'</div>';
 h+='<div class="card"><div class="card-h"><h3>Fuel</h3><span class="mini">updated '+(st.fuelMonth?ymL(st.fuelMonth):'never')+'</span></div><div class="field"><label>Price per litre<small>95 unleaded, check the pump or news</small></label><div class="money"><span>R</span><input inputmode="decimal" style="width:70px" data-set="fuelPrice" value="'+esc(st.fuelPrice)+'"></div></div></div>';
 var days=S.lastBackup?Math.floor((Date.now()-S.lastBackup)/864e5):null;
 h+='<div class="card"><div class="card-h"><h3>Backup</h3>'+(days===null?'<span class="chip r">Never backed up</span>':days>14?'<span class="chip a">'+days+' days ago</span>':'<span class="chip g">'+(days?days+' days ago':'Today')+'</span>')+'</div><p class="mini" style="margin:0 0 12px">Your data only lives on this phone. Download a backup every couple of weeks and keep it in Files or iCloud.</p><div class="row" style="gap:8px"><button class="btn g" style="flex:1" data-act="exportFile">Download backup</button><button class="btn line" style="flex:1" data-act="exportCopy">Copy backup</button></div><button class="btn line block" style="margin-top:8px" data-act="import">Load a backup</button></div>';
 h+='<button class="btn line block danger" data-act="reset">Reset app</button>';
 return h;
}

/* ---------- stats + forecast ---------- */
function stackBars(labels,series,opts){
 opts=opts||{};var W=360,H=230,pl=44,pr=8,pt=22,pb=28,ih=H-pt-pb,n=labels.length;
 var tots=labels.map(function(_,i){return series.reduce(function(a,s){return a+Math.max(0,s.values[i]);},0);});
 var max=Math.max.apply(null,tots.concat([1])),step=niceStep(max/4),top=step*Math.ceil(max/step),out='';
 for(var k=0;k<=top/step;k++){var y=pt+ih-(k*step/top)*ih;out+='<line class="grid-l" x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y+'" y2="'+y+'"/><text class="ax" x="'+(pl-6)+'" y="'+(y+3)+'" text-anchor="end">'+kfmt(k*step)+'</text>';}
 var cw=(W-pl-pr)/n,bw=Math.min(30,cw*0.62),every=n<=8?1:Math.ceil(n/6);
 labels.forEach(function(l,i){var x=pl+cw*i+(cw-bw)/2,y0=pt+ih,show=(n-1-i)%every===0;series.forEach(function(s){var v=Math.max(0,s.values[i]),h=v/top*ih;if(h>0.3){out+='<rect x="'+x.toFixed(1)+'" y="'+(y0-h).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+h.toFixed(1)+'" fill="'+s.c+'"/>';y0-=h;}});
  if(show){var lx=Math.min(W-pr-14,Math.max(pl+14,x+bw/2));out+='<text class="bv" x="'+lx.toFixed(1)+'" y="'+(y0-6).toFixed(1)+'" text-anchor="middle">'+(tots[i]>=1000?'R'+Math.round(tots[i]/1000)+'k':R(tots[i]))+'</text><text class="ax" x="'+lx.toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle">'+esc(l)+'</text>';}});
 var leg='<div class="row" style="flex-wrap:wrap;gap:12px;margin-top:8px">'+series.map(function(s){return '<span class="mini row" style="gap:6px"><span class="dot" style="background:'+s.c+'"></span>'+esc(s.name)+'</span>';}).join('')+'</div>';
 return '<div class="chart"><svg viewBox="0 0 '+W+' '+H+'">'+out+'</svg></div>'+leg;
}
function hbars(rows,total){return rows.map(function(r){var pc=r.t?r.v/r.t*100:(total>0?r.v/total*100:0);return '<div class="perf"><div class="between"><span class="bname"><span class="dot" style="background:'+r.c+'"></span>'+esc(r.n)+'</span><b>'+R(r.v)+(r.nopc?'':' <span class="mini">'+Math.round(pc)+'%'+(r.t?' there':'')+'</span>')+'</b></div><div class="bar"><i style="width:'+Math.min(100,pc).toFixed(1)+'%;background:'+r.c+'"></i></div></div>';}).join('');}
function forecast(months){
 var c=compute(),st=S.settings,g=num(st.growth||9)/100,mr=Math.pow(1+g,1/12)-1;
 var ef=c.efNow,efT=c.efTarget,tfsa=num(S.nw.tfsa),contrib=0,goals=c.goals.filter(function(x){return x.g.inSplit;}).map(function(x){return {name:x.g.name,v:x.saved,t:num(x.g.target),a:x.alloc};});
 var out=[],ym=S.current.month,gift=num(st.dadGift),giftDone=false,tyC=0,te=tyEnd(ym);
 for(var i=1;i<=months;i++){
  ym=addM(S.current.month,i-1);
  if(tyEnd(ym)!==te){te=tyEnd(ym);tyC=0;}
  var inv=c.alloc.invest,efA=c.alloc.emergency;
  if(ef<efT){var add=Math.min(efA,efT-ef);ef+=add;inv+=efA-add;}else inv+=efA;
  goals.forEach(function(x){var add=Math.min(x.a,Math.max(0,x.t-x.v));x.v+=add;inv+=x.a-add;});
  var lump=0;if(gift>0&&!giftDone&&ymP(ym).m===2&&ym<='2027-02'){lump=gift;giftDone=true;}
  tfsa=tfsa*(1+mr)+inv+lump;contrib+=inv+lump;tyC+=inv+lump;
  out.push({ym:ym,label:months>8?MON[ymP(ym).m-1]+' \''+String(ymP(ym).y).slice(2):MON[ymP(ym).m-1],ef:ef,goals:goals.reduce(function(a,x){return a+x.v;},0),goalList:goals.map(function(x){return {name:x.name,v:x.v,t:x.t};}),tfsa:tfsa,contrib:contrib,over:tyC>num(st.tfsaLimit)});
 }
 return out;
}
function openStats(){
 var c=compute(),p=pal(),rows=trackRows(c,S.current.tx),ss=safeToSpend(c),sc=scoreNow(c),nw=netWorth(),cc=ccInfo();
 var el=document.createElement('div');el.className='stats';
 function body(hz){
  var f=forecast(hz),last=f[f.length-1],first={ef:c.efNow,goals:c.goals.filter(function(x){return x.g.inSplit;}).reduce(function(a,x){return a+x.saved;},0),tfsa:num(S.nw.tfsa)};
  var gain=last.ef+last.goals+last.tfsa-(first.ef+first.goals+first.tfsa),growth=last.tfsa-num(S.nw.tfsa)-last.contrib;
  var h='<div class="brand" style="margin-bottom:10px"><div class="logo"><img src="'+logoSrc()+'" alt="">STATS</div><button class="hb" data-x="close" aria-label="Close">'+I.x+'</button></div>';
  h+='<div class="kpis"><div class="kpi"><div class="k">Income</div><div class="v serif">'+R(c.income)+'</div><div class="s">this month</div></div><div class="kpi"><div class="k">Saving</div><div class="v serif gt">'+Math.round(c.saveRate*100)+'%</div><div class="s">'+R(c.saveAmt)+'/mo</div></div><div class="kpi"><div class="k">Score</div><div class="v serif">'+sc.score+'</div><div class="s">'+sc.grade+'</div></div></div>';
  h+='<div class="kpis"><div class="kpi"><div class="k">Net worth</div><div class="v serif">'+R(nw.total)+'</div><div class="s">right now</div></div><div class="kpi"><div class="k">Spent</div><div class="v serif">'+R(rows.filter(function(r){return !r.move;}).reduce(function(a,r){return a+r.used;},0))+'</div><div class="s">this month</div></div><div class="kpi"><div class="k">Credit</div><div class="v serif">'+Math.round(cc.pct*100)+'%</div><div class="s">of R'+cc.limit.toLocaleString('en-US')+' used</div></div></div>';
  // forecast
  h+='<div class="card"><div class="card-h"><h3>Forecast</h3></div><div class="seg" style="margin-bottom:12px">'+[[6,'6 MONTHS'],[12,'1 YEAR'],[24,'2 YEARS']].map(function(o){return '<button data-hz="'+o[0]+'" class="'+(hz===o[0]?'on':'')+'">'+o[1]+'</button>';}).join('')+'</div>';
  h+='<div class="mini">By '+ymL(last.ym,true)+' you\'ll have about</div><div class="serif" style="font-size:44px;line-height:1.05;margin:4px 0">'+R(last.ef+last.goals+last.tfsa)+'</div><div class="mini">saved + invested · <b class="gt">+'+R(gain)+'</b> from today'+(growth>1?', incl. ~'+R(growth)+' TFSA growth':'')+'</div>';
  h+=stackBars(f.map(function(x){return x.label;}),[{name:B('emergency').name,c:p.emergency,values:f.map(function(x){return x.ef;})},{name:'Goals',c:p.goals,values:f.map(function(x){return x.goals;})},{name:'TFSA (EasyEquities)',c:p.invest,values:f.map(function(x){return x.tfsa;})}]);
  var tmax=Math.max(last.tfsa,1);h+='<div style="margin-top:12px">'+hbars([{n:B('emergency').name+(last.ef>=c.efTarget-1?' (full ✓)':' of '+R(c.efTarget)),v:last.ef,t:c.efTarget||1,c:p.emergency}].concat(last.goalList.map(function(x){return {n:x.name+' of '+R(x.t),v:x.v,t:x.t||1,c:p.goals};})).concat([{n:'TFSA value',v:last.tfsa,t:tmax,nopc:true,c:p.invest}]),1)+'</div>';
  var ov=f.filter(function(x){return x.over;})[0];
  h+='<div class="note">TFSA assumes <b>'+num(S.settings.growth||9)+'% a year</b> growth (index funds, not guaranteed: markets go up and down). Contributions: '+R(last.contrib)+(num(S.settings.dadGift)>0&&S.current.month<='2027-02'?', incl. the '+R(S.settings.dadGift)+' lump sum in Feb':'')+'. Once the emergency fund is full, that money flows into the TFSA.</div>';
  if(ov)h+='<div class="alert" style="margin:10px 0 0"><b>TFSA limit warning: '+ymL(ov.ym,true)+'</b>This plan puts more than R46,000 into your TFSA in one tax year. Move part of it to after 1 March.</div>';
  h+='<div class="field" style="margin-top:8px"><label>Growth per year<small>Change to see different outcomes</small></label><div class="money" style="width:100px"><input inputmode="decimal" style="width:50px" data-growth="1" value="'+esc(num(S.settings.growth||9))+'"><span style="color:var(--muted);font-weight:700">%</span></div></div></div>';
  // where money goes
  var planRows=S.buckets.map(function(b){return {n:b.name,v:c.alloc[b.id]||0,c:bucketColor(b.id)};}).filter(function(r){return r.v>0;}).sort(function(a,b){return b.v-a.v;});
  h+='<div class="card"><div class="card-h"><h3>Where your pay goes</h3><span class="mini">'+R(c.income)+'</span></div>'+hbars(planRows,c.income)+'</div>';
  // this month
  h+='<div class="card"><div class="card-h"><h3>This month so far</h3><span class="mini">'+Math.round(ss.pp.elapsed*100)+'% of month gone</span></div>'+rows.filter(function(r){return r.budget>0||r.used>0;}).map(function(r){var ov2=!r.move&&r.used>r.budget+0.5;return '<div class="perf"><div class="between"><span class="bname"><span class="dot" style="background:'+bucketColor(r.id)+'"></span>'+esc(r.name)+'</span><b class="'+(ov2?'rt':'')+'">'+(r.budget>0?Math.round(r.used/r.budget*100):0)+'%</b></div>'+perfBar(r.used,r.budget)+'<div class="mini">'+R(r.used)+' of '+R(r.budget)+'</div></div>';}).join('')+'</div>';
  // history
  var hs=S.history.slice(-6);
  if(hs.length){h+='<div class="card"><div class="card-h"><h3>Past months</h3></div>'+stackBars(hs.map(function(x){return MON[ymP(x.month).m-1];}),[{name:'Saved',c:p.emergency,values:hs.map(monthSaved)},{name:'Spent',c:p.fixed,values:hs.map(function(x){return (x.tx||[]).filter(function(t){return !isMove(t.bucket);}).reduce(function(a,t){return a+num(t.amount);},0);})}])+'<div class="row" style="flex-wrap:wrap;gap:8px;margin-top:10px">'+hs.map(function(x){var s2=x.score||finalScore(x);return '<span class="chip '+(s2>=70?'g':s2>=50?'a':'r')+'">'+MON[ymP(x.month).m-1]+' · '+s2+'</span>';}).join('')+'</div></div>';}
  else h+='<div class="card"><div class="card-h"><h3>Past months</h3></div><div class="hint" style="margin:0">Lock in your first month on payday and your monthly history charts show up here.</div></div>';
  h+='<div class="foot">Forecasts are estimates from your current plan, not promises. Not financial advice.</div>';
  return h;
 }
 var hz=6;function draw(){el.innerHTML='<div class="stats-in">'+body(hz)+'</div>';fmtInputs(el);}
 draw();document.body.appendChild(el);document.body.style.overflow='hidden';
 el.addEventListener('click',function(e){if(e.target.closest('[data-x=close]')){el.remove();document.body.style.overflow='';return;}var b=e.target.closest('[data-hz]');if(b){hz=+b.dataset.hz;var y=el.scrollTop;draw();el.scrollTop=y;}});
 el.addEventListener('change',function(e){if(e.target.dataset.growth){S.settings.growth=Math.max(0,Math.min(30,num(e.target.value)));S.updatedAt=Date.now();try{localStorage.setItem(LS_KEY,JSON.stringify(S));}catch(er){}var y=el.scrollTop;draw();el.scrollTop=y;}});
}

/* ---------- sheet ---------- */
function sheet(title,fields,onSave,onDelete,subtitle,okLabel){
 var el=document.createElement('div');el.className='sheet-bg';
 var h='<div class="sheet"><h3 class="serif">'+esc(title)+'</h3>'+(subtitle?'<div class="sub2">'+subtitle+'</div>':'');
 fields.forEach(function(f){
  if(f.type==='html'){h+=f.html;return;}
  h+='<div class="f"'+(f.id?' id="'+f.id+'"':'')+'>';
  if(f.type==='toggle')h+='<div class="tog"><span>'+esc(f.label)+'</span><div class="sw'+(f.value?' on':'')+'" data-k="'+f.k+'"></div></div>';
  else{h+='<label>'+esc(f.label)+'</label>';
   if(f.type==='money')h+='<div class="money"><span>R</span><input inputmode="decimal" data-k="'+f.k+'" value="'+esc(f.value)+'"'+(f.ph?' placeholder="'+esc(f.ph)+'"':'')+'></div>';
   else if(f.type==='chips')h+='<div class="chips" data-k="'+f.k+'">'+f.options.map(function(o){return '<button type="button" class="copt'+(o.v===f.value?' on':'')+(o.v===f.sugg?' sugg':'')+'" data-v="'+esc(o.v)+'">'+(o.c?'<span class="dot" style="background:'+o.c+'"></span>':'')+esc(o.label)+'</button>';}).join('')+'</div>';
   else if(f.type==='textarea')h+='<textarea class="txt" data-k="'+f.k+'"'+(f.ph?' placeholder="'+esc(f.ph)+'"':'')+'>'+esc(f.value)+'</textarea>';
   else h+='<input class="txt" type="'+(f.type||'text')+'" data-k="'+f.k+'" value="'+esc(f.value)+'"'+(f.ph?' placeholder="'+esc(f.ph)+'"':'')+(f.mode?' inputmode="'+f.mode+'"':'')+'>';}
  h+='</div>';});
 h+='<div class="acts">'+(onDelete?'<button class="btn line danger" data-s="del">Delete</button>':'<button class="btn line" data-s="cancel">Cancel</button>')+'<button class="btn g" data-s="ok">'+(okLabel||'Save')+'</button></div></div>';
 el.innerHTML=h;document.body.appendChild(el);fmtInputs(el);
 el.addEventListener('click',function(e){
  if(e.target===el){el.remove();return;}
  var sw=e.target.closest('.sw');if(sw){sw.classList.toggle('on');return;}
  var co=e.target.closest('.copt');if(co){co.parentNode.querySelectorAll('.copt').forEach(function(x){x.classList.remove('on');});co.classList.add('on');if(co.dataset.fill){var tgt=el.querySelector('[data-k="'+co.dataset.fill+'"]');if(tgt)tgt.value=co.dataset.v;co.classList.remove('on');}return;}
  var qa=e.target.closest('[data-quick]');if(qa){var q=JSON.parse(qa.dataset.quick);['amount','note'].forEach(function(k){var i=el.querySelector('[data-k='+k+']');if(i)i.value=q[k];});el.querySelectorAll('[data-k=bucket] .copt').forEach(function(x){x.classList.toggle('on',x.dataset.v===q.bucket);});return;}
  var b=e.target.closest('[data-s]');if(!b)return;
  if(b.dataset.s==='cancel'){el.remove();return;}
  if(b.dataset.s==='del'){if(b.dataset.sure){onDelete();el.remove();}else{b.dataset.sure='1';b.textContent='Tap again';}return;}
  var out={};el.querySelectorAll('[data-k]').forEach(function(i){if(i.classList.contains('chips')){var on=i.querySelector('.copt.on');out[i.dataset.k]=on?on.dataset.v:'';}else out[i.dataset.k]=i.classList.contains('sw')?i.classList.contains('on'):i.value;});
  if(onSave(out)===false)return;el.remove();
 });
 setTimeout(function(){var f=el.querySelector('input[data-k]');if(f&&!f.value&&f.closest('.money'))f.focus();},350);
 return el;
}
function modal(html){var el=document.createElement('div');el.className='sheet-bg';el.innerHTML='<div class="sheet">'+html+'</div>';document.body.appendChild(el);el.addEventListener('click',function(e){if(e.target===el)el.remove();});return el;}
function txTargets(){var o=[];S.buckets.forEach(function(b){if(b.id==='goals')S.goals.forEach(function(g){o.push({v:'goal:'+g.id,label:g.name,c:bucketColor('goal:'+g.id)});});else o.push({v:b.id,label:b.name,c:bucketColor(b.id)});});return o;}

/* after logging: "R200 sent to Fun · R300 left" */
function sentCard(t){
 var c=compute(),row=trackRows(c,S.current.tx).filter(function(r){return r.id===t.bucket;})[0]||{budget:0,used:0,move:isMove(t.bucket)};
 var left=row.budget-row.used,over=!row.move&&left<-0.5,h='<div class="sent"><div class="tick'+(over?' bad':'')+'">'+(over?I.warn:I.check)+'</div><div class="amt serif">'+R2(t.amount)+'</div><div style="font-weight:800;margin-top:6px">sent to '+esc(targetName(t.bucket))+'</div>';
 h+='<div class="sub" style="margin-top:6px">'+(row.move?R(row.used)+' of '+R(row.budget)+' moved this month':over?'<span class="rt">Over by '+R(-left)+'</span> in '+esc(targetName(t.bucket)):R(left)+' left to spend in '+esc(targetName(t.bucket)))+'</div></div>';
 if(t.card==='credit'){var ci=ccInfo();h+='<div class="mini" style="text-align:center;margin-top:-4px">On credit card · '+R(ci.owed)+' of '+R(ci.limit)+' used</div>';}
 h+='<div class="perf" style="border:0">'+perfBar(row.used,row.budget)+'<div class="between"><span class="mini">'+R(row.used)+' used</span><span class="mini">'+R(row.budget)+' budget</span></div></div>';
 h+='<div class="acts" style="display:flex;gap:10px;margin-top:14px">'+(over?'<button class="btn soft" style="flex:1" data-c="cover">Cover it</button>':'')+'<button class="btn g" style="flex:1" data-c="ok">Done</button></div>';
 var el=modal(h);el.addEventListener('click',function(e){var b=e.target.closest('[data-c]');if(!b)return;el.remove();if(b.dataset.c==='cover')coverSheet(t.bucket);});
}
function recentQuick(){var seen={},out=[];var all=S.current.tx.slice().concat([].concat.apply([],S.history.slice(-2).map(function(h){return h.tx||[];})));all.sort(function(a,b){return (b.at||0)-(a.at||0);});all.forEach(function(t){var k=(t.note||'')+'|'+t.bucket;if(!t.note||seen[k]||out.length>=6)return;seen[k]=1;out.push({amount:t.amount,note:t.note,bucket:t.bucket});});return out;}
function txSheet(t,isNew,sub,sugg,cands){
 var fields=[];
 if(isNew&&!cands){var q=recentQuick();if(q.length)fields.push({type:'html',html:'<div class="f"><label style="display:block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-weight:800;margin-bottom:6px">Repeat a recent one</label><div class="chips">'+q.map(function(x){return '<button type="button" class="copt" data-quick="'+esc(JSON.stringify(x))+'">'+esc(trunc(x.note,18))+' · '+R(x.amount)+'</button>';}).join('')+'</div></div>'});}
 fields.push({k:'amount',label:'Amount',type:'money',value:t.amount==null?'':t.amount,ph:'0.00'});
 if(cands&&cands.length>1)fields.push({type:'html',html:'<div class="f"><label style="display:block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-weight:800;margin-bottom:6px">Other amounts I saw: tap the right one</label><div class="chips">'+cands.map(function(v){return '<button type="button" class="copt" data-fill="amount" data-v="'+v.toFixed(2)+'">'+R2(v)+'</button>';}).join('')+'</div></div>'});
 fields.push({k:'note',label:'What was it',value:t.note||'',ph:'e.g. takeaways, fuel'},{k:'bucket',label:'Which bucket',type:'chips',options:txTargets(),value:t.bucket||'',sugg:sugg},{k:'card',label:'Paid with',type:'chips',options:[{v:'debit',label:'Debit card',c:'#18A862'},{v:'credit',label:'Credit card',c:'#2a2f2c'},{v:'cash',label:'Cash',c:'#9CCBB2'}],value:t.card||S.lastCard||'debit'},{k:'date',label:'Date',type:'date',value:t.date||todayISO()});
 sheet(isNew?'What was it for?':'Edit purchase',fields,function(o){
  if(!(num(o.amount)>0)){toast('Add an amount');return false;}
  if(!o.bucket){toast('Pick a bucket');return false;}
  t.amount=Math.round(num(o.amount)*100)/100;t.note=o.note;t.bucket=o.bucket;t.date=o.date||todayISO();t.card=o.card||'debit';S.lastCard=t.card;
  if(isNew){if(!t.at)t.at=Date.now();S.current.tx.push(t);}
  save();if(isNew)sentCard(t);else toast('Updated');
 },isNew?null:function(){S.current.tx=S.current.tx.filter(function(x){return x.id!==t.id;});save('Removed');},sub);
}
function coverSheet(bucketId){
 var c=compute(),rows=trackRows(c,S.current.tx),row=rows.filter(function(r){return r.id===bucketId;})[0];if(!row)return;
 var need=Math.max(0,row.used-row.budget),src=rows.filter(function(r){return r.id!==bucketId&&r.id!=='fixed'&&r.budget-r.used>0.5;});
 if(!src.length){toast('No bucket has money left to move');return;}
 function pri(r){return r.id==='buffer'?0:!r.move?1:r.id==='invest'?2:r.id==='emergency'?3:String(r.id).indexOf('goal:')===0?4:5;}
 src.sort(function(a,b){return pri(a)-pri(b)||(b.budget-b.used)-(a.budget-a.used);});var best=src[0];
 sheet('Cover '+targetName(bucketId),[{k:'from',label:'Take it from',type:'chips',options:src.map(function(r){return {v:r.id,label:r.name+' ('+R(r.budget-r.used)+' left)',c:bucketColor(r.id)};}),value:best.id},{k:'amount',label:'How much',type:'money',value:Math.round(Math.min(need,best.budget-best.used))}],function(o){
  var a=num(o.amount),fr=rows.filter(function(r){return r.id===o.from;})[0];
  if(!(a>0)||!fr){toast('Pick a bucket and amount');return false;}
  if(a>fr.budget-fr.used+0.5){a=Math.floor(fr.budget-fr.used);toast('Moved '+R(a)+', all '+fr.name+' had left');}
  S.current.adj.push({from:o.from,to:bucketId,amount:Math.round(a*100)/100,at:Date.now()});save(R(a)+' moved from '+fr.name);
 },null,R(need)+' over. Move money from a bucket that still has some left, so every rand stays planned. Buffer and spending buckets first, savings last.','Move it');
}

/* ---------- receipt total scanner (runs on the phone) ---------- */
var ocrWorker=null,ocrLoading=null;
function loadScript(src){return new Promise(function(res,rej){var s=document.createElement('script');s.src=src;s.onload=res;s.onerror=function(){rej(new Error('load'));};document.head.appendChild(s);});}
function getWorker(onProg){
 if(ocrWorker)return Promise.resolve(ocrWorker);
 if(ocrLoading)return ocrLoading;
 ocrLoading=(window.Tesseract?Promise.resolve():loadScript('ocr/tesseract.min.js')).then(function(){
  var base=new URL('ocr/',location.href).href;
  return Tesseract.createWorker('eng',1,{workerPath:base+'worker.min.js',corePath:base+'core',langPath:base+'lang',gzip:true,workerBlobURL:false,logger:function(m){if(onProg&&m&&typeof m.progress==='number')onProg(m);}});
 }).then(function(w){ocrWorker=w;return w.setParameters({tessedit_char_whitelist:'0123456789.,RrTOTALtotalDUEdueAMOUNTamountBALANCEbalancePAYpaySUBsubVATvatCASHcashCHANGEchangeCARDcard -:'}).then(function(){return w;});});
 ocrLoading.catch(function(){ocrLoading=null;});
 return ocrLoading;
}
function prep(file){return new Promise(function(res,rej){var url=URL.createObjectURL(file),img=new Image();img.onload=function(){var mx=1800,k=Math.min(1,mx/Math.max(img.width,img.height)),w=Math.round(img.width*k),h=Math.round(img.height*k);if(Math.max(w,h)<900){k=900/Math.max(img.width,img.height);w=Math.round(img.width*k);h=Math.round(img.height*k);}var cv=document.createElement('canvas');cv.width=w;cv.height=h;var cx=cv.getContext('2d');cx.drawImage(img,0,0,w,h);var d=cx.getImageData(0,0,w,h),p=d.data;for(var i=0;i<p.length;i+=4){var g=0.299*p[i]+0.587*p[i+1]+0.114*p[i+2];g=g>150?255:g<90?0:(g-90)*4.25;p[i]=p[i+1]=p[i+2]=g;}cx.putImageData(d,0,0);URL.revokeObjectURL(url);res(cv);};img.onerror=function(){rej(new Error('img'));};img.src=url;});}
function parseTotal(text){
 var lines=String(text||'').split(/\n/),amtRe=/(\d{1,3}(?:[ ,]\d{3})+|\d+)\s?[.,]\s?(\d{2})(?!\d)/g,all=[],best=null,bestRank=-1;
 lines.forEach(function(line){var found=[],m;amtRe.lastIndex=0;while((m=amtRe.exec(line))){var v=parseFloat(m[1].replace(/[ ,]/g,'')+'.'+m[2]);if(v>0&&v<100000){found.push(v);all.push(v);}}
  if(!found.length)return;var L=line.toLowerCase(),rank=-1;
  if(/sub\s*-?\s*tot|vat|tax|disc|saving|change|tender|cash\b|rounding/.test(L))rank=-1;
  else if(/(grand\s*total|total\s*due|amount\s*due|balance\s*due|to\s*pay|amt\s*due)/.test(L))rank=3;
  else if(/\btot(al)?\b|t0tal|totai/.test(L))rank=2;
  else if(/\b(card|amount|amt|due)\b/.test(L))rank=1;
  if(rank>bestRank){bestRank=rank;best=found[found.length-1];}});
 var uniq=all.filter(function(v,i){return all.indexOf(v)===i;}).sort(function(a,b){return b-a;}).slice(0,6);
 if(best==null&&uniq.length)best=uniq.length===1?uniq[0]:uniq[0];
 return {total:best,cands:uniq,sure:bestRank>=2||uniq.length===1};
}
function scanFlow(){
 var inp=document.createElement('input');inp.type='file';inp.accept='image/*';inp.setAttribute('capture','environment');inp.style.display='none';document.body.appendChild(inp);
 inp.addEventListener('change',function(){var f=inp.files&&inp.files[0];inp.remove();if(!f)return;
  var ov=modal('<div class="scan"><div class="spin"></div><div id="ocrMsg">Reading the total…</div><div class="pbar"><i id="ocrBar"></i></div><div class="mini">First scan loads the reader (~10 MB), then it works offline.</div></div>');
  var bar=ov.querySelector('#ocrBar'),msg=ov.querySelector('#ocrMsg');
  getWorker(function(m){if(bar)bar.style.width=Math.round(m.progress*100)+'%';if(msg&&m.status)msg.textContent=/recogniz/.test(m.status)?'Reading the total…':'Getting the reader ready…';})
  .then(function(w){return prep(f).then(function(cv){return w.recognize(cv);});})
  .then(function(r){ov.remove();var p=parseTotal(r&&r.data&&r.data.text);
   if(p.total==null)toast('Couldn\'t find a total. Type it in');
   txSheet({id:uid(),src:'scan',at:Date.now(),amount:p.total==null?'':p.total.toFixed(2),date:todayISO()},true,p.total==null?'Couldn\'t read a number. Try again closer to the total, or type it.':(p.sure?'Found the total. Check it, then pick the bucket.':'Not 100% sure. Check the amount or tap the right one below.'),'',p.cands);
  }).catch(function(e){ov.remove();toast('Scanner couldn\'t start. Add it manually');txSheet({id:uid(),src:'manual',at:Date.now()},true);});
 });
 inp.click();
}

/* ---------- fixed cost sheets ---------- */
function costSheet(c,isNew){
 var isFuel=!!c.fuel;
 var fields=[{k:'name',label:'What is it',value:c.name||''}];
 if(isFuel)fields.push({k:'litres',label:'Litres a month',value:c.litres||'',mode:'decimal'},{k:'price',label:'Price per litre (R)',value:S.settings.fuelPrice,mode:'decimal'});
 else fields.push({k:'amount',label:'Amount each time',type:'money',value:c.amount==null?'':c.amount},{k:'freq',label:'How often',type:'chips',options:[{v:'monthly',label:'Every month'},{v:'days',label:'Every X days'},{v:'yearly',label:'Once a year'}],value:c.freq||'monthly'},{k:'days',label:'If every X days: how many days',value:c.days||30,mode:'numeric'},{k:'day',label:'Day of the month it comes off (blank if not sure)',value:c.day||'',mode:'numeric'});
 fields.push({k:'card',label:'Paid with',type:'chips',options:PAYOPTS,value:c.card||''});
 if(isNew)fields.push({k:'isFuel',label:'This is fuel (litres × price)',type:'toggle',value:false});
 sheet(isNew?'New fixed expense':'Edit '+(c.name||'expense'),fields,function(o){
  if(!o.name){toast('Give it a name');return false;}
  if(isNew&&o.isFuel){c.fuel=true;c.litres=Math.round(num(o.amount)/num(S.settings.fuelPrice)*10)/10||40;c.freq='monthly';}
  else if(isFuel){c.litres=num(o.litres);if(num(o.price)>0&&num(o.price)!==num(S.settings.fuelPrice)){S.settings.fuelPrice=num(o.price);S.settings.fuelMonth=thisYM();}}
  else{if(!(num(o.amount)>0)){toast('Add an amount');return false;}var na=Math.round(num(o.amount)*100)/100;if(!isNew&&num(c.amount)&&na!==num(c.amount))c.prevAmount=num(c.amount);c.amount=na;c.freq=o.freq||'monthly';c.days=Math.max(1,num(o.days)||30);var dd=Math.round(num(o.day));c.day=(dd>=1&&dd<=31)?dd:'';}
  c.name=o.name;c.card=o.card||'';c.est=false;
  if(isNew){c.id=c.id||uid();S.costs.push(c);}
  save((isNew?'Added ':'Updated ')+c.name+' · '+R(costM(c))+'/month');
  if(isNew&&c.fuel)setTimeout(function(){costSheet(c,false);},400);
 },isNew?null:function(){S.costs=S.costs.filter(function(x){return x.id!==c.id;});save('Removed '+c.name);},isNew?'Taken off the top every month. Add the day and it comes off your bank by itself on that date.':(isFuel?'Budget = litres × price. Update the price when it changes.':null));
}
function bizSheet(){var b=B('business');sheet(b.name+' debit order',[{k:'amount',label:'Amount each month',type:'money',value:b.amount},{k:'day',label:'Day of the month it comes off',value:b.day||'',mode:'numeric'},{k:'card',label:'Paid with',type:'chips',options:PAYOPTS,value:b.card||'order'}],function(o){b.amount=num(o.amount);var dd=Math.round(num(o.day));b.day=(dd>=1&&dd<=31)?dd:'';b.card=o.card||'order';save('Updated');});}
function goalFields(g){return [{k:'name',label:'Goal name',value:g.name},{k:'target',label:'Target',type:'money',value:g.target},{k:'saved',label:'Already saved (before the app)',type:'money',value:g.saved},{k:'deadline',label:'Deadline',type:'date',value:g.deadline},{k:'inSplit',label:'Fund it from my monthly split',type:'toggle',value:g.inSplit},{k:'note',label:'Notes',type:'textarea',value:g.note||''}];}
function applyGoal(g,o){g.name=o.name||'Goal';g.target=num(o.target);g.saved=num(o.saved);g.deadline=o.deadline||g.deadline;g.inSplit=!!o.inSplit;g.note=o.note;}

/* ---------- lock month + rollover ---------- */
function doLock(rollChoice){
 var cc=compute(),rows=trackRows(cc,S.current.tx),lm=S.current.month;
 var left={};rows.forEach(function(r){if((r.id==='fun'||r.id==='buffer')&&r.budget-r.used>0.5)left[r.id]=Math.round(r.budget-r.used);});
 var leftTot=sumObj(left),directed=clone(cc.directed),nextRoll={};
 if(leftTot>0&&rollChoice){if(rollChoice==='fun')nextRoll.fun=leftTot;else directed[rollChoice.indexOf('goal:')===0?rollChoice.slice(5):rollChoice]=(directed[rollChoice.indexOf('goal:')===0?rollChoice.slice(5):rollChoice]||0)+leftTot;}
 var rec={month:lm,salary:num(S.current.salary),dad:num(S.current.dad),extras:clone(S.current.extras),income:Math.round(cc.income),alloc:clone(cc.alloc),bud:clone(cc.bud),goalAlloc:{},directed:directed,plannedSave:cc.saveAmt,actual:null,lockedAt:Date.now(),tx:clone(S.current.tx),adj:clone(S.current.adj),roll:clone(S.current.roll),nw:Math.round(netWorth().total)};
 cc.goals.forEach(function(x){rec.goalAlloc[x.g.id]=x.alloc;});
 rec.score=finalScore(rec);
 S.history=S.history.filter(function(h){return h.month!==lm;}).concat([rec]).sort(function(a,b){return a.month<b.month?-1:1;});
 S.current={month:addM(lm,1),salary:S.current.salary,dad:S.current.dad,extras:[],tx:[],adj:[],roll:nextRoll};
 tab='history';openMonth=lm;save(ymL(lm,true)+' locked in · score '+rec.score);
}
function lockFlow(){
 var cc=compute(),rows=trackRows(cc,S.current.tx),left=0;rows.forEach(function(r){if((r.id==='fun'||r.id==='buffer')&&r.budget-r.used>0.5)left+=r.budget-r.used;});
 if(left<1){sheet('Lock in '+ymL(S.current.month,true)+'?',[],function(){doLock(null);},null,'Saves this month to History and starts '+ymL(addM(S.current.month,1),true)+'. Do it on payday.','Lock it in');return;}
 var opts=[{v:'emergency',label:B('emergency').name,c:bucketColor('emergency')},{v:'invest',label:B('invest').name,c:bucketColor('invest')}].concat(S.goals.filter(function(g){return g.inSplit;}).map(function(g){return {v:'goal:'+g.id,label:g.name,c:bucketColor('goal:'+g.id)};})).concat([{v:'fun',label:'Next month\'s fun',c:bucketColor('fun')}]);
 sheet('Nice: '+R(left)+' left over',[{k:'to',label:'Where should it go?',type:'chips',options:opts,value:'emergency'}],function(o){doLock(o.to||'emergency');},null,'You didn\'t spend all your fun + buffer money. Send it to savings (best), or roll it into next month\'s fun.','Lock in month');
}

/* ---------- backup ---------- */
function backupText(){return JSON.stringify(S);}
function importText(txt){
 var o;try{o=JSON.parse(String(txt).trim());}catch(e){toast('That doesn\'t look like a backup');return false;}
 if(!o||typeof o!=='object'||!o.buckets){toast('That doesn\'t look like a Vault backup');return false;}
 S=migrate(o);firstRun=false;
 if(!S.bank||S.bank.anchorAt==null)S.bank={anchor:0,anchorDate:todayISO(),anchorAt:Date.now(),actual:0};
 save('Backup loaded ✓');return true;
}
function importFlow(){
 var el=sheet('Load a backup',[{k:'txt',label:'Paste your backup text',type:'textarea',value:'',ph:'{"v":1,…}'},{type:'html',html:'<button type="button" class="btn line block" id="pickFile" style="margin-bottom:6px">…or choose a backup file</button>'}],function(o){return importText(o.txt)?undefined:false;},null,'This replaces what\'s in the app now.','Load it');
 el.querySelector('#pickFile').addEventListener('click',function(){var i=document.createElement('input');i.type='file';i.accept='.json,application/json,text/plain';i.onchange=function(){var f=i.files[0];if(!f)return;var fr=new FileReader();fr.onload=function(){if(importText(fr.result))el.remove();};fr.readAsText(f);};i.click();});
}

/* ---------- PIN ---------- */
function hashPin(p){if(window.crypto&&crypto.subtle){return crypto.subtle.digest('SHA-256',new TextEncoder().encode('vault:'+p)).then(function(b){return Array.from(new Uint8Array(b)).map(function(x){return x.toString(16).padStart(2,'0');}).join('');});}return Promise.resolve('p'+p);}
function pinPad(title,onDone,cancelable){
 var el=document.createElement('div');el.className='lock';var val='';
 function draw(){el.innerHTML='<img src="'+logoSrc()+'" alt=""><div style="font-weight:800;font-size:18px">'+esc(title)+'</div><div class="pins">'+[0,1,2,3].map(function(i){return '<i class="'+(i<val.length?'f':'')+'"></i>';}).join('')+'</div><div class="pad">'+[1,2,3,4,5,6,7,8,9].map(function(n){return '<button data-n="'+n+'">'+n+'</button>';}).join('')+'<button class="x" data-n="c">'+(cancelable?'Cancel':'')+'</button><button data-n="0">0</button><button class="x" data-n="b">⌫</button></div>';}
 draw();document.body.appendChild(el);
 el.addEventListener('click',function(e){var b=e.target.closest('[data-n]');if(!b)return;var n=b.dataset.n;
  if(n==='c'){if(cancelable)el.remove();return;}if(n==='b'){val=val.slice(0,-1);draw();return;}
  if(val.length<4){val+=n;draw();}
  if(val.length===4){var v=val;setTimeout(function(){onDone(v,el,function(){val='';draw();var p=el.querySelector('.pins');p.classList.add('shake');});},120);}});
 return el;
}
function showLock(){
 var hsh=localStorage.getItem(PIN_KEY);if(!hsh||locked)return;locked=true;
 pinPad('Enter your PIN',function(v,el,fail){hashPin(v).then(function(x){if(x===hsh){el.remove();locked=false;}else fail();});},false);
}
function setPinFlow(){pinPad('Choose a 4-digit PIN',function(a,el1){el1.remove();pinPad('Type it again',function(b,el2,fail){if(a!==b){fail();toast('Didn\'t match, try again');return;}hashPin(a).then(function(x){localStorage.setItem(PIN_KEY,x);el2.remove();render();toast('PIN set ✓');});},true);},true);}
var hiddenAt=0;
document.addEventListener('visibilitychange',function(){if(document.hidden)hiddenAt=Date.now();else if(hiddenAt&&Date.now()-hiddenAt>60000)showLock();});

/* ---------- toast ---------- */
var tt;function toast(m){var t=document.querySelector('.toast');if(!t){t=document.createElement('div');t.className='toast';document.body.appendChild(t);}t.textContent=m;t.classList.add('show');clearTimeout(tt);tt=setTimeout(function(){t.classList.remove('show');},2200);}

/* ---------- events ---------- */
function rerender(){var y=window.scrollY;render();window.scrollTo(0,y);}
root.addEventListener('input',function(e){
 var t=e.target,d=t.dataset;
 if(d.cur)S.current[d.cur]=t.value;
 else if(d.extra){var x=findById(S.current.extras,d.extra);if(x)x[d.f]=t.value;}
 else if(d.bucket){B(d.bucket)[d.f]=t.value;}
 else if(d.set){S.settings[d.set]=t.value;}
 else if(d.ef)S.ef.saved=t.value;
 else if(d.bank)S.bank.actual=t.value;
 else if(d.nw)S.nw[d.nw]=t.value;
 else if(d.hist){S.history.forEach(function(h){if(h.month===d.hist)h.actual=t.value===''?null:t.value;});}
 else return;
 S.updatedAt=Date.now();try{localStorage.setItem(LS_KEY,JSON.stringify(S));}catch(er){}
});
root.addEventListener('change',function(e){
 var t=e.target,d=t.dataset;
 if(d.set&&d.set!=='theme'){S.settings[d.set]=num(t.value);if(d.set==='fuelPrice')S.settings.fuelMonth=thisYM();}
 if(d.bank)S.bank.actual=num(t.value);
 if(d.nw&&d.nw!=='otherLabel')S.nw[d.nw]=num(t.value);
 if(d.cur)S.current[d.cur]=num(t.value);
 if(d.extra&&d.f==='amount'){var xe=findById(S.current.extras,d.extra);if(xe)xe.amount=num(t.value);}
 if(d.bucket&&d.f==='amount')B(d.bucket).amount=num(t.value);
 if(d.ef)S.ef.saved=num(t.value);
 if(d.ccset){S.cc.owedStart=num(t.value);S.cc.startAt=Date.now();}
 if(d.cclimit)S.cc.limit=num(t.value);
 if(d.cur||d.extra||d.bucket||d.set||d.ef||d.hist||d.bank||d.nw||d.ccset||d.cclimit){S.updatedAt=Date.now();try{localStorage.setItem(LS_KEY,JSON.stringify(S));}catch(er){}rerender();}
});
root.addEventListener('click',function(e){
 var tb=e.target.closest('[data-tab]');
 if(tb){tab=tb.dataset.tab;try{history.replaceState(null,'','#'+tab);}catch(er){}render();window.scrollTo(0,0);return;}
 var sb=e.target.closest('[data-sub]');if(sb){moreSub=sb.dataset.sub;render();return;}
 var mc=e.target.closest('.mcard');
 var a=e.target.closest('[data-act]');
 if(mc&&!a&&!e.target.closest('[data-stop]')){openMonth=openMonth===mc.dataset.month?null:mc.dataset.month;rerender();return;}
 if(!a)return;var act=a.dataset.act,id=a.dataset.id;
 if(a.tagName==='A')e.preventDefault();
 switch(act){
 case 'fresh':firstRun=false;save();return;
 case 'import':importFlow();return;
 case 'theme':S.settings.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';save();return;
 case 'setTheme':S.settings.theme=a.dataset.v;save();return;
 case 'lockNow':showLock();return;
 case 'setPin':setPinFlow();return;
 case 'removePin':if(a.dataset.sure){localStorage.removeItem(PIN_KEY);render();toast('PIN removed');}else{a.dataset.sure='1';a.textContent='Tap again';}return;
 case 'addMenu':var m=modal('<h3 class="serif">Add</h3><div class="acts2" style="margin:0"><button class="btn g" data-m="scan">'+I.scan+'Scan total</button><button class="btn line" style="height:56px" data-m="manual">Type it in</button></div><button class="btn ghost" data-m="cost">+ New fixed expense</button><button class="btn ghost" data-m="extra">+ Extra money in</button>');m.addEventListener('click',function(ev){var bb=ev.target.closest('[data-m]');if(!bb)return;m.remove();var w=bb.dataset.m;if(w==='scan')scanFlow();else if(w==='cost')costSheet({freq:'monthly',days:30},true);else if(w==='extra'){S.current.extras.push({id:uid(),label:'',amount:'',to:'split'});tab='plan';save();}else txSheet({id:uid(),src:'manual'},true);});return;
 case 'scan':scanFlow();return;
 case 'hf':histFilter=a.dataset.v;rerender();return;
 case 'stats':openStats();return;
 case 'bankList':bankOpen=!bankOpen;rerender();return;
 case 'cash':cashFlow();return;
 case 'togglePF':S.nw.includePF=!S.nw.includePF;save(S.nw.includePF?'Provident fund counted':'Provident fund not counted');return;
 case 'tipToggle':S.current.tipDone=S.current.tipDone||{};var tid=a.dataset.id,cur=S.current.tipDone[tid];
  if(cur!==undefined)delete S.current.tipDone[tid];else S.current.tipDone[tid]=a.dataset.k!=='ok';
  save(S.current.tipDone[tid]===true?'Ticked off ✓':S.current.tipDone[tid]===false?'Marked as not done':'Back to automatic');return;
 case 'bankEdit':var bf=document.querySelector('[data-bank=actual]');if(bf){bf.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(function(){bf.focus();},400);}else{tab='plan';render();}return;
 case 'ccPay':var ci=ccInfo();sheet('Pay credit card',[{k:'amount',label:'How much are you paying off?',type:'money',value:ci.owed},{k:'limit',label:'Card limit',type:'money',value:ci.limit}],function(o){S.cc.limit=num(o.limit)||ci.limit;var a=num(o.amount);if(a>0){S.current.tx.push({id:uid(),src:'manual',at:Date.now(),amount:Math.round(a*100)/100,note:'Credit card payment',bucket:'ccpay',card:'debit',date:todayISO()});save(R(a)+' paid off. '+R(Math.max(0,ci.owed-a))+' still owed');}else save('Updated');},null,R(ci.owed)+' owed of '+R(ci.limit)+'. Paying it moves money from your debit account to the card. Your buckets don\'t change, because the purchases were already counted.','Pay it');return;
 case 'addTx':txSheet({id:uid(),src:'manual'},true);return;
 case 'editTx':var tx=findById(S.current.tx,id);if(tx)txSheet(tx,false);else toast('That one is in a locked month');return;
 case 'cover':coverSheet(id);return;
 case 'delAdj':S.current.adj.splice(+a.dataset.i,1);save('Move undone');return;
 case 'addExtra':S.current.extras.push({id:uid(),label:'',amount:'',to:'split'});save();return;
 case 'delExtra':S.current.extras=S.current.extras.filter(function(x){return x.id!==id;});save();return;
 case 'addCost':costSheet({freq:'monthly',days:30},true);return;
 case 'editCost':var ec=findById(S.costs,id);if(ec)costSheet(ec,false);return;
 case 'editBiz':bizSheet();return;
 case 'delCost':if(a.classList.contains('armed')){var dc=findById(S.costs,id);S.costs=S.costs.filter(function(x){return x.id!==id;});save('Removed '+(dc?dc.name:''));}else{a.classList.add('armed');toast('Tap ✕ again to remove');}return;
 case 'fuelPrice':sheet('Fuel price',[{k:'price',label:'New price per litre (R)',value:S.settings.fuelPrice,mode:'decimal'}],function(o){if(!(num(o.price)>0))return false;S.settings.fuelPrice=num(o.price);S.settings.fuelMonth=thisYM();save('Fuel budget updated');},null,'Check the price at the pump or in the news.');return;
 case 'addBucket':var nb={id:'c_'+uid(),name:'New bucket',amount:200,custom:true,why:'Why this bucket exists, in one line.'};var bi=S.buckets.findIndex(function(b){return b.id==='goals';});S.buckets.splice(bi<0?S.buckets.length:bi,0,nb);save();return;
 case 'delBucket':S.buckets=S.buckets.filter(function(b){return b.id!==id;});save();return;
 case 'lock':lockFlow();return;
 case 'delHist':if(a.dataset.sure){S.history=S.history.filter(function(h){return h.month!==a.dataset.m;});save('Month deleted');}else{a.dataset.sure='1';a.textContent='Tap again to delete';}return;
 case 'editGoal':var g=findById(S.goals,id);sheet('Edit goal',goalFields(g),function(o){applyGoal(g,o);save('Updated');},function(){S.goals=S.goals.filter(function(x){return x.id!==id;});save('Goal deleted');});return;
 case 'addGoal':var ng={id:'g_'+uid(),name:'',target:5000,saved:0,deadline:addM(S.current.month,6)+'-28',inSplit:true,note:''};sheet('New goal',goalFields(ng),function(o){applyGoal(ng,o);S.goals.push(ng);save('Goal added');});return;
 case 'editEF':sheet('Emergency fund',[{k:'saved',label:'Saved before the app',type:'money',value:S.ef.saved},{k:'months',label:'Months of costs to hold',value:S.settings.efMonths,mode:'numeric'}],function(o){S.ef.saved=num(o.saved);S.settings.efMonths=Math.max(1,num(o.months)||3);save('Updated');});return;
 case 'editPF':sheet('Provident fund',[{k:'monthly',label:'Goes in each month',type:'money',value:S.pf.monthly},{k:'start',label:'Started (YYYY-MM)',value:S.pf.start},{k:'balance',label:'Real balance from statement (blank = estimate)',type:'money',value:S.pf.balance}],function(o){S.pf.monthly=num(o.monthly);if(/^\d{4}-\d{2}$/.test(o.start))S.pf.start=o.start;S.pf.balance=o.balance===''?'':num(o.balance);save('Updated');});return;
 case 'reanchor':if(a.dataset.sure){S.bank.anchor=num(S.bank.actual);S.bank.anchorDate=todayISO();S.bank.anchorAt=Date.now();save('Fresh start: '+R(S.bank.anchor));}else{a.dataset.sure='1';a.textContent='Tap again';}return;
 case 'debits':
  var logged={};(S.current.tx||[]).forEach(function(t){logged[t.note]=1;});
  var list=chargeItems().filter(function(x){return x.freq==='monthly';}).map(function(x){return {name:x.name,amt:x.amt,card:x.card==='credit'?'credit':'debit',bucket:x.biz?'business':'fixed',pre:!!(x.day&&nextCharge(x.day).passed&&!logged[x.name]),done:!!logged[x.name]};});
  if(!list.length){toast('Add fixed expenses first');return;}
  var m2=modal('<h3 class="serif">Log debit orders</h3><div class="sub2">Tick the ones that already went off this month.</div>'+list.map(function(x,i){return '<div class="tog" style="margin-bottom:8px"><span>'+esc(x.name)+' <b class="gt">'+R(x.amt)+'</b>'+(x.done?' <span class="mini">· logged ✓</span>':'')+'</span><div class="sw'+(x.pre?' on':'')+'" data-i="'+i+'"></div></div>';}).join('')+'<div class="acts" style="display:flex;gap:10px;margin-top:14px"><button class="btn line" style="flex:1" data-s="cancel">Cancel</button><button class="btn g" style="flex:1" data-s="ok">Log ticked</button></div>');
  m2.addEventListener('click',function(ev){var sw=ev.target.closest('.sw');if(sw){sw.classList.toggle('on');return;}var b2=ev.target.closest('[data-s]');if(!b2)return;if(b2.dataset.s==='cancel'){m2.remove();return;}var n=0;m2.querySelectorAll('.sw.on').forEach(function(el){var x=list[+el.dataset.i];S.current.tx.push({id:uid(),src:'manual',at:Date.now(),amount:x.amt,note:x.name,bucket:x.bucket,card:x.card,date:todayISO()});n++;});m2.remove();if(n)save(n+' logged');});
  return;
 case 'exportFile':var blob=new Blob([backupText()],{type:'application/json'}),u=URL.createObjectURL(blob),ln=document.createElement('a');ln.href=u;ln.download='vault-backup-'+todayISO()+'.json';document.body.appendChild(ln);ln.click();ln.remove();setTimeout(function(){URL.revokeObjectURL(u);},2000);S.lastBackup=Date.now();save('Backup downloaded');return;
 case 'exportCopy':(navigator.clipboard?navigator.clipboard.writeText(backupText()):Promise.reject()).then(function(){S.lastBackup=Date.now();save('Backup copied. Paste it in Notes');},function(){toast('Copy blocked. Use Download');});return;
 case 'reset':if(a.dataset.sure){localStorage.removeItem(LS_KEY);S=blankState();firstRun=true;render();}else{a.dataset.sure='1';a.textContent='Tap again: this wipes everything';}return;
 }
});

/* ---------- start ---------- */
autoPost();
applyTheme();
if(window.matchMedia)matchMedia('(prefers-color-scheme: dark)').addEventListener&&matchMedia('(prefers-color-scheme: dark)').addEventListener('change',function(){if(S.settings.theme==='auto')render();});
render();
showLock();
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(function(){});
window.__vault={parseTotal:parseTotal,get S(){return S;}};
})();
