// script.js (Final v3.1 - RealName + Banter Edition)

// ============ CONFIG ============
const SUPABASE_URL = "https://dxdgokgdjglycvckoudc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4ZGdva2dkamdseWN2Y2tvdWRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NDI2MzIsImV4cCI6MjA3ODQxODYzMn0.HQKjJ7UH71LqSquzMpgJRgFaK3K413i2WPbgikDCbhQ";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const ADMIN_EMAIL = 'teerapong6383@gmail.com';

const TEAMS = [
  "Blending & Intake", "Remix", "Intake & Remix",
  "Blending A", "Blending B", "Blending C", "Blending Cleaning"
];
const pad2 = n => n < 10 ? '0' + n : '' + n;
const thaiMonthName = m => ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"][m];

// ============ UI REFS ============
const monthLabel = document.getElementById('monthLabel');
const calGrid = document.getElementById('calGrid');
const dayTitle = document.getElementById('dayTitle');
const leaveList = document.getElementById('leaveList');
const fabAdd = document.getElementById('fabAdd');
const leaveModal = document.getElementById('leaveModal');
const closeLeaveModal = document.getElementById('closeLeaveModal');
const leaveForm = document.getElementById('leaveForm');
const leaveDate = document.getElementById('leaveDate');
const teamSelect = document.getElementById('teamSelect');
const empSelect = document.getElementById('empSelect');
const shiftSelect = document.getElementById('shiftSelect');
const typeSelect = document.getElementById('typeSelect');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const modalMsg = document.getElementById('modalMsg');
const totalMonthEl = document.getElementById('totalMonth');
const topTeamEl = document.getElementById('topTeam');
const topTypeEl = document.getElementById('topType');
const monthPicker = document.getElementById('monthPicker');
const leaderMonth = document.getElementById('leaderMonth');
const leaderboardContent = document.getElementById('leaderboardContent');

let viewYear, viewMonth;
let monthLeavesIndex = {};
let cachedEmployees = [];
let chart = null;
let currentUser = null;

// ============ SCORE + BANTER ============
const SCORE_MAP = { 'ลากิจ':1.5, 'ลาป่วย':2, 'ลาพักร้อน':1, 'อื่นๆ':0.5 };
const BANTER = {
  'ลากิจ': ["นักลามืออาชีพ","หลาน CEO","ภารกิจลับ"],
  'ลาป่วย': ["คนป่วยแห่งปี","สุขภาพไม่เข้าข้างบริษัท","แชมป์พาราเซตามอล","แชมป์ใบรับรองแพทย์","ภูมิแพ้วันจันทร์"],
  'ลาพักร้อน': ["ท่องเที่ยวคือชีวิต","ทริปแรงแซง KPI","ผู้บริโภควันลา"],
  'อื่นๆ': ["ไม่เมาก็แฮงค์ ทรงนี้"]
};

// ============ AUTH ============
loginBtn.addEventListener('click', async ()=>{
  try { await sb.auth.signInWithOAuth({ provider: 'google' }); }
  catch(e){ alert('Login failed: '+(e.message||e.error_description||e)); }
});
logoutBtn.addEventListener('click', async ()=>{
  await sb.auth.signOut();
  location.reload();
});
sb.auth.onAuthStateChange((event, session)=>{
  currentUser = session?.user ?? null;
  loginBtn.style.display = currentUser ? 'none':'inline-block';
  logoutBtn.style.display = currentUser ? 'inline-block':'none';
});

// ============ EMPLOYEES ============
async function fetchEmployees(){
  try {
    const { data, error } = await sb.from('employees').select('*').order('nameth',{ascending:true});
    if(error) throw error;
    cachedEmployees = data || [];
  } catch(err){
    console.warn('fetchEmployees error', err);
    cachedEmployees = [];
  } finally {
    renderTeamOptions();
    renderEmpOptions();
  }
}
function renderTeamOptions(){
  teamSelect.innerHTML = TEAMS.map(t=>`<option value="${t}">${t}</option>`).join('');
}
function renderEmpOptions(){
  const selTeam = (teamSelect.value||'').trim().toLowerCase();
  const list = cachedEmployees.filter(e => (''+(e.team||'')).trim().toLowerCase() === selTeam);
  if(list.length===0){
    empSelect.innerHTML = `<option value="">(ไม่พบพนักงาน)</option>`;
  } else {
    empSelect.innerHTML = list.map(e=>`<option value="${e.id}">${e.nameth}</option>`).join('');
  }
}
teamSelect.addEventListener('change', renderEmpOptions);

// ============ CALENDAR ============
function monthKey(y,m){ return `${y}-${pad2(m+1)}`; }
async function loadMonth(y,m){
  viewYear=y; viewMonth=m;
  const start=`${y}-${pad2(m+1)}-01`;
  const end=`${y}-${pad2(m+1)}-${new Date(y,m+1,0).getDate()}`;
  try{
    const {data,error}=await sb.from('leaves').select('*').gte('date',start).lte('date',end);
    if(error) throw error;
    populateMonth(data||[]);
  }catch(err){console.error(err);populateMonth([]);}
}
function populateMonth(rows){
  monthLeavesIndex={};
  (rows||[]).forEach(r=>{
    if(!monthLeavesIndex[r.date]) monthLeavesIndex[r.date]=[];
    monthLeavesIndex[r.date].push(r);
  });
  buildCalendar(viewYear,viewMonth);
  updateSummary();
  renderLeaderboardFor(viewYear,viewMonth);
}
function buildCalendar(y,m){
  monthLabel.textContent=`${thaiMonthName(m)} ${y}`;
  calGrid.innerHTML='';
  const first=new Date(y,m,1);
  const startDow=first.getDay();
  const lastDate=new Date(y,m+1,0).getDate();
  for(let i=0;i<startDow;i++) calGrid.appendChild(Object.assign(document.createElement('div'),{className:'daycell inactive'}));
  for(let d=1;d<=lastDate;d++){
    const dateStr=`${y}-${pad2(m+1)}-${pad2(d)}`;
    const el=document.createElement('div');
    el.className='daycell';
    el.innerHTML=`<div class="date-num">${d}</div>`;
    if(monthLeavesIndex[dateStr]?.length>0){
      el.classList.add('leave');
      el.innerHTML+=`<div class="marker">ลา ${monthLeavesIndex[dateStr].length}</div>`;
    }
    el.addEventListener('click',()=>onPickDate(dateStr));
    calGrid.appendChild(el);
  }
}
function highlightSelected(dateStr){
  [...calGrid.querySelectorAll('.daycell')].forEach(c=>c.classList.remove('selected'));
  const dayNum=parseInt(dateStr.slice(-2),10);
  const el=[...calGrid.querySelectorAll('.daycell')].find(x=>parseInt(x.textContent,10)===dayNum);
  if(el) el.classList.add('selected');
}
function onPickDate(dateStr){
  highlightSelected(dateStr);
  renderDayPanel(dateStr);
}
function renderDayPanel(dateStr){
  dayTitle.textContent=`รายละเอียด: ${dateStr}`;
  const arr=monthLeavesIndex[dateStr]||[];
  if(arr.length===0){ leaveList.innerHTML=`<div class="leave-card">ไม่มีคนลาวันนี้</div>`; return; }
  leaveList.innerHTML=arr.map(l=>{
    const emp=cachedEmployees.find(e=>e.id===l.employeeID);
    const name=emp?emp.nameth:(l.employeeName||'ไม่ระบุ');
    return `<div class="leave-card"><div><strong>${name}</strong></div><div class="meta">${l.type||'-'} • ${l.shift||'-'}</div></div>`;
  }).join('');
}

// ============ SUMMARY ============
function updateSummary(){
  const all=Object.values(monthLeavesIndex).flat();
  totalMonthEl.textContent=all.length;
  const teamCounts={},typeCounts={};
  all.forEach(x=>{teamCounts[x.team]=(teamCounts[x.team]||0)+1;typeCounts[x.type]=(typeCounts[x.type]||0)+1;});
  topTeamEl.textContent=Object.entries(teamCounts).sort((a,b)=>b[1]-a[1])[0]?.[0]||'-';
  topTypeEl.textContent=Object.entries(typeCounts).sort((a,b)=>b[1]-a[1])[0]?.[0]||'-';
  const ctx=document.getElementById('summaryChart').getContext('2d');
  if(chart) chart.destroy();
  chart=new Chart(ctx,{type:'doughnut',data:{labels:Object.keys(typeCounts),datasets:[{data:Object.values(typeCounts),backgroundColor:['#0a2740','#1c4e80','#4e8bd6','#f59e0b','#ef4444']}]},options:{plugins:{legend:{position:'bottom'}},maintainAspectRatio:false}});
}

// ============ LEADERBOARD ============
function computeLeaderboardFor(rows){
  const agg={};
  (rows||[]).forEach(r=>{
    const id=r.employeeID||(r.employeeName||'ไม่ระบุ');
    if(!agg[id]) agg[id]={id,name:r.employeeName||'ไม่ระบุ',count:0,score:0,typeCounts:{}};
    agg[id].count++; const pts=SCORE_MAP[r.type]||0;
    agg[id].score+=pts; agg[id].typeCounts[r.type]=(agg[id].typeCounts[r.type]||0)+1;
  });
  Object.keys(agg).forEach(k=>{
    const emp=cachedEmployees.find(e=>e.id===k);
    if(emp) agg[k].name=emp.nameth;
  });
  return Object.values(agg).sort((a,b)=>b.score-a.score);
}
function pickBanter(item){
  const maxType=Object.keys(item.typeCounts).sort((a,b)=>item.typeCounts[b]-item.typeCounts[a])[0]||'อื่นๆ';
  const pool=BANTER[maxType]||BANTER['อื่นๆ'];
  return pool[Math.floor(Math.random()*pool.length)];
}
function renderLeaderboardFor(y,m){
  const mk=`${y}-${pad2(m+1)}`;
  const rows=Object.entries(monthLeavesIndex).filter(([d])=>d.startsWith(mk)).flatMap(([,arr])=>arr);
  const agg=computeLeaderboardFor(rows);
  if(!agg.length){ leaderboardContent.innerHTML=`<div class="lb-row">ยังไม่มีข้อมูล</div>`; return; }
  leaderboardContent.innerHTML=agg.slice(0,3).map((p,i)=>`
    <div class="lb-row">
      <div class="lb-left">
        <div class="lb-rank">#${i+1}</div>
        <div><div class="lb-nick">${p.name}</div><div class="meta">${p.count} ครั้ง • ${p.score} คะแนน</div></div>
      </div>
      <div class="lb-score">${pickBanter(p)}</div>
    </div>`).join('');
}

// ============ MODAL ============
fabAdd.addEventListener('click',()=>{
  leaveModal.style.display='flex'; leaveForm.reset();
  leaveDate.value=new Date().toISOString().slice(0,10);
  renderTeamOptions(); renderEmpOptions();
});
closeLeaveModal.addEventListener('click',()=>leaveModal.style.display='none');
leaveForm.addEventListener('submit',async e=>{
  e.preventDefault();
  const date=leaveDate.value, team=teamSelect.value, empId=empSelect.value, shift=shiftSelect.value, type=typeSelect.value;
  const emp=cachedEmployees.find(x=>x.id===empId);
  const employeeName=emp?emp.nameth:'ไม่ระบุ';
  const payload={employeeID:empId,employeeName,team,shift,type,date,monthKey:date.slice(0,7),createdAt:new Date().toISOString()};
  try{
    const {error}=await sb.from('leaves').insert([payload]);
    if(error) throw error;
    await loadMonth(viewYear,viewMonth);
    leaveModal.style.display='none';
  }catch(err){modalMsg.textContent='❌ บันทึกไม่สำเร็จ: '+(err.message||err);}
});

// ============ NAVIGATION ============
document.getElementById('prevMonth').addEventListener('click',async()=>{const d=new Date(viewYear,viewMonth-1,1);await loadMonth(d.getFullYear(),d.getMonth());});
document.getElementById('nextMonth').addEventListener('click',async()=>{const d=new Date(viewYear,viewMonth+1,1);await loadMonth(d.getFullYear(),d.getMonth());});
monthPicker.addEventListener('change',async()=>{const [y,mm]=monthPicker.value.split('-').map(Number);await loadMonth(y,mm-1);});
leaderMonth.addEventListener('change',()=>{const [y,mm]=leaderMonth.value.split('-').map(Number);renderLeaderboardFor(y,mm-1);});

// ============ BOOT ============
(async function(){
  await fetchEmployees();
  const now=new Date(); viewYear=now.getFullYear(); viewMonth=now.getMonth();
  monthPicker.value=`${viewYear}-${pad2(viewMonth+1)}`;
  leaderMonth.value=monthPicker.value;
  await loadMonth(viewYear,viewMonth);
  const todayStr=`${viewYear}-${pad2(viewMonth+1)}-${pad2(now.getDate())}`;
  renderDayPanel(todayStr); highlightSelected(todayStr);
  navigator.serviceWorker.register('./sw.js');

})();

