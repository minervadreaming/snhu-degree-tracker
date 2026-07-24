const SOURCE_COLORS={SNHU:"#2466d1",Transfer:"#17846d",Certificate:"#d58a17",Sophia:"#7661c9"};
const SECTIONS=[
 {id:"gened",name:"General Education · The Commons",required:42,note:"14 courses · 42 credits",courses:[
  c("gen1","IDS 105","Cultural Awareness and Online Learning"),c("gen2","ENG 130","Foundations of Written Communication","English Composition I or Workplace Writing I"),c("gen3","ENG 190","Research and Persuasion","English Composition II or Workplace Writing II"),c("gen4","MAT 126","Mathematical Reasoning for Modern Problem-Solving"),
  c("gen5","EETH","Ethical Thought & Equity requirement","Introduction to Ethics may transfer as PHL 212"),c("gen6","ECCE","Creative & Critical Expression requirement"),c("gen7","EHPS","Historical Perspectives requirement","U.S. History I or II may apply"),c("gen8","ESMF","Scientific & Mathematical Fluencies","Environmental Science may apply"),c("gen9","ESPE","Social & Behavioral Perspectives","Introduction to Psychology may apply"),
  c("gen10","EXP","Exploration elective"),c("gen11","CSOJ / CSST","Social Justice or Sustainability"),c("gen12","CULM","Culmination course · 300/400 level"),c("gen13","GEN ED","General education requirement"),c("gen14","GEN ED","General education requirement")
 ]},
 {id:"core",name:"Business Core",required:30,note:"10 courses · 30 credits",courses:[
  c("core1","ACC 201","Financial Accounting","Financial Accounting"),c("core2","ACC 202","Managerial Accounting"),c("core3","BUS 206","Business Law I","Business Law"),c("core4","BUS 210","Managing and Leading in Business"),c("core5","BUS 225","Critical Business Skills for Success"),c("core6","BUS 400","Driving Business Opportunities"),c("core7","FIN 320","Principles of Finance","Principles of Finance"),c("core8","INT 220","Global Dimensions in Business"),c("core9","MKT 205","Applied Marketing Strategies"),c("core10","QSO 321","People, Planet, and Profit")
 ]},
 {id:"mis",name:"MIS Concentration",required:15,note:"5 courses · choose one course in each slot",courses:[
  c("mis1","DAD 220 / CIS 255","Database requirement"),c("mis2","CIS 315 / IT 315","Systems analysis & design requirement"),c("mis3","MIS 215 / CIS 335","Client systems & business applications"),c("mis4","MIS 350 / CIS 355","Business intelligence & reporting"),c("mis5","MIS 300 / CIS 410","Enterprise information systems")
 ]},
 {id:"free",name:"Free Electives",required:33,note:"11 typical 3-credit courses · broadest transfer flexibility",courses:Array.from({length:11},(_,i)=>c(`free${i+1}`,"ELECTIVE",`Free elective ${i+1}`,"Many Sophia courses transfer as electives"))}
];
function c(id,code,name,sophia=""){return{id,code,name,credits:3,sophia}}
const defaultState=()=>({courses:Object.fromEntries(SECTIONS.flatMap(s=>s.courses).map(x=>[x.id,{selected:false,status:"Planned",source:"SNHU",code:x.code,name:x.name,credits:x.credits,note:""}])),custom:[]});
let state=load();
function load(){try{return Object.assign(defaultState(),JSON.parse(localStorage.getItem("degreeCompass")||"{}"))}catch{return defaultState()}}
function save(){localStorage.setItem("degreeCompass",JSON.stringify(state))}
function allCourses(){return SECTIONS.flatMap(s=>s.courses.map(x=>({...x,section:s.id,custom:false}))).concat(state.custom.map(x=>({...x,custom:true})))}
function dataFor(course){return state.courses[course.id]||course}
function isEarned(d){return d.selected&&d.status==="Completed"}
function render(){
 const host=document.querySelector("#sections");host.innerHTML="";
 SECTIONS.forEach((section,idx)=>{
  const items=allCourses().filter(x=>x.section===section.id);const earned=items.reduce((n,x)=>n+(isEarned(dataFor(x))?+dataFor(x).credits:0),0);
  const wrap=document.createElement("section");wrap.className="degree-section";wrap.dataset.section=section.id;
  wrap.innerHTML=`<button class="section-toggle"><span class="section-num">0${idx+1}</span><span class="section-name"><strong>${section.name}</strong><small>${section.note}</small></span><span class="section-progress"><strong>${earned}/${section.required}</strong><small> credits</small></span><span class="chev">⌄</span></button><div class="course-list"></div>`;
  const list=wrap.querySelector(".course-list");items.forEach(x=>list.appendChild(courseRow(x)));
  list.insertAdjacentHTML("beforeend",`<div class="add-row"><button class="add-course">＋ Add a custom course</button></div>`);
  wrap.querySelector(".section-toggle").onclick=()=>wrap.classList.toggle("closed");
  wrap.querySelector(".add-course").onclick=()=>addCustom(section.id);
  host.appendChild(wrap);
 });
 applyFilter();updateMetrics();
}
function courseRow(course){
 const d=dataFor(course),row=document.createElement("div");row.className="course-row";row.dataset.id=course.id;
 const sophia=d.sophia||course.sophia||"",editable=course.section==="free"||course.custom;
 const courseName=editable
  ? `<div class="editable-course"><input class="course-code" type="text" aria-label="Course code" placeholder="Course code" value="${escapeHtml(d.code)}"><input class="course-title" type="text" aria-label="Course name" placeholder="Course name" value="${escapeHtml(d.name)}">${sophia?`<small class="sophia">Sophia: ${escapeHtml(sophia)}</small>`:""}${course.custom?`<button class="custom-delete" title="Remove course">×</button>`:""}</div>`
  : `<div class="course-name"><strong>${escapeHtml(d.code)} · ${escapeHtml(d.name)}</strong>${sophia?`<small class="sophia">Sophia: ${escapeHtml(sophia)}</small>`:""}</div>`;
 row.innerHTML=`
  <input class="pick" type="checkbox" aria-label="Select course" ${d.selected?"checked":""}>
  ${courseName}
  <div class="credits">${editable?`<input class="credit-value" type="number" min="0" max="12" step="1" aria-label="Credit value" value="${d.credits}"><small>credits</small>`:`${d.credits} cr`}</div>
  <select class="status" aria-label="Status">${["Planned","In progress","Completed"].map(v=>`<option ${d.status===v?"selected":""}>${v}</option>`).join("")}</select>
  <select class="source" aria-label="Credit source">${Object.keys(SOURCE_COLORS).map(v=>`<option ${d.source===v?"selected":""}>${v}</option>`).join("")}</select>
  <input class="note" type="text" placeholder="Transfer school, certificate, term…" value="${escapeHtml(d.note||"")}">`;
 if(d.status==="Completed")row.classList.add("status-complete");
 row.querySelector(".pick").onchange=e=>change(course,"selected",e.target.checked);
 row.querySelector(".status").onchange=e=>change(course,"status",e.target.value);
 row.querySelector(".source").onchange=e=>change(course,"source",e.target.value);
 row.querySelector(".note").onchange=e=>change(course,"note",e.target.value);
 row.querySelector(".course-code")?.addEventListener("change",e=>change(course,"code",e.target.value.trim()||"ELECTIVE"));
 row.querySelector(".course-title")?.addEventListener("change",e=>change(course,"name",e.target.value.trim()||"Free elective"));
 row.querySelector(".credit-value")?.addEventListener("change",e=>change(course,"credits",Math.max(0,Number(e.target.value)||0)));
 row.querySelector(".custom-delete")?.addEventListener("click",()=>{state.custom=state.custom.filter(x=>x.id!==course.id);delete state.courses[course.id];save();render()});
 return row;
}
function change(course,key,value){state.courses[course.id]??={...course};state.courses[course.id][key]=value;if(key==="status"&&value!=="Planned")state.courses[course.id].selected=true;save();render()}
function addCustom(section){const id=`custom-${Date.now()}`;const code=prompt("Course code (or requirement label):","ELECTIVE");if(code===null)return;const name=prompt("Course name:","Custom course")||"Custom course";const credits=Math.max(0,Number(prompt("Credit value:","3"))||3);const x={id,section,code,name,credits,sophia:"",selected:true,status:"Planned",source:"Transfer",note:""};state.custom.push(x);state.courses[id]={...x};save();render()}
function updateMetrics(){
 const items=allCourses().map(dataFor),selected=items.filter(x=>x.selected),complete=items.filter(isEarned),earned=complete.reduce((n,x)=>n+(+x.credits||0),0);
 const totals=Object.fromEntries(Object.keys(SOURCE_COLORS).map(src=>[src,complete.filter(x=>x.source===src).reduce((n,x)=>n+(+x.credits||0),0)]));
 const outside=totals.Transfer+totals.Certificate+totals.Sophia;
 q("#earnedBig").textContent=q("#earnedMetric").textContent=earned;q("#remainingMetric").textContent=`${Math.max(0,120-earned)} remaining`;q("#snhuMetric").textContent=totals.SNHU;q("#outsideMetric").textContent=outside;q("#coursesMetric").textContent=complete.length;q("#coursesSelected").textContent=`${selected.length} selected`;q("#ring").style.setProperty("--p",Math.min(100,earned/1.2));q("#degreeMessage").textContent=earned>=120&&totals.SNHU>=30?"Degree credit targets reached!":earned?`${Math.max(0,120-earned)} credits remain on your route.`:"Start shaping your path below.";
 q("#sourceBars").innerHTML=Object.entries(totals).map(([src,n])=>`<div class="source-bar"><header><span>${src}</span><strong>${n} cr</strong></header><div class="track"><div class="fill" style="--c:${SOURCE_COLORS[src]};width:${Math.min(100,n/1.2)}%"></div></div></div>`).join("");
 const alerts=[];if(outside>90)alerts.push(`Outside credit is ${outside} — ${outside-90} credits above SNHU’s 90-credit transfer ceiling.`);if(earned>=120&&totals.SNHU<30)alerts.push(`You still need ${30-totals.SNHU} more completed SNHU credits to meet the residency minimum.`);if(!alerts.length&&earned>=120&&totals.SNHU>=30)alerts.push("Your plan meets the 120-credit total and 30-credit SNHU minimum.");
 q("#alerts").innerHTML=alerts.map(x=>`<div class="alert ${earned>=120&&totals.SNHU>=30?"ok":""}">${x}</div>`).join("");
}
function applyFilter(){const f=q("#filter").value;document.querySelectorAll(".course-row").forEach(row=>{const course=allCourses().find(x=>x.id===row.dataset.id),d=dataFor(course);row.classList.toggle("hidden",f==="selected"&&!d.selected||f==="complete"&&!isEarned(d)||f==="sophia"&&!(d.sophia||course.sophia))})}
function download(name,text,type){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href)}
function csv(){const rows=[["Section","Code","Course","Credits","Selected","Status","Source","Sophia equivalent","Notes"]];allCourses().forEach(x=>{const d=dataFor(x),s=SECTIONS.find(y=>y.id===x.section);rows.push([s?.name||x.section,d.code,d.name,d.credits,d.selected?"Yes":"No",d.status,d.source,d.sophia||x.sophia||"",d.note||""])});return rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\r\n")}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}function q(s){return document.querySelector(s)}
q("#filter").onchange=applyFilter;q("#expandBtn").onclick=e=>{const closing=!document.querySelector(".degree-section.closed");document.querySelectorAll(".degree-section").forEach(x=>x.classList.toggle("closed",closing));e.target.textContent=closing?"Expand all":"Collapse all"};
q("#exportBtn").onclick=()=>q("#exportDialog").showModal();q("#jsonBtn").onclick=()=>download("snhu-mis-degree-plan.json",JSON.stringify(state,null,2),"application/json");q("#csvBtn").onclick=()=>download("snhu-mis-degree-plan.csv",csv(),"text/csv");
q("#importInput").onchange=async e=>{try{state=JSON.parse(await e.target.files[0].text());save();render();q("#exportDialog").close()}catch{alert("That backup file could not be read.")}};
q("#resetBtn").onclick=()=>{if(confirm("Reset every course, source, status and note? This cannot be undone unless you exported a backup.")){state=defaultState();save();render()}};
render();
