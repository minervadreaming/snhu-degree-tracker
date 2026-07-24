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
function credits(items){return items.reduce((n,x)=>n+(+x.credits||0),0)}
function render(){
 const host=document.querySelector("#sections");host.innerHTML="";
 SECTIONS.forEach((section,idx)=>{
  const items=allCourses().filter(x=>x.section===section.id),itemData=items.map(dataFor),planned=credits(itemData.filter(x=>x.selected)),earned=credits(itemData.filter(isEarned));
  const wrap=document.createElement("section");wrap.className="degree-section";wrap.dataset.section=section.id;
  wrap.innerHTML=`<button class="section-toggle"><span class="section-num">0${idx+1}</span><span class="section-name"><strong>${section.name}</strong><small>${section.note}</small></span><span class="section-progress"><strong>${planned}/${section.required}</strong><small>${earned} earned${planned>section.required?` · ${planned-section.required} over`:""}</small></span><span class="chev">⌄</span></button><div class="course-list"></div>`;
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
 const items=allCourses().map(dataFor),selected=items.filter(x=>x.selected),complete=items.filter(isEarned),planned=credits(selected),earned=credits(complete);
 const totals=Object.fromEntries(Object.keys(SOURCE_COLORS).map(src=>[src,{planned:credits(selected.filter(x=>x.source===src)),earned:credits(complete.filter(x=>x.source===src))}]));
 const outsidePlanned=totals.Transfer.planned+totals.Certificate.planned+totals.Sophia.planned;
 const outsideEarned=totals.Transfer.earned+totals.Certificate.earned+totals.Sophia.earned;
 const sectionStats=SECTIONS.map(section=>{const sectionItems=allCourses().filter(x=>x.section===section.id).map(dataFor);return{...section,planned:credits(sectionItems.filter(x=>x.selected)),earned:credits(sectionItems.filter(isEarned))}});
 const sectionsPlanned=sectionStats.every(x=>x.planned>=x.required),sectionsEarned=sectionStats.every(x=>x.earned>=x.required);
 const planValid=planned===120&&sectionsPlanned&&totals.SNHU.planned>=30&&outsidePlanned<=90;
 const degreeComplete=earned>=120&&sectionsEarned&&totals.SNHU.earned>=30&&outsideEarned<=90;
 q("#plannedBig").textContent=q("#plannedMetric").textContent=planned;q("#earnedBig").textContent=`${earned} earned`;q("#earnedMetric").textContent=earned;
 q("#remainingMetric").textContent=planned<120?`${120-planned} still to plan`:planned===120?"120-credit plan filled":`${planned-120} above degree total`;
 q("#unearnedMetric").textContent=`${Math.max(0,planned-earned)} planned, not yet earned`;
 q("#snhuMetric").textContent=totals.SNHU.planned;q("#snhuDetail").textContent=`${totals.SNHU.earned} earned · 30 minimum`;
 q("#outsideMetric").textContent=outsidePlanned;q("#outsideDetail").textContent=`${outsideEarned} earned · 90 maximum`;
 q("#courseCounts").textContent=`${selected.length} courses selected · ${complete.length} completed`;
 q("#ring").style.setProperty("--p",Math.min(100,planned/1.2));
 q("#degreeMessage").textContent=degreeComplete?"Degree credit targets reached!":planValid?`Your 120-credit degree path is fully planned.`:planned?`${Math.max(0,120-planned)} credits remain to be planned.`:"Start shaping your path below.";
 q("#sourceBars").innerHTML=Object.entries(totals).map(([src,n])=>`<div class="source-bar"><header><span>${src}</span><strong>${n.planned} planned</strong></header><small>${n.earned} earned</small><div class="track"><div class="plan-fill" style="--c:${SOURCE_COLORS[src]};width:${Math.min(100,n.planned/1.2)}%"><div class="earned-fill" style="width:${n.planned?Math.min(100,n.earned/n.planned*100):0}%"></div></div></div></div>`).join("");
 const alerts=[];
 if(planned>120)alerts.push(`Your plan contains ${planned} credits — ${planned-120} above the 120-credit degree total.`);
 sectionStats.filter(x=>x.planned>x.required).forEach(x=>alerts.push(`${x.name} is planned at ${x.planned} credits, ${x.planned-x.required} above its ${x.required}-credit requirement.`));
 if(outsidePlanned>90)alerts.push(`Your plan has ${outsidePlanned} outside-SNHU credits — ${outsidePlanned-90} above the 90-credit transfer ceiling.`);
 if(totals.SNHU.planned<30)alerts.push(`Plan at least ${30-totals.SNHU.planned} more credits at SNHU to reach the 30-credit residency minimum.`);
 if(planned>=120&&!sectionsPlanned)alerts.push("The total reaches 120, but one or more curriculum sections still need planned credits.");
 if(!alerts.length&&planValid)alerts.push("Your selected courses form a valid 120-credit plan with the required SNHU residency.");
 q("#alerts").innerHTML=alerts.map(x=>`<div class="alert ${planValid&&!x.includes("above")&&!x.includes("need")?"ok":""}">${x}</div>`).join("");
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
