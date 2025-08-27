 // --- Utilities ---
    const qs = sel => document.querySelector(sel);
    const qsa = sel => Array.from(document.querySelectorAll(sel));

    // --- Data model ---
    let state = {tasks:[], notes:{}, selectedTaskId:null};
    const LS_KEY = 'smart-planner-v1';

    // --- Load/Save ---
    function load(){
      try{
        const raw = localStorage.getItem(LS_KEY);
        if(raw) state = JSON.parse(raw);
      }catch(e){console.error('load err',e)}
    }
    function save(){
      localStorage.setItem(LS_KEY, JSON.stringify(state));
      renderAll();
    }

    // --- Create ID ---
    function uid(prefix='id'){
      return prefix + '-' + Math.random().toString(36).slice(2,9);
    }

    // --- Task ops ---
    function addTask(data){
      const t = {id:uid('t'),title:data.title||'Untitled',topic:data.topic||'',priority:data.priority||'medium',due:data.due||null,category:data.category||'general',completed:false,created:Date.now()};
      state.tasks.push(t);
      if(!state.notes[t.id]) state.notes[t.id]=[];
      save();
      return t.id;
    }
    function updateTask(id,changes){
      const t = state.tasks.find(x=>x.id===id); if(!t) return;
      Object.assign(t,changes); save();
    }
    function removeTask(id){
      state.tasks = state.tasks.filter(x=>x.id!==id);
      delete state.notes[id];
      if(state.selectedTaskId===id) state.selectedTaskId=null;
      save();
    }

    // --- Notes ops ---
    function addNote(taskId,html){
      if(!state.notes[taskId]) state.notes[taskId]=[];
      const n = {id:uid('n'),html:html,created:Date.now()};
      state.notes[taskId].push(n); save();
    }
    function updateNote(taskId,noteId,html){
      const list = state.notes[taskId]||[]; const n = list.find(x=>x.id===noteId); if(n){n.html=html; save();}
    }
    function removeNote(taskId,noteId){
      state.notes[taskId] = (state.notes[taskId]||[]).filter(x=>x.id!==noteId); save();
    }

    // --- Rendering ---
    function renderAll(){
      renderSummary(); renderTaskList(); renderPreview(); renderFilters(); renderTimeline();
    }

    function formatDateISO(d){ if(!d) return '—'; const dt = new Date(d); return dt.toLocaleDateString(); }
    function daysLeft(d){ if(!d) return Infinity; const ms = new Date(d).setHours(23,59,59,999)-Date.now(); return Math.ceil(ms/86400000); }

    function renderSummary(){
      const tot = state.tasks.length;
      const comp = state.tasks.filter(t=>t.completed).length;
      const pend = tot-comp;
      const next = state.tasks.filter(t=>t.due && !t.completed).sort((a,b)=>new Date(a.due)-new Date(b.due))[0];
      qs('#countAll').textContent = tot;
      qs('#countCompleted').textContent = comp;
      qs('#countPending').textContent = pend;
      qs('#nextDue').textContent = next? (next.title + ' • '+formatDateISO(next.due)) : '—';
    }

    function renderTaskList(){
      const container = qs('#taskList'); container.innerHTML='';
      // apply filters & search
      const q = qs('#searchInput').value.trim().toLowerCase();
      const cat = qs('#filterCategory').value;
      const pr = qs('#filterPriority').value;
      const date = qs('#filterDate').value;

      let list = [...state.tasks];
      if(cat && cat!=='all') list = list.filter(t=>t.category===cat);
      if(pr && pr!=='all') list = list.filter(t=>t.priority===pr);
      if(date) list = list.filter(t=>t.due===date);
      if(q) list = list.filter(t=> (t.title+' '+t.topic+' '+(state.notes[t.id]||[]).map(n=>n.html).join(' ')).toLowerCase().includes(q));

      // sort: incomplete then by due
      list.sort((a,b)=>{ if(a.completed!==b.completed) return a.completed?1:-1; if(!a.due&&!b.due) return 0; if(!a.due) return 1; if(!b.due) return -1; return new Date(a.due)-new Date(b.due); });

      for(const t of list){
        const el = document.createElement('div'); el.className='task fade';
        const meta = document.createElement('div'); meta.className='meta';
        meta.innerHTML = `<div class="title">${escapeHtml(t.title)} ${t.completed?'<span class="small" style="color:#7ed0a8">(done)</span>':''}</div>
                          <div class="small muted">${escapeHtml(t.topic)} • ${formatDateISO(t.due)} • <span class="pill ${priorityClass(t.priority)}">${capitalize(t.priority)}</span></div>`;
        el.appendChild(meta);
        const acts = document.createElement('div'); acts.className='actions';
        const doneBtn = document.createElement('button'); doneBtn.className='icon-btn'; doneBtn.title='Toggle completed'; doneBtn.innerHTML='✔';
        doneBtn.onclick = ()=>{ updateTask(t.id,{completed:!t.completed}); };
        const editBtn = document.createElement('button'); editBtn.className='icon-btn'; editBtn.title='Edit'; editBtn.innerHTML='✎'; editBtn.onclick = ()=>openModal(t);
        const delBtn = document.createElement('button'); delBtn.className='icon-btn'; delBtn.title='Delete'; delBtn.innerHTML='🗑'; delBtn.onclick = ()=>{ if(confirm('Delete task?')) removeTask(t.id); };
        const selBtn = document.createElement('button'); selBtn.className='icon-btn'; selBtn.title='Select task'; selBtn.innerHTML='➡'; selBtn.onclick = ()=>{ state.selectedTaskId=t.id; renderAll(); };
        acts.append(doneBtn, editBtn, delBtn, selBtn);
        el.appendChild(acts);
        container.appendChild(el);
      }
      if(list.length===0) container.innerHTML='<div class="muted" style="padding:8px">No tasks match the filters.</div>';
    }

    function renderPreview(){
      const id = state.selectedTaskId; if(!id){ qs('#taskTitlePreview').textContent='Select a task or create one'; qs('#taskInfoPreview').textContent='—'; qs('#noteEditor').textContent='Click a task then write notes here...'; qs('#riskLabel').textContent='—'; return; }
      const t = state.tasks.find(x=>x.id===id);
      if(!t) return;
      qs('#taskTitlePreview').textContent = t.title;
      qs('#taskInfoPreview').textContent = `${t.topic} • ${formatDateISO(t.due)} • ${t.category} • ${capitalize(t.priority)}`;
      const risk = taskRisk(t); qs('#riskLabel').textContent = risk.label; qs('#riskLabel').style.color = risk.color;
      // load most recent note or placeholder
      const notes = state.notes[id]||[];
      if(notes.length) qs('#noteEditor').innerHTML = notes[notes.length-1].html; else qs('#noteEditor').innerHTML = '';
    }

    function renderFilters(){
      // categories
      const catSel = qs('#filterCategory'); const noteCat = qs('#noteCategory');
      const allCats = ['general',...Array.from(new Set(state.tasks.map(t=>t.category))).filter(Boolean)];
      catSel.innerHTML = '<option value="all">All categories</option>' + allCats.map(c=>`<option value="${c}">${capitalize(c)}</option>`).join('');
      noteCat.innerHTML = allCats.map(c=>`<option value="${c}">${capitalize(c)}</option>`).join('');
    }

    function renderTimeline(){
      const el = qs('#timeline'); el.innerHTML='';
      // show next 7 days
      const today = new Date(); for(let i=0;i<7;i++){
        const d = new Date(); d.setDate(today.getDate()+i);
        const iso = d.toISOString().slice(0,10);
        const dayBox = document.createElement('div'); dayBox.className='day';
        dayBox.innerHTML = `<div style="font-weight:700">${d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}</div>`;
        const tasksForDay = state.tasks.filter(t=>t.due===iso);
        for(const t of tasksForDay){
          const item = document.createElement('div'); item.style.marginTop='8px'; item.innerHTML = `<div style="font-weight:700">${escapeHtml(t.title)}</div><div class="small muted">${capitalize(t.priority)}${t.completed? ' • done':''}</div>`;
          dayBox.appendChild(item);
        }
        el.appendChild(dayBox);
      }
    }

    // --- small helpers ---
    function priorityClass(p){ if(p==='high') return 'priority-high'; if(p==='low') return 'priority-low'; return 'priority-mid'; }
    function capitalize(s){ if(!s) return ''; return s.charAt(0).toUpperCase()+s.slice(1); }
    function escapeHtml(t){ return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    // --- Modal ---
    const modal = qs('#modal'); const addBtn = qs('#addTaskBtn');
    addBtn.onclick = ()=>openModal(); qs('#cancelModal').onclick = ()=>closeModal();
    function openModal(task){
      modal.classList.add('show');
      if(task){ qs('#modalTitle').textContent='Edit Task'; qs('#taskTitle').value=task.title; qs('#taskTopic').value=task.topic; qs('#taskPriority').value=task.priority; qs('#taskDue').value=task.due || ''; qs('#taskCategory').value=task.category || ''; modal.dataset.editId = task.id; }
      else{ qs('#modalTitle').textContent='New Task'; qs('#taskTitle').value=''; qs('#taskTopic').value=''; qs('#taskPriority').value='medium'; qs('#taskDue').value=''; qs('#taskCategory').value=''; modal.dataset.editId = ''; }
    }
    function closeModal(){ modal.classList.remove('show'); }
    qs('#saveTaskBtn').onclick = ()=>{
      const id = modal.dataset.editId; const data = {title:qs('#taskTitle').value.trim(),topic:qs('#taskTopic').value.trim(),priority:qs('#taskPriority').value, due: qs('#taskDue').value || null, category:qs('#taskCategory').value.trim()||'general'};
      if(id){ updateTask(id,data);} else{ const nid = addTask(data); state.selectedTaskId=nid; }
      closeModal();
    }

    // open edit from task btn
    function openModalById(id){ const t = state.tasks.find(x=>x.id===id); if(t) openModal(t); }

    // --- notes toolbar ---
    qsa('.toolbar button').forEach(b=>b.addEventListener('click',()=>{
      const cmd = b.dataset.cmd;
      if(cmd==='createLink'){
        const url = prompt('Enter link (https://...)'); if(url) document.execCommand('createLink',false,url);
      } else if(cmd==='insertDate'){
        document.execCommand('insertHTML', false, new Date().toLocaleString());
      } else document.execCommand(cmd,false,null);
    }));

    // Save note
    qs('#saveNoteBtn').onclick = ()=>{
      const html = qs('#noteEditor').innerHTML.trim(); const taskId = state.selectedTaskId; if(!taskId){ alert('Select a task first'); return; }
      addNote(taskId,html); alert('Note saved'); renderAll();
    }
    qs('#deleteNoteBtn').onclick = ()=>{
      const taskId = state.selectedTaskId; if(!taskId){ alert('Select a task first'); return; }
      const notes = state.notes[taskId]||[]; if(!notes.length){ alert('No note to delete'); return; }
      if(confirm('Delete the latest note?')){ removeNote(taskId, notes[notes.length-1].id); }
    }

    // --- search and filters ---
    qs('#searchInput').addEventListener('input', ()=>renderTaskList());
    qs('#filterCategory').addEventListener('change', ()=>renderTaskList());
    qs('#filterPriority').addEventListener('change', ()=>renderTaskList());
    qs('#filterDate').addEventListener('change', ()=>renderTaskList());
    qs('#clearFilters').onclick = ()=>{ qs('#filterCategory').value='all'; qs('#filterPriority').value='all'; qs('#filterDate').value=''; renderTaskList(); };

    // --- export/import ---
    qs('#exportBtn').onclick = ()=>{
      const data = JSON.stringify(state, null, 2); const blob = new Blob([data],{type:'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='study-planner.json'; a.click(); URL.revokeObjectURL(url);
    }
    qs('#exportCSVBtn').onclick = ()=>{
      const rows = [['id','title','topic','priority','due','category','completed']]; state.tasks.forEach(t=>rows.push([t.id,escapeCsv(t.title),escapeCsv(t.topic),t.priority,t.due||'',t.category,t.completed]));
      const csv = rows.map(r=>r.join(',')).join('\n'); const blob=new Blob([csv],{type:'text/csv'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='study-planner.csv'; a.click(); URL.revokeObjectURL(url);
    }
    function escapeCsv(s){ if(s==null) return ''; return '"'+String(s).replace(/"/g,'""')+'"'; }

    qs('#importBtn').onclick = ()=>{ qs('#importFile').click(); };
    qs('#importFile').addEventListener('change', async (e)=>{
      const f = e.target.files[0]; if(!f) return; const txt = await f.text(); try{ const dat = JSON.parse(txt); if(dat.tasks) { if(confirm('Replace existing tasks with imported data? OK to replace')){ state = dat; save(); } } else alert('Invalid file'); }catch(err){alert('Could not import: '+err.message)}
    });

    // --- suggestions engine (simple) ---
    qs('#suggestBtn').onclick = ()=>{ const plan = suggestDailyPlan(); if(plan.length===0) return alert('No pending tasks'); const txt = plan.map((p,i)=>`${i+1}. ${p.title} (${p.hours}h) — due ${p.due||'—'}`).join('\n'); alert('Suggested plan:\n\n'+txt); }

    function suggestDailyPlan(){
      // heuristic: sort by (urgency score) = priority weight / days left
      const weights = {high:3, medium:2, low:1};
      const list = state.tasks.filter(t=>!t.completed);
      const scored = list.map(t=>{ const dl = daysLeft(t.due); const score = weights[t.priority]/Math.max(1,dl); return {...t,score,dl}; });
      scored.sort((a,b)=>b.score-a.score || a.dl-b.dl);
      // allocate hours per task depending on score
      let totalHours = 5; // suggest 5 hours/day baseline
      return scored.slice(0,8).map(t=>({title:t.title,due:t.due,hours:Math.max(1,Math.round( (t.score/ (scored.reduce((s,x)=>s+x.score,0)||1)) * totalHours )),priority:t.priority}));
    }

    // --- risk detection ---
    function taskRisk(t){
      const dl = daysLeft(t.due);
      if(t.completed) return {label:'Done',color:'#7ed0a8'};
      if(!t.due) return {label:'No due date',color:varColor('--muted')};
      if(dl<=0) return {label:'Overdue',color:'#ff7676'};
      if(dl<=2 && t.priority==='high') return {label:'High risk',color:'#ffb86b'};
      if(dl<=3) return {label:'At risk',color:'#ffd580'};
      return {label:'On track',color:'#6ee7b7'};
    }
    function varColor(name){ return getComputedStyle(document.documentElement).getPropertyValue(name)||'#9aa4b2'; }

    // --- helpers: events delegation for selecting task by clicking list ---
    document.addEventListener('click', e=>{
      if(e.target.closest('.task')){
        const idx = Array.from(qs('#taskList').children).indexOf(e.target.closest('.task'));
        const visibleList = getVisibleTasks(); const t = visibleList[idx]; if(t) { state.selectedTaskId=t.id; renderAll(); }
      }
    });
    function getVisibleTasks(){
      const q = qs('#searchInput').value.trim().toLowerCase();
      const cat = qs('#filterCategory').value; const pr = qs('#filterPriority').value; const date = qs('#filterDate').value;
      let list = [...state.tasks]; if(cat && cat!=='all') list = list.filter(t=>t.category===cat); if(pr && pr!=='all') list = list.filter(t=>t.priority===pr); if(date) list = list.filter(t=>t.due===date); if(q) list = list.filter(t=> (t.title+' '+t.topic+' '+(state.notes[t.id]||[]).map(n=>n.html).join(' ')).toLowerCase().includes(q));
      list.sort((a,b)=>{ if(a.completed!==b.completed) return a.completed?1:-1; if(!a.due&&!b.due) return 0; if(!a.due) return 1; if(!b.due) return -1; return new Date(a.due)-new Date(b.due); });
      return list;
    }

    // --- helper: escapeHtml earlier used, make safe for contentEditable insertion ---

    // --- init demo data (only if empty) ---
    function seedIfEmpty(){ if(state.tasks.length) return; addTask({title:'Math — Integration assignment',topic:'Calculus',priority:'high',due:isoNDays(2),category:'Math'}); addTask({title:'Read Chapter 4 — Database',topic:'DB',priority:'medium',due:isoNDays(4),category:'CS'}); addTask({title:'Write journalism piece',topic:'Interview',priority:'low',due:isoNDays(7),category:'Journalism'}); addNote(state.tasks[0].id,'<p>Focus on substitution method. Practice 3 problems.</p>'); }
    function isoNDays(n){ const d=new Date(); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }

    // --- CSV export/import and other niceties done. Initialize ---
    load(); seedIfEmpty(); renderAll();

    // helpers continued
    function escapeHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    // Dark mode toggle
const modeToggle = document.getElementById("mode-toggle");
const body = document.body;

// Load saved mode
if (localStorage.getItem("mode") === "dark") {
  body.classList.add("dark-mode");
  modeToggle.textContent = "☀️ Light Mode";
}

// Toggle event
modeToggle.addEventListener("click", () => {
  body.classList.toggle("dark-mode");

  if (body.classList.contains("dark-mode")) {
    modeToggle.textContent = "☀️ Light Mode";
    localStorage.setItem("mode", "dark");
  } else {
    modeToggle.textContent = "🌙 Dark Mode";
    localStorage.setItem("mode", "light");
  }
});
