const SECTIONS = [
  {key:'tasks', label:'Daily tasks', sub:'Daily & weekly checklists, proof, and completion tracking.'},
  {key:'po', label:'Purchase orders', sub:'Order merchandise and supplies, tracked end to end.'},
  {key:'pettycash', label:'Petty cash', sub:'Reimbursements for staff, tracked end to end.'},
  {key:'potracker', label:'PO tracker', sub:'PO, check payment, and delivery receipt matched automatically.'},
  {key:'sales', label:'Sales Dashboard', sub:'Revenue reports, targets, and admin performance.'},
  {key:'membership', label:'Membership tracker', sub:'Active, expiring, and expired memberships.'},
];

let state = {
  currentUser: null,
  staff: [],
  products: [],
  section: 'tasks',
  modal: null,
  loaded: {requests:false, tasks:false, sales:false, members:false, staff:false, products:false},
  requests: [],
  tasks: [],
  sales: [],
  members: [],
  search: '',
  taskFilterDate: todayStr(),
  taskFilterAssignee: 'All',
  salesMonth: monthStr(new Date()),
  memberFilter: 'All',
  trackerType: 'All',
  reqStatusFilter: null,
  reqRequestor: null,
  reqDateFrom: {PO:'', PettyCash:''},
  reqDateTo: {PO:'', PettyCash:''},
  trackerFrom: '', trackerTo: '',
  payFrom: '', payTo: '',
  salesTab: 'overview',
  salesBranch: 'All',
  salesPeriod: 'month',
  reportWhich: 'category',
  reportBranch: 'All',
  reportPeriod: 'month',
  reportMonth: null,
  salesArea: 'core',
  merchYear: null,
  merchBranch: 'All',
  targets: [],
  posPreview: null,
  trackerView: 'tracker',
  payFilter: 'All',
  tasksTab: null,
  checklistDate: null,
  checklistStaff: null,
  checklist: null,
  checklistFilter: 'All',
  checkSummary: null,
  templates: null,
  promptedUnfinished: false,
  dueInfo: null,
  teamEscalation: null,
  loginError: null,
  dueBannerDismissed: false,
  _dueTimer: null,
};

function curUser(){ return state.currentUser; }
function curName(){ return state.currentUser ? state.currentUser.name : 'Unknown'; }
function curRole(){ return state.currentUser ? state.currentUser.role : null; }
function accessTier(role){ return (role==='Supervisor' || role==='Owner') ? 'SuperAdmin' : role; }

// Sales Dashboard access:
//  'full'   — Super Admins: all tabs, upload, and editing.
//  'viewer' — Super Admins listed below (e.g. Ela): all tabs but view/filter/sort only.
//  'admin'  — Admins: only the "Sales by Admin" tab, view only.
//  'none'   — no access.
const SALES_VIEW_ONLY = ['ela'];
function salesRole(){
  const tier = accessTier(curRole());
  if(tier==='SuperAdmin'){
    const u = state.currentUser||{};
    const un = (u.username||u.name||'').trim().toLowerCase();
    return SALES_VIEW_ONLY.includes(un) ? 'viewer' : 'full';
  }
  if(tier==='Admin') return 'admin';
  return 'none';
}
function canEditSales(){ return salesRole()==='full'; }

function todayStr(){ return new Date().toISOString().slice(0,10); }
function monthStr(d){ return d.toISOString().slice(0,7); }
function uid(){ return Math.random().toString(36).slice(2,9); }
function escapeHtml(s){ const d=document.createElement('div'); d.textContent = s==null?'':String(s); return d.innerHTML; }
function fmtMoney(n){ return 'PHP ' + Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtDate(iso){ if(!iso) return ''; const d=new Date(iso); return d.toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}); }
function fmtDateTime(iso){ if(!iso) return ''; const d=new Date(iso); return fmtDate(iso) + ' ' + d.toLocaleTimeString('en-PH',{hour:'numeric',minute:'2-digit'}); }
function daysBetween(a,b){ return Math.round((new Date(b) - new Date(a)) / 86400000); }

const STAGES = [
  {key:'Pending Approval'}, {key:'Approved'}, {key:'Check Prepared'},
  {key:'Check Received by Supervisor'}, {key:'Handed to Admin'}, {key:'Delivered'}, {key:'Recorded in POS'},
];
const STAGE_LABELS = {
  PO: ['Requested','Approved','Check ready','Check received','Handed over','Delivered','In POS'],
  PettyCash: ['Requested','Approved','Payment ready','Payment received','Handed to staff','Reimbursed','In POS'],
};
function stageIndex(status){ if(status==='Rejected') return -1; return STAGES.findIndex(s=>s.key===status); }
function stageShort(type, i){ return (STAGE_LABELS[type]||STAGE_LABELS.PO)[i]; }

const BRANCHES = [
  {code:'Manila', prefix:'MNL', label:'Roshan Gym Manila (Tondo)'},
  {code:'Malabon', prefix:'MBN', label:'Roshan Gym Malabon'},
];
const PAYMENT_METHODS = ['Check','Bank transfer','Cash','GCash'];

const SUPPLIERS = [
  {key:'jdl', name:'JDL Soya Food Products', contact:'John David Lee', phone:'09178105248', payTo:'JDL Soya Food Products', items:'Sting / Gatorade / Vitamilk (JDL) / Summit Water'},
  {key:'brewmaster_mnl', name:'Brew Master International inc.', contact:'Jarden', phone:'09988455383', payTo:'Brew Master International inc.', items:'Vitamilk / Cobra / Greek Yogurt (Manila)'},
  {key:'brewmaster_mbn', name:'Brew Master International inc. (MBN)', contact:'Niel Galang', phone:'', payTo:'Loraine Mesina', items:'Vitamilk / Cobra / Greek Yogurt (Malabon)'},
  {key:'otsuka_mnl', name:'Otsuka-Solar (Manila)', contact:'Rodel Parina', phone:'09171652086', payTo:'Otsuka-Solar Philippines Inc', items:'Pocari Sweat (Manila)'},
  {key:'otsuka_mbn', name:'Otsuka-Solar (Malabon)', contact:'Jaylord Quijano', phone:'', payTo:'Otsuka-Solar Philippines Inc', items:'Pocari Sweat (Malabon)'},
  {key:'leminerale', name:'Le Minerale (Manila)', contact:'Arnold', phone:'09623469737', payTo:'Larry Teves Ferreras', items:'Le Minerale'},
  {key:'shawnlourd', name:'Shawn & Lourd Food & Beverages Station', contact:'Reysie Peñaranda', phone:'09053393509', payTo:'Aldrin Thompson', items:'Nature Spring Water (Malabon)'},
  {key:'mandy', name:'Mandy Esmeria', contact:'Mandy', phone:'09923869016', payTo:'Epree Ken Villanueva', items:'Membership T-shirt / Eco Bags'},
  {key:'juanwhey', name:'Juanwhey Supplements', contact:'Rochelle Agdan', phone:'09668661382', payTo:'Juanwhey Suplement Consumer Goods Trading', items:'Supplements'},
  {key:'gears', name:'Gears Management System', contact:'Bryan Giray', phone:'', payTo:'Bryan Giray', items:'Key fob'},
];

function branchPrefix(code){ const b = BRANCHES.find(x=>x.code===code); return b ? b.prefix : 'PO'; }
function productsForSupplierKey(key){
  if(!key) return state.products;
  return state.products.filter(p=> !p.supplierKeys || p.supplierKeys.length===0 || p.supplierKeys.includes(key));
}

// ---------- API HELPERS ----------
// The browser only ever talks to our own /api/* routes — never to Supabase
// directly. The service role key lives only on the server (see lib/supabase.js).
async function apiGet(path){
  const res = await fetch(path);
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}
async function apiPost(path, body){
  const res = await fetch(path, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body||{})});
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}
async function apiDelete(path){
  const res = await fetch(path, {method:'DELETE'});
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}
async function apiPut(path, body){
  const res = await fetch(path, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body||{})});
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}
async function apiPatch(path, body){
  const res = await fetch(path, {method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body||{})});
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}
async function apiUpload(path, file, label){
  const fd = new FormData();
  fd.append('file', file);
  fd.append('label', label);
  const res = await fetch(path, {method:'POST', body:fd});
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

// ---------- SERVER <-> CLIENT FIELD MAPPING ----------
// The database uses snake_case and a few different names; the render code
// below was written against these camelCase shapes, so we translate once
// here rather than touching every render function.
function mapRequest(r){
  return {
    id:r.id, type:r.type, title:r.title, payee:r.payee, amount:Number(r.amount||0), notes:r.notes||'',
    branch:r.branch, supplier:r.supplier, paymentMethod:r.payment_method, requestor:r.requestor,
    lineItems:r.line_items||[], status:r.status, createdBy:r.created_by, createdAt:r.created_at,
    approval:r.approval||{}, check:r.check_info||{}, receipt:r.receipt||{}, handover:r.handover||{},
    delivery:r.delivery||{}, pos:r.pos||{}, history:r.history||[],
    deletedAt:r.deleted_at||null, deletedBy:r.deleted_by||null,
    reconciledAt:r.reconciled_at||null, reconciledBy:r.reconciled_by||null,
    attachments:(r.attachments||[]).map(a=>({id:a.id, name:a.name, mime:a.mime, label:a.label, uploadedBy:a.uploaded_by, uploadedAt:a.uploaded_at})),
  };
}
function mapTask(t){ return {id:t.id, title:t.title, assignee:t.assignee, date:t.date, dueDate:t.due_date||null, notes:t.notes, status:t.status, createdBy:t.created_by, createdAt:t.created_at, completedBy:t.completed_by, completedAt:t.completed_at}; }
function mapSale(s){ return {id:s.id, date:normDate(s.date), category:s.category, description:s.description, amount:Number(s.amount||0), method:s.method, enteredBy:s.entered_by, createdAt:s.created_at, branch:s.branch||'', availment:s.availment||'', discipline:s.discipline||'', saleKind:s.sale_kind||'', item:s.item||'', qty:Number(s.qty||1), importBatch:s.import_batch||null, source:s.source||'manual'}; }
// Coerce any date representation (ISO timestamp, Date, "YYYY-MM-DD") to "YYYY-MM-DD".
function normDate(d){
  if(!d) return '';
  if(typeof d==='string') return d.slice(0,10);
  try{ return new Date(d).toISOString().slice(0,10); }catch(e){ return String(d).slice(0,10); }
}
// Build a From/To date-range control. onChange(from,to) fires on any change.
// getFrom/getTo return the current stored values.
function dateRangeControl(getFrom, getTo, onChange){
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:inline-flex;align-items:center;gap:6px;';
  const from = document.createElement('input'); from.type='date'; from.value=getFrom()||''; from.title='From date';
  const to = document.createElement('input'); to.type='date'; to.value=getTo()||''; to.title='To date';
  const dash = document.createElement('span'); dash.textContent='→'; dash.style.color='var(--ink-2)';
  const clear = document.createElement('button'); clear.className='btn sm ghost'; clear.textContent='Clear'; clear.title='Clear date range';
  clear.style.display = (getFrom()||getTo()) ? '' : 'none';
  from.onchange = ()=>onChange(from.value, to.value);
  to.onchange = ()=>onChange(from.value, to.value);
  clear.onclick = ()=>onChange('', '');
  const lbl = document.createElement('span'); lbl.className='hint'; lbl.textContent='Dates:'; lbl.style.marginRight='2px';
  wrap.appendChild(lbl); wrap.appendChild(from); wrap.appendChild(dash); wrap.appendChild(to); wrap.appendChild(clear);
  return wrap;
}
// True if a YYYY-MM-DD date is within [from,to] (either bound optional).
function inDateRange(dateStr, from, to){
  if(!dateStr) return true;
  const d = normDate(dateStr);
  if(from && d < from) return false;
  if(to && d > to) return false;
  return true;
}
function mapMember(m){ return {id:m.id, name:m.name, contact:m.contact, plan:m.plan, startDate:m.start_date, expiryDate:m.expiry_date, amount:Number(m.amount||0), createdBy:m.created_by, createdAt:m.created_at, history:m.history||[], branch:m.branch||'', tshirtSize:m.tshirt_size||'', status:m.status||'New', source:m.source||'', remarks:m.remarks||'', formPath:m.form_path||null, formName:m.form_name||null, formUploadedBy:m.form_uploaded_by||null, formUploadedAt:m.form_uploaded_at||null}; }
function mapProduct(p){ return {id:p.id, item:p.item, cost:Number(p.cost||0), supplierKeys:p.supplier_keys||[], active:p.active}; }

function upsertRequest(mapped){
  const i = state.requests.findIndex(r=>r.id===mapped.id);
  if(i>=0) state.requests[i] = mapped; else state.requests.unshift(mapped);
}

async function loadAll(){
  let me;
  try{ me = await apiGet('/api/auth/me'); }catch(e){ me = {user:null}; }
  if(!me.user){
    state.currentUser = null;
    state.loaded = {requests:true, tasks:true, sales:true, members:true, staff:true, products:true};
    render();
    return;
  }
  state.currentUser = me.user;
  try{
    const data = await apiGet('/api/bootstrap');
    state.requests = (data.requests||[]).map(mapRequest);
    state.tasks = (data.tasks||[]).map(mapTask);
    state.sales = (data.sales||[]).map(mapSale);
    state.members = (data.members||[]).map(mapMember);
    state.products = (data.products||[]).map(mapProduct);
    state.staff = data.staff||[];
    state.loaded = {requests:true, tasks:true, sales:true, members:true, staff:true, products:true};
    // Sales targets power the actual-vs-target charts. Load separately so a
    // missing table (before its migration runs) doesn't break the whole app.
    try{ const t = await apiGet('/api/sales/targets'); state.targets = t.targets||[]; }catch(e){ state.targets = []; }
  }catch(e){
    // Could be an expired session — but could also be a real server error
    // (e.g. a pending database migration). Surface it on the login screen
    // instead of bouncing silently.
    state.currentUser = null;
    state.loginError = 'Signed in, but loading your data failed: ' + (e.message || 'unknown error') +
      ' — if this persists, tell your administrator (a database update may be pending).';
  }
  render();
  maybePromptUnfinished();
}

async function refreshStaff(){
  try{
    const data = await apiGet('/api/staff');
    state.staff = data.staff||[];
  }catch(e){ /* not authorized or not needed */ }
}

function findReq(id){ return state.requests.find(r=>r.id===id); }
function activeRequests(){ return state.requests.filter(r=>!r.deletedAt); }
function deletedRequests(){ return state.requests.filter(r=>r.deletedAt); }

// ---------- RENDER SHELL ----------
function render(){
  if(!state.currentUser){
    document.getElementById('shellRoot').style.display = 'none';
    renderSignIn();
    return;
  }
  document.getElementById('signinRoot').innerHTML = '';
  document.getElementById('shellRoot').style.display = '';
  renderNav();
  renderUserChip();
  const visible = visibleSections();
  if(!visible.find(s=>s.key===state.section)){ state.section = visible.length ? visible[0].key : null; }
  const sec = SECTIONS.find(s=>s.key===state.section);
  document.getElementById('sectionTitle').textContent = sec ? sec.label : 'Coach dashboard';
  document.getElementById('sectionSub').textContent = sec ? sec.sub : 'This dashboard is being built next.';
  renderContent();
  renderModal();
  renderDueBanner();
}

function visibleSections(){
  const tier = accessTier(curRole());
  if(tier==='Admin' || tier==='SuperAdmin') return SECTIONS;
  return [];
}

function renderNav(){
  const tier = accessTier(curRole());
  const adminGroup = document.getElementById('nav-admin-group');
  const coachGroup = document.getElementById('nav-coach-group');
  const hrGroup = document.getElementById('nav-hr-group');
  adminGroup.style.display = (tier==='Admin' || tier==='SuperAdmin') ? '' : 'none';
  coachGroup.style.display = (tier==='Coach' || tier==='SuperAdmin') ? '' : 'none';
  hrGroup.style.display = (tier==='SuperAdmin') ? '' : 'none';

  const el = document.getElementById('nav-admin');
  el.innerHTML = '';
  SECTIONS.forEach(s=>{
    // Sales Dashboard is Super Admin only.
    if(s.key==='sales' && salesRole()==='none') return;
    const b = document.createElement('button');
    b.className = 'nav-item' + (state.section===s.key ? ' active':'');
    b.innerHTML = '<span class="nav-dot"></span>' + s.label;
    b.onclick = ()=>{ state.section = s.key; render(); };
    el.appendChild(b);
  });
}

function initials(name){ return (name||'?').split(' ').filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join(''); }

function renderUserChip(){
  const el = document.getElementById('userChip');
  const u = state.currentUser;
  const tier = accessTier(u.role);
  el.innerHTML = '';
  const chip = document.createElement('div'); chip.className='user-chip';
  chip.innerHTML = `<div class="av">${initials(u.name)}</div><div><div class="nm">${escapeHtml(u.name)}</div><div class="rl">${u.role}${tier==='SuperAdmin'?' · Super admin':''}</div></div>`;
  const pwBtn = document.createElement('button');
  pwBtn.className = 'btn sm'; pwBtn.textContent = 'Change password'; pwBtn.style.marginLeft='4px';
  pwBtn.onclick = ()=>{ state.modal = {type:'changePassword'}; render(); };
  chip.appendChild(pwBtn);
  if(tier==='SuperAdmin'){
    const manageBtn = document.createElement('button');
    manageBtn.className='btn sm'; manageBtn.textContent='Manage staff'; manageBtn.style.marginLeft='6px';
    manageBtn.onclick = ()=>{ state.modal={type:'staff'}; render(); };
    chip.appendChild(manageBtn);
  }
  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'btn sm'; logoutBtn.textContent = 'Log out'; logoutBtn.style.marginLeft='6px';
  logoutBtn.onclick = async ()=>{ try{ await apiPost('/api/auth/logout', {}); }catch(e){} state.currentUser = null; state.checklist=null; state.checkSummary=null; state.templates=null; state.checklistStaff=null; state.checklistFilter='All'; state.tasksTab=null; state.promptedUnfinished=false; state.dueInfo=null; state.teamEscalation=null; state.dueBannerDismissed=false; if(state._dueTimer){ clearInterval(state._dueTimer); state._dueTimer=null; } render(); };
  chip.appendChild(logoutBtn);
  el.appendChild(chip);
}

function renderSignIn(){
  const root = document.getElementById('signinRoot');
  root.innerHTML = '';
  const wrap = document.createElement('div'); wrap.className='signin-wrap';
  const card = document.createElement('div'); card.className='signin-card';
  card.innerHTML = `
    <div class="brand" style="padding:0 0 22px;">
      <div class="brand-mark"><img src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBAUEBAYFBQUGBgYHCQ4JCQgICRINDQoOFRIWFhUSFBQXGiEcFxgfGRQUHScdHyIjJSUlFhwpLCgkKyEkJST/2wBDAQYGBgkICREJCREkGBQYJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCT/wAARCADwAPADASIAAhEBAxEB/8QAHQABAAICAwEBAAAAAAAAAAAAAAYIBQcDBAkBAv/EAFQQAAEDBAADBAUGCAgIDwAAAAEAAgMEBQYRBxIhCBMxURQiQWFxMoGRobGzFRYjNkJyc7IXNDdSYnXB0SQlJzVldJPhQ0RUVWOCg4SSlJWiwtLx/8QAGwEBAAIDAQEAAAAAAAAAAAAAAAQGAgMFAQf/xAA5EQACAQMCAwQIAwcFAAAAAAAAAQIDBBEFIRIxQQYTUWEUInGBkbHB0QcyYhUjNEKhsuEWJCZS8P/aAAwDAQACEQMRAD8AtSiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCLAXrP8AEsdeY7xk1moJG+MdRWRsf/4Sdrr2rifg97lENuy6xVUpOhHHXRlx+A3tASdEBDgCDsHwRAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBEXwuAG0BgM6zux8Osenvt+qu4povVYxvWSZ58GMb7XHXzdSdAEqtud8QshyiiZds7yKrwXGKtveUOP2v1rpcYvY5/hytP85+m+TT4nr51xApcpvt44k3iNldjmNVJteNWyXrFX1+tmZ49rGgB58xyN8912yDILnlN4qrxeKyWsrqp5fLNIdknyHkB4ADoB0CAnUnEjB7Q7kx/hfapwD/GL9VzVksvvLWuYxp9wC+N4pYrcT3d84UYu+E9CbVJPRSD3hwe4b+IWtUQFj+HeWV1G4T8Isprql8QMk2F5E8OfKwdXejSAhrz49G8rtD2+Csdws4sWbilapZ6NklDc6N3d19sqOk1LJ4aI6bbsHR17CCAQQvOemqZqOojqKaaSGaJwfHJG4tcxwOwQR1BHmt745xAra2lg4q2prW5Vjjo6fJKePTW3eheQ0Tlo/T2A1x8+V3TSAuwi6dmu9Hf7TRXagl76krYWVELx+kxwBH1FdxAEREAREQBERAEREAREQBERAERdGK+WuaqfSRXKifURnlfE2dhe0+RbvYQHeRNpseaAIiIAiIgOpd6t1Ba6uqY+FjoYXva6ZwawENJHMT4DelT/G8fuXFLHYckyjNckrTVGZ0tHHU8kMbmOl20N6gDTI+gA1z/AAW9e0Lw2yHiTjduo7DUUzvQ6sVFRQVMzooqxmtAFzevQ+zp4nqCAtT41xCt1joKnHcshx3GKnH66S3mkoGuax8ZdG5zgCXOefycm3e3mHmgINxX4e5Uw2XFsYx+93KwW6KSWndT0skwE0jy2bme1uieaLej1Ad5aUCm4R5xSgem49VUGxv/AA57Kbp/2jmrafEbjBesYuuK5DiN0uEDZKJ7nMmjeKSsZ3myeR3R45zICdAjQ0fAqQ23tb4leHxVGY8PYZa1jQw1NMyKoJHuEoDgPdzFAa44ScELhkWd2ilv9FTT2Z8jnVQprjC8uY1hOtxvJ1sNB11Uz4+9nGnsd2oqvCaW32+2zQESw1l0ZF+VDj1aZnDpyke1TXIuP+OTR4lnmNOrI7XarjJabrb3RiN7IKiPmBMbSWnRh5mkHxaR06rZs3HHCvxBqs39JqpbHFUeiNf6M5r6iTp6sbHaJ6nWzoeqfJAUdHCbMJHctPbaetcegbRV9PUk/ARyOJUo4ZYZm+NZjFQ3LGL3Q267xPtlxfUUUkbPRJNd76xboaA2D7CAVuOo7U/CWnlNbRYPWyVu+YSG30sbi7zL+YkfFRG2cfr/AMVeKFCypjq6Cx08NW6G2UAdKXH0eQc8pGufQJPhoAdB5gdmq4XR4nbKq52DLclsRo6aSocynqzy+pDI8jQ5T8qF4+cKw3BPJLhlnC7H7tdqqOquE1PqolYQeZwcQC7Xg7lDSR5laMvfGjG6LHbldrNWWm7VoheIrfWMcWymV7AWujOi4Bs8+x/RU07P3CbLMKya75BeYLXZqC4UzWMtFtmkfF3hcHd5pxPLoAgDZ+UfAIDe6IiAIiIAibHmvxNPFTxmSaRkbB4ueQ0D5ygP2ixNJl2O19eLdSX61VFaRv0aKrjfLr9UHayyAIiIAiIgINxwyCsxfhRkt1oJXw1UVIWRSsOnRue5sfMD7CObYK8+aPH7pcaf0yliErC4jm5wHbHxKvn2lP5EMo/Yw/fxqn2E/wCYm/tX/aod7cSoU+OPiWPsto9HVb121dtLhb2xnbHimYWhuef2HX4PueQUQb4Clq5Wj/2uWfo+OnF2za5covJ5f+VRtm+8aVml8a/bnN2dt8eq5sdYn1iXmt+G9tlKFdrPik/sdi29rridb5mOq57ZcGtI5mVFE1nMPiwt0tjXTtt0cdnoXWzFZJbnJHurZUVHJDA/ZGmkAl4Ot79XWx4laump4qhjo5omSMcNFrhvYUKxK0Uc90uAmhbM2nPKxrxsfKI3r5lLo6lGcJTcccJXNR7D1rW6oW0Kql3raTxjGFl9X0N90XbikGhW4Ox3vhuJH1GP+1Zim7bmOu16Til2i/Zzxv8At0tKvx+0v8bdTfMwD7FxOxayu8bfGPgXD+1YLWKXWLJU/wAN79flqwfx+xYm29szh7WSsjqqG/0IcdGSSnje1vvPI8n6AVy57nHZ8bXxXm+xWS8XC4U7XiWno/SJXRkaDn6Gmu1/O04aVZH4fZ6mnkEULoZRtnM15PK4e4lYDE8dprwamSrc8shIaGsOtk767+ZSY39JwlPf1eZw63ZK+p3FK29VupnGHttu85SxgnNFR0XETBbhh9nqH1t0xWqqK+xlzC2Svt7zuaINPXnaQJA3x6uAXX7OXDjHeJmcVFpyOeobBBRPqY4IZO7M7g5oILvHQDidDr9BXFacdprFcqa52upraOtpZBLDPFNp0bh4EdP/ANU8tc1oq8wt+Y2qtosVzCmm72Zk+2Wu7E9H7cAfR3vBIdsFhJ2CCvaN/Rqy4YvfzPNT7Jajp9LvqsE49XF5x7SccVezhjeLcMskq8Rprj6YIopzTvqHSsc2KQOcQ09dhhf82/NSXBOGeKcR+BGHWetiuTLXA1tZ3TXiF80wMgcX636pc97ho+BHVa344VXEluWQZLgcGaUlLX0rPS4aEPmgbM31eYGIvjcC3l6j+ad+Ki2FM4w5dltoblkWeVFhgqWTVcboZo4nsZ63IQeRvrEBvU9N7UwrJk+09wXwzhtj9nuWM009HUVNWaeSF9Q+VsjeQu5vXJIIIA6HXrKDY3B/Btw2uWUVo7q85RTvtdnhd8tlK4j0ipI9gI0xp95I6LZ/GnJLFcchOR5lVNvEFs/J2rFbfMJI43HxdWVDSWAuI6sYXHQaN+O9T1FVLxNqJchyGR0lU9/cxxQnu4aeJoHJFGwfJY0HoP7VorXEKUeOXI6mmaPc6hXVvRWJNZWdtjauJ8S+z5j1tsVNU43NXXG2xRtdcX2phc+UDZkd62z62yNg66eSmNb21MHhkcylsmQVIB0HmOJgd7+ryfqVZsgxe2W6z1FTBFIJWcvKXSE+LgPBLPYrXPZYKmS3vlmczbnlxDd7I34+HwC0K/puHeJPGcHVn2RvKd07ScoqSjx821jOOizn3Fgqntv2lm/RcMrpfLva1jPsaVg6ztwXR+/Q8MoofLvq18n2NatZQYvaYY2NdQwvc0AFxB9Y+fiuwyx2uP5Nupf9mCo71ikuSZ2qf4cX0knOpFfF/Qm167auUVdBTxWjH7XQVY36RNM587XeXI3beX5yVD63tR8WriC2G+x0wPspqCIfWWkqDWCmbDmLoCxvKx8rQCOnQHS2A0BvyenwWy61FUJKKjnKzzIegdjJapSnVlV4OGTjjGeWPNeJhT2g+KtLT1lNPlNw1WR8hMrGh8fUetGdAsPQjY8z7eqiNfTZNdojWXCSvqmcveGWpmL+njv1iSpHnVs9Kt7K1gJkpz63vYf7j9pWSZK0WCJvQvfStY1m+rnFugFg9RbpxnBc3hkin2MpwvK9tcVHiEVKLWFnPx67EGdSXbE6yiuTJPRaqOUSwSRPBcx7SCCNeHXS9AOCnEk8VMDpr9LTspqxsj6arijJ5BK3Wy3fXRDmnXs3rrrao3xBBbTUDSd6Lx9TVZzsVH/Jrdx5XiT7mJTbSq6tJTl1+5We0GnU9Pvp2tJvEcc+e8U/qWDREUg4wREQGve0DbKm78G8ppaSN0s3ogmDWjZIjka93T9VpVJsDuRlhlt/dgCIGXn347PhpejTgCNEbB9i858ca1mVXtjWhrQ+QAAaAHelQtQipUJZ6Fo7G150tXoqDxxZT9mP8ErUds+Sx3m6mGOnkgcIncxLwQ7RGvZ7z9KkD2CQaJdryB1tcEVDTU0veQU0MZI5SWMAOlXKUqcYyUllvkfaNRoXdWtSlSmo04vMljLfLl4Y369T9ujn3tk4+D2A/ZpRjC9/hK7b1vnG9frOUt9qiOHPay53YOOtyADf6zlvt23Qqr2fM5WsQjS1SxlnrPm3/wBfMlkjxFG6Q700Fx17libVk9Fd5nxQNmY5reb12jr19miVkqv+KT/s3fYVC+H3+cKr9j/8gvLehCdGdSXNG3V9VubfU7W1otKNTOcrPImULGyPnkLByvcB6w8dDWyPm+pRXCIwYayTbxySt+QT4aPs9qmGg1x1+l10orgDh3Ne3Y33jTr3aK2UZtUKjX6SFqNvF6rZU5c/3vxwn/5EnfUMZA+Ybe1jS4hg5j4b0B5rHDJKc/8AE7lr/VXLIvpoZJO8fExz9AbI8vBcUoFNPFK13JEdskA+T18D8d9PnUWn3b2ayzvXnpscShNRitntnm+e7WEuu726mAu+bVdqiiFjr7vZ6gyBzjA+SmLm6O/kkb66UoiyWtyigjqaq43SshfvTK2qkl1o68HOI9ii+fBrrVTvLdOE2gSOoHKf7l38O/N6m+L/AN4qfWl/tIyjlb45lR02j/yGtQrqM04KWeBLljHjjm8457HDmEUk1ofTwQue4PY5rI276dd9B5f2r9YXBLT2XkmifG/vnHle0g66eazckbJW8rxsA7HXRB8wVxdzUte4MqG92dEc7C5zfMb31URXCdDueW+Swy0iVPVP2lvL1eHCx7d8tewx2Xfm9V/Bv7wXFh1fDWWiOmY1/NTNDZC4dCSSei+ZY2eOwVO3iVp5Q71dEesOq63D+Lltc8mvlza+gD+9b1BehNt/zbf0OVUuKn+p6cYrCdPEs45Zk/PrgkrByN5SRpvgd+xfokDQJ6noF0L3UeiWupnHQjl6+frALuzM7xvqu0Q4OafeoLhspPr/AI+5a4XDU50ILeKT9zcl8okErKyOy5pPUyRvewOJ03WzzN/3qejqNrXeZtf+G2yPiMbnxtJBOwdbGwfLotgGpgj0180TT5OeAV0L+HFTpSXPHyKf2SuO6u76hJ4gp5WdvzN+O/JI+VVKyridFK5/dvBa5rTrYPmuKG3spqWGONrO8gaOV4GiSBrr8R9q7TXNe0Oa4OB8CDsL6ucqkkuHoXOVlQqT75rMmsZ8ue308CHcQXB9PQuH85/zdArN9ik/5N7wP9MP+5iVZeIO+4oyRr8o/XvGmqzPYo/k5vP9cP8AuYlZ9O/h4+/5nwrtm29Xq5/T/aiwqIimlXCIiAFectjEn433wMc1p72XZcN/8KfevRo+HzrzpsnTNL8P+lm+9KiXzxQkWDsrHi1agvP6MkJmkimjjkAe2TYDwNaIG9Eb9o39C4rdc6a7U7pqYuLGv5DzDRBC5quPngcQ4scwFzXgbLSB4qH4FW6q6ujcdCQd40e8HR+o/Uq/ToqpRlUXOOD7De6nUs9RoWU3mnV4ufPksLx555+PkS+uqH0lFPUMj7x0TC8M3regopgUhnqLlJIAS/kcenTZLiphIWBpEhaGkaPMddFCsYqqSyXe4UlROyNpOmPJ9U6J9vwK22q4repGK32IWvTVLV7KtVmlTXEnnGE2vry9xL30MT43s3IGvBGuc6bvyG1ibJYaew185ZPI/niGucAe3r4eJ6D6V2pMns8XyrhCf1du+wLH12X2lwiMNQ5z2StdzCN3Ru/W8R5bCwpQuGnDDw/I3ahc6NCcLlVId5T3XrL3rCfw+hI/Hr1UGw+0R15q5zUVUEkbw0Ogk5dg78enuWUqc8tzIn9xHPJJr1Q5oaCfedrBYzkkFkiqGzQySOlcHDkIGtb8/ipVtb14UamFhvGDh6zrGk3OpWrqVFKEePie+FlLHLzXQl34vt9t0up/7z/uXdNLy0LqZr3SHuywOmPMSde0+1Rt3EKlHhQzH4yBfn+EOEHpb3/7Uf3LQ7W7ljK+R06ev9naHF3dTGVh7Te3wPuaPElgpCHl+pWtLj4khpB379grJ4d+b1N8X/vFQq5351wt1PQCLlZC4vL3O257iT/eslZcxZabbFRuozIY9+sJAN7JPhr3qbWs6jtu7it85925WdN7R2Udad7WniLpqOcP83q5XV9HuSLMKmalsrpIJXxP7xg5mO0V8w6pmqrK2SeV8r+9cOZ7tnXRRy+5dHebcaVtI6IlzXcxkB8PmX6x7LKez24UstNLIQ9zuZrhrrpavQqvovBw+tnyJy7TWL170nvv3XBj+bGfZj6Ely783qv4N/eC6uE8v4Iazbw9ri8tI0NE9D7/AA+pYq9ZjR3S1T0kcE7JJANF2tdCD5+5fuw5NarZA2FzZm80be8fy79cDR9vgvI21WNq4OLznPyNlXXLCrr8LqNWPdqHC28rfLf28iZkAjRGwvqiN7zWIU8RtNR+V5/X54/0de9ZS15NQVNDA+prqdlQWDvGk8unKDKyrRgpte7qWu37UabWupW0KiylniyuF+Sed3vyMJxBi1VUMuvlNc36CD/aphFTwxN1HDGzet8rQNqK5xUU1ZQ0skFRDKWTaPI8OIBHu+ClzerQR1GvYttw5ej0k/M52jU6T1m9nHDT7tp7Pmnkxb5hTX+GnY8tbUxOcY9Dl2N+sPesnzDm5d7d468lEMzqDS3i3yhzm8rDtzTojr4j3qSWipbV0EczWtHMSCW+DyDrmHuOt9VjXo4pQq+KwSNK1Li1C509bOMuJexpZSXTd/15Ec4hDVPRfrvP1BWY7E53w6vQ/wBMO+5iVaOIf8Xof13/AGBWV7E/8nl7/rd33Ma7mm/w8ff8z5X22SWsVUv0/wBqLEIiKcVQIiIAfBebeUTXDC8+yOkdA1tRHWzwuErT4d4SCPiNEe4r0kWl+PvZ6ZxYkpLrZqqjtt6pwY5ZJoyGVUfTQe5oJ23XQ6PQkeSxnBTXDJbG63uKlCoqtKWJLk0UvmzO8y+FS2If0IwFh45pYpO8jkcx536zTo9VaOx9iCU6ffcwY3zioaQn6HvcP3Vs3Eeytw4xdk/pNBPfZJ4+7c65vDwwHx5GtDQ09B18R7CFjClCCxFJG25v7m5kpV6kpNcstvHs8Chz5JJDt73OPm47XatNmuV9rW0NqoKqvqnglsFNE6R5A8ejQSvQ+1cD+GtmLTSYXZSW+Dp4BOR88nMpbQWm32pnd2+hpaNnhywRNjH0NAWwitt7s83KHhnm9ykMVJiOQTuB0Q2gl6H3nl6Lb/ZVwWlk4nXy15XYYJqu20Bd6NXwNf3EhkYN8rtjej9aucR0Krtwj6dqHiT5dy77yJDw2vk9k4e4fYay+3jG7HDQUbA+aRtsjeWgkD5Ibs9SFg4q/h/NGyWLhxXPjeA5rm4lIQ4HwI/JKTcUMSnzzArxjdJVQ0s9fE2NssoJa3T2u6gdf0V38TpbzRWiOlvYt3fQBsUZonPLSxrQATzgHewUBWDtPOx6e044bLilTZiLgRLJLZXUTZAW9G8zmN5vA9FZr8QMQ1+ath/9Ph/+q0t20OY4jjQYQH/hcaJ8Ae6ctqUzuJjKeNtQMPmmDQHyMdUsDj5hujr4bKA0FZOFN2Z2n5q6owycYsa2pIkfQD0PkMDg3oRy65ta9+lYPIMDxKKxXGSPF7Ex7aWUhzaCIEEMPUequ1aX5qbhF+FosdbRde8NLLOZfA60HNA8dePsWSyQ7x+5/wCqTfuFAaB7J0WFZNgT7RVWi2V95t0r5Ko1NAx7mske7u/Xc31ujT0B6Lc144V4Re7XVW2pxezshqYzG50NHHHI0H2tc1u2keII9qrv2Hj/AIwy/wDY0f2yqyOdZvbuH9gdfrsJPQYp4YZnx9TG2SQM59e0Dm2QOut6QFLb52aMsoOKEOGUMTqikqyZqa5uYe6FMD6z368HN2AW+0ka+UFb3EuDeFYlj9HZ4cftlb6OzT6mrpI5ZZn/AKT3OIPUn2eA8B0Cl9NXUtZRxVtPURTU0sYljmY4Fj2EbDgfAjXXawOEZ/aOIEN0qrJIZqO31zqAVG/Vnc1jHOcz+jt+gfbrfhpAaD7Y+N2SyYlYZLXZ7dQPkuD2vdS0zIi4d0ToloGwtBVfBjiBS2+juUeLXOtoq2mjq4aiiiNQx0b2hw3ybIOj1B0VY7ttEfidj39Yv+6K3Nwp/kxxL+p6P7lqA85a+wXe1bFwtddRkePf0749fSAuqyongOmSyRkeTiF6muY17S1zQ5p8QeoWBvXD7Ecic593xmzV8j+pkno43PP/AFiN/WmMnsZOLyjzQqKupquX0iaWUsGm87idD51lbfl1zt1PHTxuidFGNNa9ngPiOqvPcOzJwpuM7ZnYtHA4HZFPUzRtd7i0O1r4KJZt2OsTyK4S11huVTjzpAP8GjibNTtIHi1pIcN+XMVrnShNcMllEu21C5tqjq0ajjJ9U3kqFfMkmvsMLJoI4zESdsJ6715/BW07E/8AJ7e/63d9zGtcXrsW5rRu3arzZbjHvX5Rz4H/AB0WkfWrIcD+GT+FOCQ2OoqIqmulmfVVckW+TvHADTd9SA1rRs+Oiem17Tpxpx4YrCMLu8rXdV1q8uKT5v2bE/REWZGCIiAIiIAiIgCIiALRvEXgPk02a1edcN8p/AV4rY9VUEpIjmIAHRwBGjyjYc0jY3sLeSICqbsc7VbXEC6yOAPQiro9H6QuGbPu0ngFI6gueOSXiSeYllY6k9Lc31R6je4dygdN+sN7JVsk0gKUZFj3aE4ymkgvVkrW0tPL30MdRBFRRxP0Rzetpx6H27UvqMY7VME744736Qxp0JY6ulDXe8czQfpAVqNIgKpfi72rP+dJf/N0a69xw3tSXahnoau5Tup52GORrK+lYXNPQjbdEfMVbVEBUHGOz/xw4d2yavxS9W6krK7kbU0UFQ3vCGk8u3PZyHWz4H2+1fnJOG/aVy+0TWe+TGuoJi0yQPraUBxa4OHho9CAVcBEBUE8E+0BZ8Khxu33qGa1VMb2TWyCuY007XHZYXPA6H2hjiOp81yY9wb7QXD2wQ0uL3ikghqpXTz0NNUxc0MhAG3GRvKdhrfkuPgrdIgKa5bwi7RGe0tPR5Ly3Gngk72NstbTAMcRrfqkHwKthhNmnxzDrFZqpzH1Fvt9PSyuYdtL2Rtade7YKzSIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgP/9k=" alt="Roshan Gym"></div>
      <div class="brand-txt"><h1>Roshan Gym</h1><span>Sign in to continue</span></div>
    </div>
  `;
  wrap.appendChild(card);
  root.appendChild(wrap);

  const form = document.createElement('div');
  form.innerHTML = `
    <div class="field"><label>Username</label><input id="login-username" autocomplete="username" placeholder="e.g. loraine"></div>
    <div class="field"><label>Password</label><input id="login-password" type="password" autocomplete="current-password" placeholder="Password"></div>
    <div id="login-error"></div>
  `;
  card.appendChild(form);

  const b = document.createElement('button'); b.className='btn primary'; b.style.width='100%'; b.style.marginTop='4px';
  b.textContent = 'Sign in';
  const userInput = form.querySelector('#login-username');
  const passInput = form.querySelector('#login-password');
  const errEl = form.querySelector('#login-error');
  // Show any error carried over from a failed load (e.g. server-side failure
  // after a successful sign-in), then clear it so it doesn't stick around.
  if(state.loginError){
    errEl.innerHTML = `<div class="notice err">${escapeHtml(state.loginError)}</div>`;
    state.loginError = null;
  }

  async function attemptLogin(){
    const username = userInput.value.trim();
    const password = passInput.value;
    errEl.innerHTML = '';
    if(!username || !password){ errEl.innerHTML = '<div class="notice err">Enter your username and password.</div>'; return; }
    b.disabled = true; b.textContent = 'Signing in…';
    try{
      await apiPost('/api/auth/login', {username, password});
      await loadAll();
    }catch(e){
      errEl.innerHTML = `<div class="notice err">${escapeHtml(e.message)}</div>`;
      b.disabled=false; b.textContent='Sign in';
    }
  }
  b.onclick = attemptLogin;
  passInput.onkeydown = (e)=>{ if(e.key==='Enter') attemptLogin(); };
  userInput.onkeydown = (e)=>{ if(e.key==='Enter') passInput.focus(); };
  card.appendChild(b);

  const note = document.createElement('div'); note.className='hint'; note.style.margin='16px 0 0';
  note.textContent = 'Passwords are hashed with bcrypt and checked on the server — the browser never sees or stores them. This covers per-person access and an audit trail; for anything beyond internal team use, add rate limiting and consider two-factor login.';
  card.appendChild(note);
}

function renderContent(){
  const el = document.getElementById('content');
  el.innerHTML = '';
  const anyLoaded = state.loaded.requests && state.loaded.tasks && state.loaded.sales && state.loaded.members && state.loaded.products;
  if(!anyLoaded){ el.innerHTML = '<div class="empty">Loading…</div>'; return; }
  if(!state.section){
    el.innerHTML = '<div class="empty">The coach dashboard is coming in phase 2. Check back soon.</div>';
    return;
  }
  if(state.section==='tasks') return renderTasks(el);
  if(state.section==='po') return renderRequestsSection(el, 'PO');
  if(state.section==='pettycash') return renderRequestsSection(el, 'PettyCash');
  if(state.section==='potracker') return renderPoTracker(el);
  if(state.section==='sales'){
    if(salesRole()==='none'){ el.innerHTML='<div class="empty">You don\u2019t have access to the Sales Dashboard.</div>'; return; }
    return renderSales(el);
  }
  if(state.section==='membership') return renderMembership(el);
  if(state.section==='repository'){ state.section='potracker'; return renderPoTracker(el); }
}

function divider(){ const d=document.createElement('div'); d.className='divider'; return d; }
function closeBtn(){ const b=document.createElement('button'); b.className='modal-close'; b.innerHTML='&times;'; b.onclick=()=>{state.modal=null; render();}; return b; }

// ============ DAILY TASK MANAGER ============
// ============ DAILY TASK CHECKLIST (templates + entries + proof) ============
function mapEntry(e){
  return {
    id:e.id, templateId:e.template_id, staffId:e.staff_id, assignee:e.assignee,
    title:e.title, section:e.section||'', frequency:e.frequency, category:e.category||'',
    sortOrder:e.sort_order||0, periodDate:e.period_date, status:e.status,
    completedAt:e.completed_at, completedBy:e.completed_by, remarks:e.remarks||'',
    files:(e.task_files||[]).map(f=>({id:f.id, name:f.name, uploadedBy:f.uploaded_by, uploadedAt:f.uploaded_at})),
  };
}

async function loadChecklist(staffId, dateStr){
  const params = new URLSearchParams();
  params.set('date', dateStr);
  if(staffId) params.set('staff', staffId);
  const data = await apiGet('/api/checklist?' + params.toString());
  state.checklist = {
    date: data.date, weekStart: data.weekStart,
    entries: (data.entries||[]).map(mapEntry),
    loadedFor: (staffId||state.currentUser.id) + '|' + data.date,
  };
}

async function loadCheckSummary(dateStr, staffForTrend){
  const params = new URLSearchParams();
  params.set('date', dateStr);
  if(staffForTrend) params.set('staff', staffForTrend);
  const data = await apiGet('/api/checklist/summary?' + params.toString());
  state.checkSummary = data;
}

async function checkDueTasks(){
  // For Admins: fetch counts of tasks due today / this week / overdue.
  if(!state.currentUser) return;
  if(accessTier(curRole())==='SuperAdmin') return checkTeamEscalations();
  try{
    const data = await apiGet('/api/checklist/due?date=' + todayStr());
    state.dueInfo = data;
    renderDueBanner();
    // Show the modal prompt once per session if anything is due or overdue.
    if(!state.promptedUnfinished && data.total > 0){
      state.promptedUnfinished = true;
      state.modal = {type:'unfinishedPrompt', due:data};
      render();
    }
  }catch(e){ /* checklist may not be set up yet; stay quiet */ }
}

async function checkTeamEscalations(){
  // For Super Admins: surface a banner if any staff missed the daily cutoff.
  try{
    const data = await apiGet('/api/checklist/summary?date=' + todayStr());
    state.checkSummary = data;
    const escalated = (data.perStaff||[]).filter(p=>p.escalated);
    state.teamEscalation = escalated.length ? {count:escalated.length, names:escalated.map(p=>p.name)} : null;
    renderDueBanner();
  }catch(e){ /* stay quiet */ }
}

function maybePromptUnfinished(){
  // Kick off the first check, then re-check periodically so a due/overdue
  // notification appears even during a long session (not only at login).
  checkDueTasks();
  if(!state._dueTimer){
    state._dueTimer = setInterval(()=>{ checkDueTasks(); }, 15*60*1000); // every 15 min
  }
}

function renderDueBanner(){
  // A persistent, dismissible banner at the top of the app for due/overdue tasks.
  const host = document.getElementById('dueBanner');
  if(!host) return;
  host.innerHTML = '';

  // Super Admin: show a team escalation banner if any staff missed the cutoff.
  if(state.currentUser && accessTier(curRole())==='SuperAdmin'){
    const esc = state.teamEscalation;
    if(!esc || state.dueBannerDismissed){ host.style.display='none'; return; }
    host.style.display='';
    const bar = document.createElement('div'); bar.className='due-banner overdue';
    const msg = document.createElement('div');
    msg.innerHTML = '<strong>Task escalation:</strong> ' + esc.count + ' staff missed the daily deadline — ' +
      esc.names.map(escapeHtml).join(', ') + '.';
    bar.appendChild(msg);
    const actions = document.createElement('div'); actions.style.cssText='display:flex;gap:8px;flex-shrink:0;';
    const open = document.createElement('button'); open.className='btn sm primary'; open.textContent='View team';
    open.onclick = ()=>{ state.section='tasks'; state.tasksTab='team'; render(); };
    actions.appendChild(open);
    const x = document.createElement('button'); x.className='btn sm ghost'; x.textContent='Dismiss';
    x.onclick = ()=>{ state.dueBannerDismissed = true; renderDueBanner(); };
    actions.appendChild(x);
    bar.appendChild(actions);
    host.appendChild(bar);
    return;
  }

  const d = state.dueInfo;
  if(!d || d.total===0 || state.dueBannerDismissed){ host.style.display='none'; return; }
  host.style.display='';
  const bits = [];
  if(d.openToday>0) bits.push(d.openToday + ' due today');
  if(d.openThisWeek>0) bits.push(d.openThisWeek + ' due this week');
  if(d.overdue>0) bits.push(d.overdue + ' overdue');
  const bar = document.createElement('div');
  const escalated = d.escalated;
  bar.className = 'due-banner' + (escalated || d.overdue>0 ? ' overdue' : '');
  const msg = document.createElement('div');
  if(escalated){
    const ch = d.cutoffHour!=null ? d.cutoffHour : 15;
    const label = (ch>12?(ch-12):ch) + ':00 ' + (ch>=12?'PM':'AM');
    msg.innerHTML = '<strong>Past your ' + label + ' shift-end — supervisor notified.</strong> ' +
      d.openToday + ' task' + (d.openToday===1?'':'s') + ' still open today. Please finish as soon as possible.';
  } else {
    msg.innerHTML = '<strong>Tasks need attention:</strong> ' + bits.join(' &middot; ') +
      (d.overdue>0 && d.overdueSample.length ? ' — e.g. ' + escapeHtml(d.overdueSample[0]) : '');
  }
  bar.appendChild(msg);
  const actions = document.createElement('div'); actions.style.cssText='display:flex;gap:8px;flex-shrink:0;';
  const open = document.createElement('button'); open.className='btn sm primary'; open.textContent='Open checklist';
  open.onclick = ()=>{ state.section='tasks'; state.tasksTab='checklist'; render(); };
  actions.appendChild(open);
  const x = document.createElement('button'); x.className='btn sm ghost'; x.textContent='Dismiss';
  x.onclick = ()=>{ state.dueBannerDismissed = true; renderDueBanner(); };
  actions.appendChild(x);
  bar.appendChild(actions);
  host.appendChild(bar);
}

function renderUnfinishedPromptModal(modal){
  const d = state.modal.due || {openToday:0, openThisWeek:0, overdue:0, overdueSample:[]};
  const head=document.createElement('div'); head.className='modal-head';
  head.innerHTML = '<h2 style="font-size:16px;">Tasks need attention</h2>';
  head.appendChild(closeBtn()); modal.appendChild(head);

  if(d.overdue>0){
    const warn=document.createElement('div'); warn.className='notice err';
    warn.innerHTML = '<strong>' + d.overdue + ' overdue task' + (d.overdue===1?'':'s') + '</strong> were not completed on time' +
      (d.overdueSample && d.overdueSample.length ? ': ' + d.overdueSample.map(escapeHtml).join('; ') + (d.overdue>d.overdueSample.length?'…':'') : '') + '.';
    modal.appendChild(warn);
  }
  const info=document.createElement('div'); info.className='notice';
  const parts = [];
  if(d.openToday>0) parts.push(d.openToday + ' due today');
  if(d.openThisWeek>0) parts.push(d.openThisWeek + ' due this week');
  info.textContent = parts.length
    ? 'You have ' + parts.join(' and ') + '. Work through them and mark each as you go — attach a screenshot where proof is useful.'
    : 'Please review and clear your overdue tasks.';
  modal.appendChild(info);

  const row=document.createElement('div'); row.className='action-row';
  const b=document.createElement('button'); b.className='btn primary'; b.textContent='Open my checklist';
  b.onclick=()=>{ state.modal=null; state.section='tasks'; state.tasksTab='checklist'; render(); };
  row.appendChild(b);
  const later=document.createElement('button'); later.className='btn ghost'; later.textContent='Later';
  later.onclick=()=>{ state.modal=null; render(); };
  row.appendChild(later);
  modal.appendChild(row);
}

function renderAddChecklistTaskModal(modal){
  const {staffId, date} = state.modal;
  const isSelf = staffId === state.currentUser.id;
  const person = state.staff.find(s=>s.id===staffId);
  const head=document.createElement('div'); head.className='modal-head';
  head.innerHTML = `<h2 style="font-size:16px;">Add a task${isSelf?'':' for '+escapeHtml(person?person.name:'')}</h2>`;
  head.appendChild(closeBtn()); modal.appendChild(head);
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="field full"><label>Task</label><input id="act-title" placeholder="e.g. Follow up on supplier delivery"></div>
    <div class="form-grid">
      <div class="field"><label>Frequency</label><select id="act-freq"><option value="Daily">Daily (repeats every day)</option><option value="Weekly">Weekly (repeats every week)</option></select></div>
      <div class="field"><label>Category (optional)</label><input id="act-category" placeholder="e.g. Admin"></div>
    </div>
    <div class="field full"><label>Section (optional)</label><input id="act-section" placeholder="e.g. Closing Tasks"></div>
    <div class="hint">This becomes a recurring task on the checklist from today onward. To remove it later, use the ✕ on the task.</div>
    <div id="act-error"></div>
  `;
  modal.appendChild(wrap);
  const row=document.createElement('div'); row.className='action-row';
  const b=document.createElement('button'); b.className='btn primary'; b.textContent='Add task';
  b.onclick=async ()=>{
    const title = document.getElementById('act-title').value.trim();
    const frequency = document.getElementById('act-freq').value;
    const category = document.getElementById('act-category').value.trim();
    const section = document.getElementById('act-section').value.trim();
    const errEl = document.getElementById('act-error'); errEl.innerHTML='';
    if(!title){ errEl.innerHTML='<div class="notice err">Enter the task description.</div>'; return; }
    b.disabled=true; b.textContent='Saving…';
    try{
      await apiPost('/api/templates', {staffId, title, frequency, category, section});
      state.checklist=null; state.templates=null; state.checkSummary=null;
      state.modal=null; render();
    }catch(e){ errEl.innerHTML=`<div class="notice err">${escapeHtml(e.message)}</div>`; b.disabled=false; b.textContent='Add task'; }
  };
  row.appendChild(b); modal.appendChild(row);
}

function renderTasks(el){
  const isSuper = accessTier(curRole())==='SuperAdmin';
  if(!state.tasksTab) state.tasksTab = isSuper ? 'team' : 'checklist';
  if(!state.checklistDate) state.checklistDate = todayStr();

  const tabs = document.createElement('div'); tabs.className='toolbar'; tabs.style.marginBottom='18px';
  const defs = isSuper
    ? [{k:'team', l:'Team overview'}, {k:'checklist', l:'View a checklist'}, {k:'templates', l:'Manage templates'}, {k:'adhoc', l:'Ad-hoc & projects'}]
    : [{k:'checklist', l:'My checklist'}, {k:'summary', l:'My summary'}, {k:'adhoc', l:'Ad-hoc & projects'}];
  defs.forEach(d=>{
    const b=document.createElement('button');
    b.className = 'btn' + (state.tasksTab===d.k ? ' primary' : '');
    b.textContent = d.l;
    b.onclick = ()=>{ state.tasksTab=d.k; render(); };
    tabs.appendChild(b);
  });
  el.appendChild(tabs);

  const body = document.createElement('div');
  el.appendChild(body);
  try{
    if(state.tasksTab==='adhoc') return renderAdhocTasks(body);
    if(state.tasksTab==='templates') return renderTemplatesView(body);
    if(state.tasksTab==='team') return renderTeamOverview(body);
    if(state.tasksTab==='summary') return renderMySummary(body);
    return renderChecklistView(body);
  }catch(err){
    console.error('Tasks view error:', err);
    body.innerHTML = '<div class="empty">Could not load this view. Try another tab, or refresh the page.</div>';
  }
}

function checklistPct(entries, freq){
  const list = entries.filter(e=>e.frequency===freq);
  const done = list.filter(e=>e.status==='Done').length;
  return {done, total:list.length, pct: list.length ? Math.round(done/list.length*100) : 0};
}

function renderChecklistView(el){
  const isSuper = accessTier(curRole())==='SuperAdmin';
  const viewingStaff = (isSuper && state.checklistStaff) ? state.checklistStaff : state.currentUser.id;
  const key = viewingStaff + '|' + state.checklistDate;

  const bar = document.createElement('div'); bar.className='toolbar'; bar.style.marginBottom='16px';
  const dateInput = document.createElement('input'); dateInput.type='date'; dateInput.value=state.checklistDate;
  dateInput.onchange = ()=>{ state.checklistDate = dateInput.value || todayStr(); state.checklist=null; render(); };
  bar.appendChild(dateInput);
  if(isSuper){
    const sel = document.createElement('select');
    sel.innerHTML = state.staff.filter(s=>s.active!==false).map(s=>`<option value="${s.id}" ${s.id===viewingStaff?'selected':''}>${escapeHtml(s.name)}</option>`).join('');
    sel.onchange = ()=>{ state.checklistStaff = sel.value; state.checklist=null; render(); };
    bar.appendChild(sel);
  }
  // Any user can add a task to the checklist they're viewing (their own, or
  // anyone's if they're a Super Admin).
  const addBtn = document.createElement('button'); addBtn.className='btn primary'; addBtn.textContent='+ Add task';
  addBtn.onclick = ()=>{ state.modal = {type:'addChecklistTask', staffId: viewingStaff, date: state.checklistDate}; render(); };
  bar.appendChild(addBtn);
  const exBtn = document.createElement('button'); exBtn.className='btn'; exBtn.textContent='Export to Excel';
  exBtn.onclick = ()=>{
    if(!state.checklist || !state.checklist.entries.length){ alert('Nothing to export for this date yet.'); return; }
    const who = state.checklist.entries[0].assignee || 'checklist';
    const rows = state.checklist.entries.map(t=>({
      'Assignee': t.assignee,
      'Frequency': t.frequency,
      'Period': t.frequency==='Daily' ? t.periodDate : ('Week of ' + t.periodDate),
      'Section': t.section||'',
      'Task': t.title,
      'Category': t.category||'',
      'Status': t.status,
      'Completed at': t.completedAt ? fmtDateTime(t.completedAt) : '',
      'Completed by': t.completedBy||'',
      'Remarks': t.remarks||'',
      'Proof files': t.files.length,
    }));
    exportRowsToExcel(rows, 'Checklist', 'roshan-checklist-' + who.toLowerCase().replace(/\s+/g,'-'));
  };
  bar.appendChild(exBtn);
  el.appendChild(bar);

  // Completion deadline notice for the person's own checklist (Admins).
  if(!isSuper && state.dueInfo && state.dueInfo.cutoffHour != null){
    const dl = document.createElement('div');
    if(state.dueInfo.restDay){
      dl.className = 'notice';
      dl.textContent = 'You\u2019re marked as rest day today — no task deadline or supervisor alerts. Update anything you like, but nothing will be escalated.';
      el.appendChild(dl);
    } else {
      const ch = state.dueInfo.cutoffHour;
      const label = (ch>12? (ch-12):ch) + ':00 ' + (ch>=12?'PM':'AM');
      if(state.dueInfo.escalated){
        dl.className = 'notice err';
        dl.textContent = 'Your ' + label + ' shift-end deadline has passed with tasks still open — your supervisor has been notified. Please complete them as soon as possible.';
      } else {
        dl.className = 'notice';
        dl.textContent = 'Complete all of today\u2019s tasks by ' + label + ' (your shift end). After that, any still open are flagged to your supervisor.';
      }
      el.appendChild(dl);
    }
  }

  if(!state.checklist || state.checklist.loadedFor !== key){
    const loading = document.createElement('div'); loading.className='empty'; loading.textContent='Loading checklist…';
    el.appendChild(loading);
    loadChecklist(isSuper ? viewingStaff : null, state.checklistDate).then(()=>render()).catch(e=>{ loading.textContent = e.message; });
    return;
  }

  const entries = state.checklist.entries;
  if(entries.length===0){
    const e=document.createElement('div'); e.className='empty';
    e.textContent = 'No checklist tasks are set up for this person yet. ' + (isSuper ? 'Use "Manage templates" to add their daily and weekly tasks.' : 'Ask your supervisor to set up your task templates.');
    el.appendChild(e); return;
  }

  const d = checklistPct(entries,'Daily'), w = checklistPct(entries,'Weekly');
  const metrics = document.createElement('div'); metrics.className='metrics';
  metrics.innerHTML = `
    <div class="metric ${d.pct===100?'good':(d.done===0?'flag':'')}"><div class="num">${d.done}/${d.total}</div><div class="lbl">Daily done (${d.pct}%)</div></div>
    <div class="metric ${w.pct===100?'good':''}"><div class="num">${w.done}/${w.total}</div><div class="lbl">Weekly done (${w.pct}%)</div></div>
    <div class="metric"><div class="num">${entries.filter(e=>e.status==='In Progress').length}</div><div class="lbl">In progress</div></div>
    <div class="metric"><div class="num">${entries.reduce((s,e)=>s+e.files.length,0)}</div><div class="lbl">Proof screenshots</div></div>
  `;
  el.appendChild(metrics);

  // ----- Status filter chips -----
  if(!state.checklistFilter) state.checklistFilter = 'All';
  const counts = {
    All: entries.length,
    'Not Started': entries.filter(e=>e.status==='Not Started').length,
    'In Progress': entries.filter(e=>e.status==='In Progress').length,
    Done: entries.filter(e=>e.status==='Done').length,
    Skipped: entries.filter(e=>e.status==='Skipped').length,
  };
  const filterBar = document.createElement('div'); filterBar.className='toolbar'; filterBar.style.margin='4px 0 8px';
  ['All','Not Started','In Progress','Done','Skipped'].forEach(f=>{
    const chip = document.createElement('button');
    chip.className = 'btn sm' + (state.checklistFilter===f ? ' primary' : '');
    chip.textContent = f + ' (' + counts[f] + ')';
    chip.onclick = ()=>{ state.checklistFilter = f; render(); };
    filterBar.appendChild(chip);
  });
  el.appendChild(filterBar);

  const matchesFilter = (t)=> state.checklistFilter==='All' || t.status===state.checklistFilter;

  const groups = [
    {label:'Daily tasks — ' + fmtDate(state.checklist.date), freq:'Daily'},
    {label:'Weekly tasks — week of ' + fmtDate(state.checklist.weekStart), freq:'Weekly'},
  ];
  let shownAny = false;
  groups.forEach(g=>{
    const list = entries.filter(e=>e.frequency===g.freq && matchesFilter(e));
    if(!list.length) return;
    shownAny = true;
    const h = document.createElement('div'); h.className='section-head'; h.innerHTML = `<h2>${g.label}</h2>`;
    el.appendChild(h);
    let lastSection = null;
    list.forEach(t=>{
      if(t.section && t.section!==lastSection){
        lastSection = t.section;
        const sh = document.createElement('div');
        sh.style.cssText='font-size:11px;color:var(--ink-2);text-transform:uppercase;letter-spacing:.05em;margin:14px 0 8px;';
        sh.textContent = t.section;
        el.appendChild(sh);
      }
      el.appendChild(renderChecklistRow(t));
    });
  });
  if(!shownAny){
    const e=document.createElement('div'); e.className='empty';
    e.textContent = state.checklistFilter==='All' ? 'No tasks.' : 'No ' + state.checklistFilter.toLowerCase() + ' tasks.';
    el.appendChild(e);
  }
}

function renderChecklistRow(t){
  const card = document.createElement('div'); card.className='card'; card.style.padding='12px 16px';
  const pill = t.status==='Done' ? 'done' : t.status==='In Progress' ? 'progress' : 'todo';
  const top = document.createElement('div'); top.className='req-top';
  top.innerHTML = `
    <div style="flex:1;min-width:0;">
      <div style="font-size:13.5px;color:var(--ink-0);">${escapeHtml(t.title)}</div>
      <div class="req-sub">${t.category?escapeHtml(t.category)+' &middot; ':''}${t.status==='Done'&&t.completedAt ? 'done '+fmtDateTime(t.completedAt)+(t.completedBy?' by '+escapeHtml(t.completedBy):'') : t.status}${t.remarks?' &middot; '+escapeHtml(t.remarks):''}</div>
    </div>
    <span class="status-pill ${pill}">${t.status}</span>
  `;
  card.appendChild(top);

  if(t.files.length){
    const files = document.createElement('div'); files.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;';
    t.files.forEach(f=>{
      const a=document.createElement('button'); a.className='btn sm ghost'; a.textContent='📎 ' + (f.name||'proof');
      a.onclick=()=>window.open(`/api/checklist/${t.id}/files?file=${f.id}`,'_blank');
      files.appendChild(a);
    });
    card.appendChild(files);
  }

  const row = document.createElement('div'); row.className='action-row'; row.style.marginTop='10px';
  const setStatus = async (status)=>{
    try{
      const {entry} = await apiPatch(`/api/checklist/${t.id}`, {status});
      const i = state.checklist.entries.findIndex(x=>x.id===t.id);
      if(i>=0) state.checklist.entries[i] = mapEntry(entry);
      render();
      checkDueTasks();
    }catch(e){ alert(e.message); }
  };
  if(t.status!=='Done'){
    if(t.status!=='In Progress'){
      const b=document.createElement('button'); b.className='btn sm'; b.textContent='Start';
      b.onclick=()=>setStatus('In Progress'); row.appendChild(b);
    }
    const b=document.createElement('button'); b.className='btn sm primary'; b.textContent='Mark done';
    b.onclick=()=>setStatus('Done'); row.appendChild(b);
    const sk=document.createElement('button'); sk.className='btn sm ghost'; sk.textContent='Skip';
    sk.onclick=async ()=>{
      const reason = prompt('Why is this task being skipped? (required)');
      if(reason===null) return;
      if(!reason.trim()){ alert('A reason is required to skip a task.'); return; }
      try{
        await apiPatch(`/api/checklist/${t.id}`, {remarks:reason.trim()});
        const {entry} = await apiPatch(`/api/checklist/${t.id}`, {status:'Skipped'});
        const i = state.checklist.entries.findIndex(x=>x.id===t.id);
        if(i>=0) state.checklist.entries[i] = mapEntry(entry);
        render();
      }catch(e){ alert(e.message); }
    };
    row.appendChild(sk);
  } else {
    const b=document.createElement('button'); b.className='btn sm ghost'; b.textContent='Reopen';
    b.onclick=()=>setStatus('Not Started'); row.appendChild(b);
  }

  const fileInput = document.createElement('input');
  fileInput.type='file'; fileInput.accept='image/*'; fileInput.style.display='none';
  const attachBtn=document.createElement('button'); attachBtn.className='btn sm'; attachBtn.textContent='📷 Attach proof';
  fileInput.onchange = async ()=>{
    const file = fileInput.files[0];
    if(!file) return;
    if(file.size > 4*1024*1024){ alert('That file is over 4MB. Attach a smaller image.'); return; }
    attachBtn.disabled=true; attachBtn.textContent='Uploading…';
    try{
      const {entry} = await apiUpload(`/api/checklist/${t.id}/files`, file, 'Proof');
      const i = state.checklist.entries.findIndex(x=>x.id===t.id);
      if(i>=0) state.checklist.entries[i] = mapEntry(entry);
      render();
    }catch(e){ alert(e.message); attachBtn.disabled=false; attachBtn.textContent='📷 Attach proof'; }
  };
  attachBtn.onclick=()=>fileInput.click();
  row.appendChild(attachBtn);
  row.appendChild(fileInput);

  // Remove this recurring task (own tasks, or any for a Super Admin).
  const canRemove = t.templateId && (t.staffId === state.currentUser.id || accessTier(curRole())==='SuperAdmin');
  if(canRemove){
    const rm = document.createElement('button'); rm.className='btn sm ghost'; rm.textContent='✕ Remove';
    rm.title = 'Stop this task from recurring on the checklist';
    rm.onclick = async ()=>{
      if(!confirm('Remove "' + t.title + '" from this checklist going forward? Past days keep their record.')) return;
      try{
        await apiPatch(`/api/templates/${t.templateId}`, {active:false});
        state.checklist=null; state.templates=null; state.checkSummary=null;
        render();
      }catch(e){ alert(e.message); }
    };
    row.appendChild(rm);
  }

  card.appendChild(row);
  return card;
}

function trendBars(trend){
  const wrap = document.createElement('div'); wrap.className='card';
  wrap.innerHTML = '<h2 style="font-size:13px;color:var(--ink-1);margin-bottom:12px;">Daily completion — last 7 days</h2>';
  trend.forEach(day=>{
    const pct = day.total ? Math.round(day.done/day.total*100) : 0;
    const row = document.createElement('div'); row.className='bar-row';
    row.innerHTML = `<div class="bl">${fmtDate(day.date)}</div><div class="bt"><div class="bf" style="width:${pct}%;${pct===100?'background:var(--lime);':''}"></div></div><div class="bv">${day.done}/${day.total} (${pct}%)</div>`;
    wrap.appendChild(row);
  });
  return wrap;
}

function renderMySummary(el){
  if(!state.checklistDate) state.checklistDate = todayStr();
  if(!state.checkSummary || state.checkSummary.date !== state.checklistDate || !state.checkSummary.trend){
    const loading = document.createElement('div'); loading.className='empty'; loading.textContent='Loading summary…';
    el.appendChild(loading);
    loadCheckSummary(state.checklistDate, state.currentUser.id).then(()=>render()).catch(e=>{ loading.textContent=e.message; });
    return;
  }
  const me = state.checkSummary.perStaff.find(s=>s.staffId===state.currentUser.id) || state.checkSummary.perStaff[0];
  if(!me){ const e=document.createElement('div'); e.className='empty'; e.textContent='No checklist data yet.'; el.appendChild(e); return; }
  const dPct = me.dailyTotal ? Math.round(me.dailyDone/me.dailyTotal*100) : 0;
  const wPct = me.weeklyTotal ? Math.round(me.weeklyDone/me.weeklyTotal*100) : 0;
  const metrics = document.createElement('div'); metrics.className='metrics';
  metrics.innerHTML = `
    <div class="metric ${dPct===100?'good':''}"><div class="num">${dPct}%</div><div class="lbl">Today: ${me.dailyDone}/${me.dailyTotal} daily done</div></div>
    <div class="metric ${wPct===100?'good':''}"><div class="num">${wPct}%</div><div class="lbl">This week: ${me.weeklyDone}/${me.weeklyTotal} weekly done</div></div>
    <div class="metric"><div class="num">${me.dailySkipped+me.weeklySkipped}</div><div class="lbl">Skipped</div></div>
    <div class="metric"><div class="num" style="font-size:15px;">${me.lastUpdate?fmtDateTime(me.lastUpdate):'—'}</div><div class="lbl">Last task completed</div></div>
  `;
  el.appendChild(metrics);
  if(state.checkSummary.trend) el.appendChild(trendBars(state.checkSummary.trend));
}

// Weekday rest days (0=Sun … 6=Sat) — an editable layer saved in this browser.
// The backend also has a permanent "Rest day" (shift_end_hour=0) set in Staff directory;
// this adds a specific weekly day off. Seeded with the current schedule.
const REST_DAY_LS_KEY = 'roshan.restWeekday';
const DEFAULT_REST_WEEKDAY = { andre:0, emman:6, ela:0, kloe:0, loraine:6 }; // Sun/Sat
const WEEKDAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
function loadRestWeekdays(){
  if(state.restWeekdays) return state.restWeekdays;
  let o={};
  try{ if(typeof localStorage!=='undefined'){ const raw=localStorage.getItem(REST_DAY_LS_KEY); if(raw) o=JSON.parse(raw)||{}; } }catch(e){ o={}; }
  state.restWeekdays=o; return o;
}
function saveRestWeekday(staffId, day){
  const o=loadRestWeekdays();
  if(day===''||day==null) delete o['id:'+staffId]; else o['id:'+staffId]=Number(day);
  try{ if(typeof localStorage!=='undefined') localStorage.setItem(REST_DAY_LS_KEY, JSON.stringify(o)); }catch(e){}
}
// Resolve a staff's rest weekday: explicit per-id override first, else seeded default by first name.
function restWeekdayForStaff(staffId, name){
  const o=loadRestWeekdays();
  if(Object.prototype.hasOwnProperty.call(o,'id:'+staffId)) return o['id:'+staffId];
  const low=(name||'').toLowerCase();
  for(const k of Object.keys(DEFAULT_REST_WEEKDAY)){ if(low.includes(k)) return DEFAULT_REST_WEEKDAY[k]; }
  return null;
}
function isRestDayOn(staffId, name, dateStr, shiftEndHour){
  if(shiftEndHour===0) return true; // permanent rest set in Staff directory
  const d=restWeekdayForStaff(staffId, name);
  if(d==null) return false;
  const dt=new Date(dateStr+'T00:00:00');
  return dt.getDay()===d;
}

function renderTeamOverview(el){
  if(!state.checklistDate) state.checklistDate = todayStr();
  const bar = document.createElement('div'); bar.className='toolbar'; bar.style.marginBottom='16px';
  const dateInput = document.createElement('input'); dateInput.type='date'; dateInput.value=state.checklistDate;
  dateInput.onchange = ()=>{ state.checklistDate = dateInput.value || todayStr(); state.checkSummary=null; render(); };
  bar.appendChild(dateInput);
  const teamExBtn = document.createElement('button'); teamExBtn.className='btn'; teamExBtn.textContent='Export to Excel';
  teamExBtn.onclick = ()=>{
    if(!state.checkSummary || !state.checkSummary.perStaff || !state.checkSummary.perStaff.length){ alert('Nothing to export yet.'); return; }
    const shiftLbl = (h)=> h===0 ? 'Rest day' : ((h>12?(h-12):h) + ':00 ' + (h>=12?'PM':'AM'));
    const rows = state.checkSummary.perStaff.map(p=>({
      'Date': state.checkSummary.date,
      'Employee': p.name,
      'Shift end': shiftLbl(p.shiftEndHour!=null?p.shiftEndHour:15),
      'Daily done': p.dailyDone,
      'Daily total': p.dailyTotal,
      'Daily open': p.dailyOpen!=null ? p.dailyOpen : (p.dailyTotal-p.dailyDone-p.dailySkipped),
      'Daily skipped': p.dailySkipped,
      'Daily %': p.dailyTotal ? Math.round(p.dailyDone/p.dailyTotal*100)+'%' : '',
      'Weekly done': p.weeklyDone,
      'Weekly total': p.weeklyTotal,
      'Last completed': p.lastUpdate ? fmtDateTime(p.lastUpdate) : '',
      'Escalated': p.escalated ? 'YES' : '',
    }));
    exportRowsToExcel(rows, 'Team overview', 'roshan-team-tasks');
  };
  bar.appendChild(teamExBtn);
  el.appendChild(bar);

  if(!state.checkSummary || state.checkSummary.date !== state.checklistDate){
    const loading = document.createElement('div'); loading.className='empty'; loading.textContent='Loading team summary…';
    el.appendChild(loading);
    loadCheckSummary(state.checklistDate, null).then(()=>render()).catch(e=>{ loading.textContent=e.message; });
    return;
  }

  const date = state.checklistDate;
  const per = state.checkSummary.perStaff.filter(p=>{ const s=(state.staff||[]).find(x=>x.id===p.staffId); return !s || s.active!==false; });
  if(!per.length){ const e=document.createElement('div'); e.className='empty'; e.textContent='No staff have checklist templates yet. Use "Manage templates" to set them up.'; el.appendChild(e); return; }
  const isRest = (p)=>isRestDayOn(p.staffId, p.name, date, p.shiftEndHour);
  const working = per.filter(p=>!isRest(p));

  // Escalation alert: admins who still had open daily tasks after shift end (rest days excluded).
  const escalatedStaff = per.filter(p=>p.escalated && !isRest(p));
  if(escalatedStaff.length){
    const shiftLabel = (h)=> h===0 ? 'rest day' : ((h>12?(h-12):h) + ':00 ' + (h>=12?'PM':'AM'));
    const alert = document.createElement('div'); alert.className='notice err';
    const names = escalatedStaff.map(p=>escapeHtml(p.name)+' — '+p.dailyOpen+' open, shift ended '+shiftLabel(p.shiftEndHour)).join('; ');
    alert.innerHTML = '<strong>Task escalation:</strong> ' +
      escalatedStaff.length + ' staff passed their shift end with open daily tasks: ' + names + '.';
    el.appendChild(alert);
  } else if(state.checkSummary.cutoffPassed){
    const ok = document.createElement('div'); ok.className='notice';
    ok.textContent = 'All staff completed (or skipped) their daily tasks before the deadline. No escalations.';
    el.appendChild(ok);
  }

  const totalDone = working.reduce((s,p)=>s+p.dailyDone,0);
  const totalAll = working.reduce((s,p)=>s+p.dailyTotal,0);
  const fullyDone = working.filter(p=>p.dailyTotal>0 && p.dailyDone===p.dailyTotal).length;
  const notStarted = working.filter(p=>p.dailyDone===0 && p.dailyTotal>0).length;
  const restCount = per.length - working.length;
  const metrics = document.createElement('div'); metrics.className='metrics';
  metrics.innerHTML = `
    <div class="metric"><div class="num">${totalAll?Math.round(totalDone/totalAll*100):0}%</div><div class="lbl">Team daily completion</div></div>
    <div class="metric good"><div class="num">${fullyDone}</div><div class="lbl">Staff fully done today</div></div>
    <div class="metric ${notStarted>0?'flag':''}"><div class="num">${notStarted}</div><div class="lbl">Staff not started</div></div>
    <div class="metric"><div class="num">${restCount}</div><div class="lbl">On rest day</div></div>
  `;
  el.appendChild(metrics);

  const card = document.createElement('div'); card.className='card';
  const scroll = document.createElement('div'); scroll.style.cssText='overflow-x:auto;';
  const table = document.createElement('table'); table.className='simple';
  table.innerHTML = '<thead><tr><th>Employee</th><th>Shift end</th><th>Daily tasks</th><th>Progress</th><th>Weekly tasks</th><th>Last completed</th><th></th></tr></thead>';
  const tbody = document.createElement('tbody');
  const shiftLbl = (h)=> h===0 ? 'Rest day' : ((h>12?(h-12):h) + ':00 ' + (h>=12?'PM':'AM'));
  per.sort((a,b)=>{
    const ra=isRest(a)?1:0, rb=isRest(b)?1:0; if(ra!==rb) return ra-rb; // rest days last
    return (b.dailyTotal?b.dailyDone/b.dailyTotal:0) - (a.dailyTotal?a.dailyDone/a.dailyTotal:0);
  });
  per.forEach(p=>{
    const rest = isRest(p);
    const pct = p.dailyTotal ? Math.round(p.dailyDone/p.dailyTotal*100) : 0;
    const tr = document.createElement('tr');
    if(rest){
      const wd = restWeekdayForStaff(p.staffId, p.name);
      const restLbl = (p.shiftEndHour===0 || wd==null) ? 'Rest day' : ('Rest day · '+WEEKDAY_NAMES[wd]);
      tr.innerHTML = `
        <td>${escapeHtml(p.name)}</td>
        <td class="hint">${restLbl}</td>
        <td><span class="badge neutral">Rest day</span></td>
        <td class="hint">—</td>
        <td class="hint">—</td>
        <td>${p.lastUpdate?fmtDateTime(p.lastUpdate):'—'}</td>`;
    } else {
      tr.innerHTML = `
        <td>${escapeHtml(p.name)}${p.escalated?' <span class="badge flag">escalated</span>':''}</td>
        <td class="hint">${shiftLbl(p.shiftEndHour!=null?p.shiftEndHour:15)}</td>
        <td>${p.dailyDone}/${p.dailyTotal}${p.dailySkipped?' <span class="hint">('+p.dailySkipped+' skipped)</span>':''}</td>
        <td style="min-width:140px;"><div class="bt" style="height:8px;"><div class="bf" style="width:${pct}%;${pct===100?'background:var(--lime);':''}"></div></div></td>
        <td>${p.weeklyDone}/${p.weeklyTotal}</td>
        <td>${p.lastUpdate?fmtDateTime(p.lastUpdate):'—'}</td>`;
    }
    const td = document.createElement('td');
    const b = document.createElement('button'); b.className='btn sm'; b.textContent='Open checklist';
    b.onclick = ()=>{ state.checklistStaff = p.staffId; state.checklist=null; state.tasksTab='checklist'; render(); };
    td.appendChild(b); tr.appendChild(td);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  scroll.appendChild(table);
  card.appendChild(scroll);
  el.appendChild(card);

  // Weekly rest-day editor (Super Admin).
  const rcard = document.createElement('div'); rcard.className='card';
  rcard.innerHTML = '<h2 style="font-size:14px;color:#ffffff;margin-bottom:6px;">Weekly rest days</h2>'
    + '<div class="hint" style="margin-bottom:10px;">Set each person\u2019s day off. On that weekday their checklist won\u2019t count as incomplete or escalate here. Saved in this browser. (A permanent day off and shift-end times are set in Staff directory.)</div>';
  const rtbl = document.createElement('table'); rtbl.className='simple'; rtbl.style.width='100%';
  rtbl.innerHTML = '<thead><tr><th>Employee</th><th>Day off</th></tr></thead>';
  const rtb = document.createElement('tbody');
  per.forEach(p=>{
    const tr=document.createElement('tr');
    const cur = restWeekdayForStaff(p.staffId, p.name);
    const sel=document.createElement('select'); sel.style.cssText='font-size:12px;padding:4px 6px;';
    sel.innerHTML = '<option value="">None</option>' + WEEKDAY_NAMES.map((w,i)=>`<option value="${i}" ${cur===i?'selected':''}>${w}</option>`).join('');
    sel.onchange=()=>{ saveRestWeekday(p.staffId, sel.value===''?null:sel.value); render(); };
    const td1=document.createElement('td'); td1.textContent=p.name;
    const td2=document.createElement('td'); td2.appendChild(sel);
    tr.appendChild(td1); tr.appendChild(td2); rtb.appendChild(tr);
  });
  rtbl.appendChild(rtb); rcard.appendChild(rtbl); el.appendChild(rcard);
}

function renderTemplatesView(el){
  if(!state.templates){
    const loading = document.createElement('div'); loading.className='empty'; loading.textContent='Loading templates…';
    el.appendChild(loading);
    apiGet('/api/templates').then(data=>{ state.templates = data.templates||[]; render(); }).catch(e=>{ loading.textContent=e.message; });
    return;
  }

  if(state.templatesCopyMsg){
    const ok = document.createElement('div'); ok.className='notice';
    ok.textContent = state.templatesCopyMsg;
    el.appendChild(ok);
    state.templatesCopyMsg = null;
  }
  const note = document.createElement('div'); note.className='notice';
  note.textContent = "These recurring tasks generate each person's daily and weekly checklist automatically. Edits apply from today onward — past days keep the checklist they were given.";
  el.appendChild(note);

  // --- Copy a checklist from one person to another ---
  const copyCard = document.createElement('div'); copyCard.className='card';
  const staffOptions = state.staff.filter(s=>s.active!==false).map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  copyCard.innerHTML = `
    <h2 style="font-size:13px;color:var(--ink-1);margin-bottom:12px;">Copy a checklist</h2>
    <div class="hint" style="margin-bottom:10px;">Copies all of one person's active daily and weekly tasks to another — e.g. when a new admin takes the same role. Tasks the target already has are skipped, so nothing gets duplicated.</div>
    <div class="form-grid">
      <div class="field"><label>Copy from</label><select id="cp-from">${staffOptions}</select></div>
      <div class="field"><label>Copy to</label><select id="cp-to">${staffOptions}</select></div>
    </div>
    <div id="cp-result"></div>
  `;
  const copyRow = document.createElement('div'); copyRow.className='action-row';
  const copyBtn = document.createElement('button'); copyBtn.className='btn primary'; copyBtn.textContent='Copy checklist';
  copyBtn.onclick = async ()=>{
    const fromStaffId = document.getElementById('cp-from').value;
    const toStaffId = document.getElementById('cp-to').value;
    const resEl = document.getElementById('cp-result'); resEl.innerHTML='';
    if(fromStaffId === toStaffId){ resEl.innerHTML='<div class="notice err">Choose two different people.</div>'; return; }
    const fromName = (state.staff.find(s=>s.id===fromStaffId)||{}).name || 'source';
    const toName = (state.staff.find(s=>s.id===toStaffId)||{}).name || 'target';
    if(!confirm('Copy all of ' + fromName + "'s active checklist tasks to " + toName + '? Tasks ' + toName + ' already has will be skipped.')) return;
    copyBtn.disabled=true; copyBtn.textContent='Copying…';
    try{
      const r = await apiPost('/api/templates/copy', {fromStaffId, toStaffId});
      state.templatesCopyMsg = r.message || ('Copied ' + r.copied + ' task' + (r.copied===1?'':'s') + ' to ' + toName + (r.skipped?(' — ' + r.skipped + ' skipped (already on their list)'):'') + '.');
      state.templates = null; // force reload so the new list shows below
      render();
    }catch(e){ resEl.innerHTML='<div class="notice err">'+escapeHtml(e.message)+'</div>'; copyBtn.disabled=false; copyBtn.textContent='Copy checklist'; }
  };
  copyRow.appendChild(copyBtn);
  copyCard.appendChild(copyRow);
  el.appendChild(copyCard);

  const addCard = document.createElement('div'); addCard.className='card';
  addCard.innerHTML = `
    <h2 style="font-size:13px;color:var(--ink-1);margin-bottom:12px;">Add a task</h2>
    <div class="form-grid">
      <div class="field"><label>Employee</label><select id="tpl-staff">${state.staff.filter(s=>s.active!==false).map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Frequency</label><select id="tpl-freq"><option>Daily</option><option>Weekly</option></select></div>
      <div class="field full"><label>Task</label><input id="tpl-title" placeholder="e.g. Send inventory to GC"></div>
      <div class="field"><label>Section (optional)</label><input id="tpl-section" placeholder="e.g. Closing Tasks"></div>
      <div class="field"><label>Category (optional)</label><input id="tpl-category" placeholder="e.g. Admin"></div>
    </div>
    <div id="tpl-error"></div>
  `;
  const addRow = document.createElement('div'); addRow.className='action-row';
  const addBtn = document.createElement('button'); addBtn.className='btn primary'; addBtn.textContent='Add task';
  addBtn.onclick = async ()=>{
    const staffId = document.getElementById('tpl-staff').value;
    const frequency = document.getElementById('tpl-freq').value;
    const title = document.getElementById('tpl-title').value.trim();
    const section = document.getElementById('tpl-section').value.trim();
    const category = document.getElementById('tpl-category').value.trim();
    const errEl = document.getElementById('tpl-error'); errEl.innerHTML='';
    if(!title){ errEl.innerHTML='<div class="notice err">Enter the task description.</div>'; return; }
    addBtn.disabled=true; addBtn.textContent='Saving…';
    try{
      const {template} = await apiPost('/api/templates', {staffId, frequency, title, section, category});
      state.templates.push(template);
      render();
    }catch(e){ errEl.innerHTML=`<div class="notice err">${escapeHtml(e.message)}</div>`; addBtn.disabled=false; addBtn.textContent='Add task'; }
  };
  addRow.appendChild(addBtn);
  addCard.appendChild(addRow);
  el.appendChild(addCard);

  const byStaff = {};
  state.templates.filter(t=>t.active!==false).forEach(t=>{ (byStaff[t.assignee] = byStaff[t.assignee]||[]).push(t); });
  Object.keys(byStaff).sort().forEach(name=>{
    const list = byStaff[name].sort((a,b)=> (a.frequency===b.frequency ? (a.sort_order-b.sort_order) : a.frequency==='Daily'?-1:1));
    const h = document.createElement('div'); h.className='section-head';
    h.innerHTML = `<h2>${escapeHtml(name)} <span class="hint" style="text-transform:none;letter-spacing:0;">(${list.filter(t=>t.frequency==='Daily').length} daily · ${list.filter(t=>t.frequency==='Weekly').length} weekly)</span></h2>`;
    el.appendChild(h);
    const card = document.createElement('div'); card.className='card';
    const scroll = document.createElement('div'); scroll.style.cssText='overflow-x:auto;';
    const table = document.createElement('table'); table.className='simple';
    table.innerHTML = '<thead><tr><th>Task</th><th>Freq</th><th>Section</th><th>Category</th><th></th></tr></thead>';
    const tbody = document.createElement('tbody');
    list.forEach(t=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHtml(t.title)}</td><td>${t.frequency}</td><td class="hint">${escapeHtml(t.section||'—')}</td><td class="hint">${escapeHtml(t.category||'—')}</td>`;
      const td = document.createElement('td');
      const rm = document.createElement('button'); rm.className='btn sm'; rm.textContent='Remove';
      rm.onclick = async ()=>{
        if(!confirm('Remove this task from ' + name + "'s checklist from today onward?")) return;
        try{ await apiPatch(`/api/templates/${t.id}`, {active:false}); t.active=false; render(); }
        catch(e){ alert(e.message); }
      };
      td.appendChild(rm); tr.appendChild(td);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    scroll.appendChild(table);
    card.appendChild(scroll);
    el.appendChild(card);
  });
}

function renderAdhocTasks(el){
  const assignees = Array.from(new Set(state.tasks.flatMap(t=>String(t.assignee||'').split(',').map(s=>s.trim())))).filter(Boolean).sort();
  const todays = state.tasks.filter(t=>t.date===todayStr());
  const doneToday = todays.filter(t=>t.status==='Done').length;
  const overdue = state.tasks.filter(t=>t.status!=='Done' && (t.dueDate||t.date) < todayStr()).length;

  const metrics = document.createElement('div');
  metrics.className = 'metrics';
  metrics.innerHTML = `
    <div class="metric"><div class="num">${todays.length}</div><div class="lbl">Tasks today</div></div>
    <div class="metric good"><div class="num">${doneToday}</div><div class="lbl">Completed today</div></div>
    <div class="metric ${overdue>0?'flag':''}"><div class="num">${overdue}</div><div class="lbl">Overdue</div></div>
    <div class="metric"><div class="num">${assignees.length}</div><div class="lbl">Staff logging tasks</div></div>
  `;
  el.appendChild(metrics);

  const head = document.createElement('div');
  head.className = 'section-head';
  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';
  toolbar.innerHTML = `
    <input type="date" id="task-date-filter" value="${state.taskFilterDate}">
    <select id="task-assignee-filter">
      <option value="All">All staff</option>
      ${assignees.map(a=>`<option value="${escapeHtml(a)}" ${state.taskFilterAssignee===a?'selected':''}>${escapeHtml(a)}</option>`).join('')}
    </select>
  `;
  head.innerHTML = '<h2>Task log</h2>';
  head.appendChild(toolbar);
  const adhocExBtn=document.createElement('button'); adhocExBtn.className='btn'; adhocExBtn.textContent='Export to Excel';
  adhocExBtn.onclick=()=>{
    const rows = state.tasks
      .slice()
      .sort((a,b)=> (b.date||'').localeCompare(a.date||''))
      .map(t=>({
        'Task #': t.id,
        'Start date': t.date,
        'Due date': t.dueDate||'',
        'Task': t.title,
        'Owner(s)': t.assignee||'',
        'Status': t.status,
        'Notes': t.notes||'',
        'Assigned by': t.createdBy||'',
        'Completed by': t.completedBy||'',
        'Completed at': t.completedAt ? fmtDateTime(t.completedAt) : '',
      }));
    exportRowsToExcel(rows, 'Ad-hoc tasks', 'roshan-adhoc-tasks');
  };
  toolbar.appendChild(adhocExBtn);
  {
    const addBtn = document.createElement('button');
    addBtn.className = 'btn primary';
    addBtn.textContent = '+ New task';
    addBtn.onclick = ()=>{ state.modal={type:'newTask'}; render(); };
    toolbar.appendChild(addBtn);
  }
  el.appendChild(head);

  toolbar.querySelector('#task-date-filter').onchange = (e)=>{ state.taskFilterDate = e.target.value; renderContent(); };
  toolbar.querySelector('#task-assignee-filter').onchange = (e)=>{ state.taskFilterAssignee = e.target.value; renderContent(); };

  let list = state.tasks.filter(t=> !state.taskFilterDate || (t.date <= state.taskFilterDate && state.taskFilterDate <= (t.dueDate||t.date)));
  if(state.taskFilterAssignee!=='All') list = list.filter(t=>String(t.assignee||'').split(',').map(s=>s.trim()).includes(state.taskFilterAssignee));
  list = [...list].sort((a,b)=> (a.status==='Done')-(b.status==='Done') || a.assignee.localeCompare(b.assignee));

  if(list.length===0){
    const e = document.createElement('div'); e.className='empty'; e.textContent = 'No tasks logged for this filter yet.';
    el.appendChild(e);
    return;
  }

  list.forEach(t=>{
    const card = document.createElement('div');
    card.className = 'card';
    const pillClass = t.status==='Done' ? 'done' : t.status==='In progress' ? 'progress' : 'todo';
    const owners = String(t.assignee||'').split(',').map(s=>s.trim()).filter(Boolean);
    const isOverdue = t.dueDate && t.status!=='Done' && t.dueDate < todayStr();
    card.innerHTML = `
      <div class="req-top">
        <div style="flex:1;min-width:0;">
          <div class="req-title">${escapeHtml(t.title)}</div>
          <div class="req-sub">
            <strong>${owners.length>1?'Owners':'Owner'}:</strong> ${escapeHtml(owners.join(', ')||'—')}
            &middot; <strong>Assigned by:</strong> ${escapeHtml(t.createdBy||'—')}
          </div>
          <div class="req-sub">
            ${fmtDate(t.date)}${t.dueDate ? ' &rarr; due ' + fmtDate(t.dueDate) : ''}${isOverdue ? ' <span class="badge flag">overdue</span>' : ''}${t.status==='Done'&&t.completedBy ? ' &middot; done by ' + escapeHtml(t.completedBy) : ''}${t.notes ? ' &middot; ' + escapeHtml(t.notes) : ''}
          </div>
        </div>
        <span class="status-pill ${pillClass}">${t.status}</span>
      </div>
    `;
    {
      const row = document.createElement('div');
      row.className = 'action-row';
      if(t.status!=='In progress' && t.status!=='Done'){
        const b = document.createElement('button'); b.className='btn sm'; b.textContent='Mark in progress';
        b.onclick = async ()=>{ try{ const {task}=await apiPatch(`/api/tasks/${t.id}`, {status:'In progress'}); Object.assign(t, mapTask(task)); render(); }catch(e){ alert(e.message); } };
        row.appendChild(b);
      }
      if(t.status!=='Done'){
        const b = document.createElement('button'); b.className='btn sm primary'; b.textContent='Mark done';
        b.onclick = async ()=>{ try{ const {task}=await apiPatch(`/api/tasks/${t.id}`, {status:'Done'}); Object.assign(t, mapTask(task)); render(); }catch(e){ alert(e.message); } };
        row.appendChild(b);
      }
      if(t.status==='Done'){
        const b = document.createElement('button'); b.className='btn sm ghost'; b.textContent='Reopen';
        b.onclick = async ()=>{ try{ const {task}=await apiPatch(`/api/tasks/${t.id}`, {status:'To do'}); Object.assign(t, mapTask(task)); render(); }catch(e){ alert(e.message); } };
        row.appendChild(b);
      }
      const ed = document.createElement('button'); ed.className='btn sm'; ed.textContent='Edit';
      ed.onclick = ()=>{ state.modal={type:'editTask', id:t.id}; render(); };
      row.appendChild(ed);
      const del = document.createElement('button'); del.className='btn sm ghost'; del.textContent='Delete';
      del.onclick = async ()=>{
        if(!confirm('Delete this task?\n\n"' + t.title + '"\n\nThis cannot be undone.')) return;
        try{
          await apiDelete(`/api/tasks/${t.id}`);
          state.tasks = state.tasks.filter(x=>x.id!==t.id);
          render();
        }catch(e){ alert(e.message); }
      };
      row.appendChild(del);
      card.appendChild(row);
    }
    el.appendChild(card);
  });
}

function renderEditTaskModal(modal){
  const t = state.tasks.find(x=>x.id===state.modal.id);
  if(!t){ state.modal=null; return; }
  const head = document.createElement('div'); head.className='modal-head';
  head.innerHTML = '<h2 style="font-size:16px;">Edit task</h2>'; head.appendChild(closeBtn());
  modal.appendChild(head);
  const wrap = document.createElement('div');
  const activeStaff = (state.staff||[]).filter(s=>s.active!==false);
  const current = String(t.assignee||'').split(',').map(s=>s.trim()).filter(Boolean);
  // Keep any owner who is no longer in the active staff list so editing
  // doesn't silently drop them.
  const extra = current.filter(n=>!activeStaff.some(s=>s.name===n));
  const checkList = [...activeStaff.map(s=>s.name), ...extra];
  wrap.innerHTML = `
    <div class="hint" style="margin-bottom:12px;">Assigned by ${escapeHtml(t.createdBy||'—')} &middot; task ${escapeHtml(t.id)}</div>
    <div class="field"><label>Task</label><input id="e-title" value="${escapeHtml(t.title)}"></div>
    <div class="field full"><label>Assigned to</label>
      <div id="e-assignees" style="display:flex;flex-wrap:wrap;gap:10px 16px;max-height:150px;overflow-y:auto;padding:10px 12px;border:1px solid var(--line);border-radius:8px;">
        ${checkList.map(n=>`<label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--ink-0);cursor:pointer;">
          <input type="checkbox" class="e-assignee-cb" value="${escapeHtml(n)}" ${current.includes(n)?'checked':''}> ${escapeHtml(n)}
        </label>`).join('')}
      </div>
    </div>
    <div class="form-grid">
      <div class="field"><label>Start date</label><input id="e-date" type="date" value="${t.date||todayStr()}"></div>
      <div class="field"><label>Due date</label><input id="e-due" type="date" value="${t.dueDate||t.date||todayStr()}"></div>
    </div>
    <div class="field"><label>Notes</label><input id="e-notes" value="${escapeHtml(t.notes||'')}" placeholder="Any detail worth logging"></div>
    <div id="e-error"></div>
  `;
  modal.appendChild(wrap);
  const row = document.createElement('div'); row.className='action-row';
  const b = document.createElement('button'); b.className='btn primary'; b.textContent='Save changes';
  b.onclick = async ()=>{
    const title = document.getElementById('e-title').value.trim();
    const owners = [...document.querySelectorAll('.e-assignee-cb')].filter(c=>c.checked).map(c=>c.value);
    const date = document.getElementById('e-date').value || t.date;
    const dueDate = document.getElementById('e-due').value || date;
    const notes = document.getElementById('e-notes').value.trim();
    const errEl = document.getElementById('e-error'); errEl.innerHTML='';
    if(!title){ errEl.innerHTML='<div class="notice err">The task description cannot be empty.</div>'; return; }
    if(!owners.length){ errEl.innerHTML='<div class="notice err">Tick at least one owner.</div>'; return; }
    if(dueDate < date){ errEl.innerHTML='<div class="notice err">The due date cannot be before the start date.</div>'; return; }
    b.disabled=true; b.textContent='Saving…';
    try{
      const {task} = await apiPatch(`/api/tasks/${t.id}`, {title, assignee:owners.join(', '), date, dueDate, notes});
      Object.assign(t, mapTask(task));
      state.modal=null; render();
    }catch(e){ errEl.innerHTML = `<div class="notice err">${escapeHtml(e.message)}</div>`; b.disabled=false; b.textContent='Save changes'; }
  };
  row.appendChild(b); modal.appendChild(row);
}

function renderNewTaskModal(modal){
  const head = document.createElement('div'); head.className='modal-head';
  head.innerHTML = '<h2 style="font-size:16px;">New task</h2>'; head.appendChild(closeBtn());
  modal.appendChild(head);
  const wrap = document.createElement('div');
  const activeStaff = (state.staff||[]).filter(s=>s.active!==false);
  const staffChecks = activeStaff.length
    ? `<div id="t-assignees" style="display:flex;flex-wrap:wrap;gap:10px 16px;max-height:150px;overflow-y:auto;padding:10px 12px;border:1px solid var(--line);border-radius:8px;">
        ${activeStaff.map(s=>`<label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--ink-0);cursor:pointer;">
          <input type="checkbox" class="t-assignee-cb" value="${escapeHtml(s.name)}"> ${escapeHtml(s.name)}
        </label>`).join('')}
      </div>
      <div class="hint" style="margin-top:6px;">Tick everyone responsible — they share one task between them.</div>`
    : `<input id="t-assignee-free" placeholder="Staff name">`;
  wrap.innerHTML = `
    <div class="field"><label>Task</label><input id="t-title" placeholder="e.g. Restock front desk supplies"></div>
    <div class="field full"><label>Assigned to</label>${staffChecks}</div>
    <div class="form-grid">
      <div class="field"><label>Start date</label><input id="t-date" type="date" value="${todayStr()}"></div>
      <div class="field"><label>Due date (target completion)</label><input id="t-due" type="date" value="${todayStr()}"></div>
    </div>
    <div class="field"><label>Notes (optional)</label><input id="t-notes" placeholder="Any detail worth logging"></div>
    <div id="t-error"></div>
  `;
  modal.appendChild(wrap);
  const row = document.createElement('div'); row.className='action-row';
  const b = document.createElement('button'); b.className='btn primary'; b.textContent='Add task';
  b.onclick = async ()=>{
    const title = document.getElementById('t-title').value.trim();
    const freeEl = document.getElementById('t-assignee-free');
    const assignees = freeEl
      ? (freeEl.value.trim() ? [freeEl.value.trim()] : [])
      : [...document.querySelectorAll('.t-assignee-cb')].filter(c=>c.checked).map(c=>c.value);
    const date = document.getElementById('t-date').value || todayStr();
    const dueDate = document.getElementById('t-due').value || date;
    const notes = document.getElementById('t-notes').value.trim();
    const errEl = document.getElementById('t-error');
    if(!title){ errEl.innerHTML = '<div class="notice err">Add a task description.</div>'; return; }
    if(!assignees.length){ errEl.innerHTML = '<div class="notice err">Tick at least one person to assign this task to.</div>'; return; }
    if(dueDate < date){ errEl.innerHTML = '<div class="notice err">The due date cannot be before the start date.</div>'; return; }
    b.disabled=true; b.textContent='Saving…';
    try{
      // One task, however many owners — they share the single line item.
      const {task} = await apiPost('/api/tasks', {title, assignee: assignees.join(', '), date, dueDate, notes});
      state.tasks.unshift(mapTask(task));
      state.modal = null; render();
    }catch(e){
      errEl.innerHTML = `<div class="notice err">${escapeHtml(e.message)}</div>`;
      b.disabled=false; b.textContent='Add task';
    }
  };
  row.appendChild(b); modal.appendChild(row);
}

// Free-text search across a request's fields (used by PO, Petty Cash, and the tracker).
function requestSearchText(r){
  const parts=[r.id, r.title, r.payee, r.supplier, r.requestor, r.createdBy, r.notes, r.branch, r.status,
    (r.type==='PO'?'purchase order':'petty cash'), String(r.amount), r.paymentMethod,
    r.check&&r.check.number, r.check&&r.check.bank, r.delivery&&r.delivery.receiptNo, r.pos&&r.pos.reference];
  (r.lineItems||[]).forEach(li=>parts.push(li.item||li.name||li.description||li.desc));
  return parts.filter(Boolean).join(' ').toLowerCase();
}
function requestMatchesQuery(searchText, q){
  const toks=(q||'').trim().toLowerCase().split(/\s+/).filter(Boolean);
  return toks.every(t=>searchText.includes(t));
}

// ============ PURCHASE ORDERS / PETTY CASH (shared engine) ============
function computeReqMetrics(type){
  const reqs = activeRequests().filter(r=>r.type===type);
  const pendingApproval = reqs.filter(r=>r.status==='Pending Approval').length;
  const awaitingCheck = reqs.filter(r=>r.status==='Approved').length;
  const outstanding = reqs.filter(r=>r.status!=='Recorded in POS' && r.status!=='Rejected').reduce((s,r)=>s+Number(r.amount||0),0);
  const trackedChecks = reqs.filter(r=>r.check && r.check.number).length;
  return {pendingApproval, awaitingCheck, outstanding, trackedChecks};
}

function renderRequestsSection(el, type){
  const m = computeReqMetrics(type);
  const metrics = document.createElement('div');
  metrics.className = 'metrics';
  metrics.innerHTML = `
    <div class="metric ${m.pendingApproval>0?'flag':''}"><div class="num">${m.pendingApproval}</div><div class="lbl">Awaiting approval</div></div>
    <div class="metric"><div class="num">${m.awaitingCheck}</div><div class="lbl">Awaiting payment prep</div></div>
    <div class="metric"><div class="num">${fmtMoney(m.outstanding).replace('PHP ','')}</div><div class="lbl">Outstanding (PHP)</div></div>
    <div class="metric good"><div class="num">${m.trackedChecks}</div><div class="lbl">Checks tracked, no gaps</div></div>
  `;
  el.appendChild(metrics);

  const head = document.createElement('div'); head.className='section-head';
  head.innerHTML = `<h2>${type==='PO'?'Purchase orders':'Reimbursement requests'}</h2>`;
  const btnGroup = document.createElement('div'); btnGroup.className='toolbar';
  if(!state.reqSearch) state.reqSearch = {PO:'', PettyCash:''};
  const searchInput = document.createElement('input');
  searchInput.type='search'; searchInput.placeholder='Search ' + (type==='PO'?'purchase orders':'petty cash') + '\u2026';
  searchInput.value = state.reqSearch[type] || ''; searchInput.style.minWidth='220px';
  btnGroup.appendChild(searchInput);
  if(type==='PO'){
    const supBtn = document.createElement('button'); supBtn.className='btn'; supBtn.textContent='Suppliers directory';
    supBtn.onclick = ()=>{ state.modal = {type:'suppliers'}; render(); };
    btnGroup.appendChild(supBtn);
    const priceBtn = document.createElement('button'); priceBtn.className='btn'; priceBtn.textContent='Manage pricelist';
    priceBtn.onclick = ()=>{ state.modal = {type:'pricelist'}; render(); };
    btnGroup.appendChild(priceBtn);
  }
  // Status filter — labels follow the request type (a check for a PO is a
  // cash release for petty cash), but both map to the same stage keys.
  if(!state.reqStatusFilter) state.reqStatusFilter = {PO:'All', PettyCash:'All'};
  const statusFilter = state.reqStatusFilter[type] || 'All';
  const allOfType = activeRequests().filter(r=>r.type===type);
  const countFor = (key)=> allOfType.filter(r=>r.status===key).length;
  const statusSel = document.createElement('select');
  statusSel.innerHTML = [
    `<option value="All" ${statusFilter==='All'?'selected':''}>All statuses (${allOfType.length})</option>`,
    ...STAGES.map((s,i)=>`<option value="${s.key}" ${statusFilter===s.key?'selected':''}>${stageShort(type,i)} (${countFor(s.key)})</option>`),
    `<option value="Rejected" ${statusFilter==='Rejected'?'selected':''}>Rejected (${countFor('Rejected')})</option>`,
  ].join('');
  statusSel.onchange = ()=>{ state.reqStatusFilter[type] = statusSel.value; render(); };
  btnGroup.appendChild(statusSel);

  // Date range (by request creation date)
  const rFrom = ()=> (state.reqDateFrom[type]||''), rTo = ()=> (state.reqDateTo[type]||'');
  const rangeCtl = dateRangeControl(rFrom, rTo, (f,t)=>{ state.reqDateFrom[type]=f; state.reqDateTo[type]=t; render(); });
  btnGroup.appendChild(rangeCtl);
  const inRange = (r)=> inDateRange(r.createdAt, rFrom(), rTo());

  // Requestor filter — built from who actually has requests of this type
  if(!state.reqRequestor) state.reqRequestor = {PO:'All', PettyCash:'All'};
  const requestorOf = (r)=> (r.requestor || r.createdBy || '').trim();
  const requestors = [...new Set(allOfType.map(requestorOf).filter(Boolean))].sort();
  const reqFilter = state.reqRequestor[type] || 'All';
  const reqSel = document.createElement('select');
  reqSel.innerHTML = [`<option value="All" ${reqFilter==='All'?'selected':''}>All requestors</option>`,
    ...requestors.map(n=>`<option value="${escapeHtml(n)}" ${reqFilter===n?'selected':''}>${escapeHtml(n)}</option>`)].join('');
  reqSel.onchange = ()=>{ state.reqRequestor[type] = reqSel.value; render(); };
  btnGroup.appendChild(reqSel);
  const matchesRequestor = (r)=> reqFilter==='All' || requestorOf(r)===reqFilter;

  const exportBtn = document.createElement('button'); exportBtn.className='btn'; exportBtn.textContent='Export to Excel';
  exportBtn.onclick = ()=>{
    const list = allOfType
      .filter(r=>statusFilter==='All' || r.status===statusFilter)
      .filter(inRange).filter(matchesRequestor)
      .sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt));
    const suffix = statusFilter==='All' ? '' : '-' + statusFilter.toLowerCase().replace(/[^a-z0-9]+/g,'-');
    exportRequestsToExcel(list, type==='PO'?'Purchase Orders':'Petty Cash', (type==='PO'?'roshan-purchase-orders':'roshan-petty-cash') + suffix);
  };
  btnGroup.appendChild(exportBtn);
  if(curRole()==='Admin'){
    const b = document.createElement('button'); b.className='btn primary';
    b.textContent = type==='PO' ? '+ New purchase order' : '+ New reimbursement';
    b.onclick = ()=>{ state.modal = {type:'newRequest', reqType:type}; render(); };
    btnGroup.appendChild(b);
  }
  head.appendChild(btnGroup);
  el.appendChild(head);

  const list = allOfType
    .filter(r=>statusFilter==='All' || r.status===statusFilter)
    .filter(inRange).filter(matchesRequestor)
    .sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt));
  if(list.length===0){
    const e = document.createElement('div'); e.className='empty';
    if(reqFilter!=='All'){
      e.textContent = 'No ' + (type==='PO'?'purchase orders':'reimbursement requests') + ' from ' + reqFilter + (rFrom()||rTo()?' in that date range':'') + '.';
    } else if(rFrom()||rTo()){
      e.textContent = 'No ' + (type==='PO'?'purchase orders':'reimbursement requests') + ' in the selected date range.';
    } else if(statusFilter!=='All'){
      const idx = STAGES.findIndex(s=>s.key===statusFilter);
      const label = statusFilter==='Rejected' ? 'rejected' : stageShort(type, idx).toLowerCase();
      e.textContent = 'No ' + (type==='PO'?'purchase orders':'reimbursement requests') + ' at "' + label + '" right now.';
    } else {
      e.textContent = type==='PO' ? 'No purchase orders yet.' : 'No reimbursement requests yet.';
    }
    el.appendChild(e); return;
  }
  const listWrap = document.createElement('div'); el.appendChild(listWrap);
  list.forEach(r=>{ const c=renderReqCard(r); c.dataset.search=requestSearchText(r); listWrap.appendChild(c); });
  const noMatch = document.createElement('div'); noMatch.className='empty'; noMatch.textContent='No matches for your search.'; noMatch.style.display='none'; el.appendChild(noMatch);
  const applyReqSearch = ()=>{ const q=searchInput.value||''; let shown=0;
    [...listWrap.children].forEach(c=>{ const ok=requestMatchesQuery(c.dataset.search||'', q); c.style.display=ok?'':'none'; if(ok)shown++; });
    noMatch.style.display=shown?'none':''; };
  searchInput.oninput=()=>{ state.reqSearch[type]=searchInput.value; applyReqSearch(); };
  applyReqSearch();
}

function renderReqCard(r){
  const card = document.createElement('div'); card.className='card row-card';
  card.onclick = ()=>{ state.modal={type:'detail', id:r.id}; render(); };
  const idx = stageIndex(r.status); const isRejected = r.status==='Rejected';
  const top = document.createElement('div'); top.className='req-top';
  top.innerHTML = `
    <div>
      <span class="badge ${r.type==='PO'?'po':'pc'}">${r.type==='PO'?'Purchase order':'Petty cash'}</span>
      ${isRejected?'<span class="badge flag">Rejected</span>':''}
      ${(r.delivery && r.delivery.varianceStatus==='Needs resolution')?'<span class="badge flag">Payment variance</span>':''}
      <div class="req-title">${escapeHtml(r.title)}</div>
      <div class="req-sub">${r.id}${r.branch?' &middot; '+escapeHtml(r.branch):''} &middot; ${escapeHtml(r.supplier||r.payee)} &middot; requested by ${escapeHtml(r.requestor||r.createdBy)}</div>
    </div>
    <div class="req-amount">${fmtMoney(r.amount)}</div>
  `;
  card.appendChild(top);
  if(!isRejected){
    const stepper = document.createElement('div'); stepper.className='stepper';
    STAGES.forEach((s,i)=>{
      const sw = document.createElement('div'); sw.className='step';
      const dot = document.createElement('div'); dot.className='dot'+(i<idx?' done':i===idx?' current':'');
      const lbl = document.createElement('span'); lbl.className='step-lbl'+(i<idx?' done':i===idx?' current':'');
      lbl.textContent = stageShort(r.type, i);
      sw.appendChild(dot); sw.appendChild(lbl); stepper.appendChild(sw);
      if(i<STAGES.length-1){ const bar=document.createElement('div'); bar.className='bar'+(i<idx?' done':''); stepper.appendChild(bar); }
    });
    card.appendChild(stepper);
  } else {
    const rej = document.createElement('div'); rej.style.cssText='margin-top:10px;font-size:12px;color:var(--red-ink)';
    rej.textContent = 'Rejected: ' + (r.approval && r.approval.reason ? r.approval.reason : '');
    card.appendChild(rej);
  }
  const actions = actionsFor(r);
  if(actions.length){
    const row = document.createElement('div'); row.className='action-row';
    actions.forEach(a=>{
      const b=document.createElement('button'); b.className='btn '+(a.variant||''); b.textContent=a.label;
      b.onclick=(ev)=>{ ev.stopPropagation(); a.onClick(r); };
      row.appendChild(b);
    });
    card.appendChild(row);
  }
  return card;
}

function actionsFor(r){
  const acts = [];
  if(r.deletedAt){
    if(accessTier(curRole())==='SuperAdmin'){
      acts.push({label:'Restore', variant:'primary', onClick:(r)=>restoreReq(r)});
      acts.push({label:'Delete permanently', variant:'danger', onClick:(r)=>purgeReq(r)});
    }
    return acts;
  }
  if(curRole()==='Supervisor' && r.status==='Pending Approval'){
    acts.push({label:'Approve', variant:'primary', onClick:(r)=>approveReq(r.id)});
    acts.push({label:'Reject', variant:'danger', onClick:(r)=>{ state.modal={type:'reject', id:r.id}; render(); }});
  }
  if(curRole()==='Owner' && r.status==='Approved'){
    acts.push({label:r.type==='PO'?'Prepare check':'Prepare payment', variant:'primary', onClick:(r)=>{ state.modal={type:'check', id:r.id}; render(); }});
  }
  if(curRole()==='Supervisor' && r.status==='Check Prepared'){
    acts.push({label:'Confirm receipt', variant:'primary', onClick:(r)=>confirmCheckReceipt(r.id)});
  }
  if(curRole()==='Admin' && r.status==='Check Received by Supervisor'){
    acts.push({label:'Confirm handover received', variant:'primary', onClick:(r)=>confirmHandover(r.id)});
  }
  if(curRole()==='Admin' && r.status==='Handed to Admin'){
    acts.push({label: r.type==='PO' ? 'Log delivery' : 'Log reimbursement paid', variant:'primary', onClick:(r)=>{ state.modal={type:'delivery', id:r.id}; render(); }});
  }
  if((curRole()==='Admin'||curRole()==='Owner') && r.status==='Delivered'){
    acts.push({label:'Record in POS', variant:'primary', onClick:(r)=>{ state.modal={type:'pos', id:r.id}; render(); }});
  }
  if((curRole()==='Owner'||curRole()==='Supervisor') && r.delivery && r.delivery.varianceStatus==='Needs resolution'){
    acts.push({label:'Resolve variance', variant:'danger', onClick:(r)=>{ state.modal={type:'variance', id:r.id}; render(); }});
  }
  if(curRole()==='Admin' && r.status==='Rejected'){
    acts.push({label:'Resubmit for approval', onClick:(r)=>resubmit(r.id)});
  }
  if(accessTier(curRole())==='SuperAdmin'){
    acts.push({label:'Delete', variant:'danger', onClick:(r)=>deleteReq(r)});
  }
  return acts;
}

async function deleteReq(r){
  const okGo = confirm(
    'Delete ' + r.id + ' (' + r.title + ')?\n\n' +
    'It will be moved to Deleted items — hidden from all views and reports, ' +
    'but reviewable and restorable by Super Admins from the PO Tracker.'
  );
  if(!okGo) return;
  try{
    const {request} = await apiDelete(`/api/requests/${r.id}`);
    upsertRequest(mapRequest(request));
    if(state.modal && state.modal.id===r.id) state.modal = null;
    render();
  }catch(e){ alert(e.message); }
}

async function restoreReq(r){
  try{
    const {request} = await apiPost(`/api/requests/${r.id}`, {action:'restore'});
    upsertRequest(mapRequest(request));
    render();
  }catch(e){ alert(e.message); }
}

async function purgeReq(r){
  const typed = prompt(
    'PERMANENTLY delete ' + r.id + ' (' + r.title + ')? This erases the record, ' +
    'its history, and all its files forever. This cannot be undone.\n\nType DELETE to confirm:'
  );
  if(typed !== 'DELETE'){ if(typed !== null) alert('Not deleted — you must type DELETE exactly.'); return; }
  try{
    await apiPost(`/api/requests/${r.id}`, {action:'purge'});
    state.requests = state.requests.filter(x=>x.id!==r.id);
    if(state.modal && state.modal.id===r.id) state.modal = null;
    render();
  }catch(e){ alert(e.message); }
}

async function approveReq(id){
  try{ const {request} = await apiPost(`/api/requests/${id}/action`, {action:'approve'}); upsertRequest(mapRequest(request)); render(); }
  catch(e){ alert(e.message); }
}
async function resubmit(id){
  try{ const {request} = await apiPost(`/api/requests/${id}/action`, {action:'resubmit'}); upsertRequest(mapRequest(request)); render(); }
  catch(e){ alert(e.message); }
}
async function confirmCheckReceipt(id){
  try{ const {request} = await apiPost(`/api/requests/${id}/action`, {action:'confirm-receipt'}); upsertRequest(mapRequest(request)); render(); }
  catch(e){ alert(e.message); }
}
async function confirmHandover(id){
  try{ const {request} = await apiPost(`/api/requests/${id}/action`, {action:'confirm-handover'}); upsertRequest(mapRequest(request)); render(); }
  catch(e){ alert(e.message); }
}

function renderNewRequestModal(modal, reqType){
  if(reqType==='PO') return renderNewPOModal(modal);
  return renderNewPettyCashModal(modal);
}

function renderNewPettyCashModal(modal){
  const head = document.createElement('div'); head.className='modal-head';
  head.innerHTML = `<h2 style="font-size:16px;">New reimbursement</h2>`;
  head.appendChild(closeBtn()); modal.appendChild(head);
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="form-grid">
      <div class="field full"><label>What was this expense for</label><input id="f-title" placeholder="e.g. Grab fare to pick up supplies"></div>
      <div class="field"><label>Requestor</label><div style="padding:9px 11px;font-size:13.5px;color:var(--ink-0);">${escapeHtml(curName())}</div></div>
      <div class="field"><label>Staff member (paid to)</label><input id="f-payee" placeholder="e.g. Juan Dela Cruz"></div>
      <div class="field"><label>Amount (PHP)</label><input id="f-amount" type="number" min="0" step="0.01" placeholder="0.00"></div>
      <div class="field full"><label>Notes</label><textarea id="f-notes" placeholder="Any details the supervisor should know"></textarea></div>
      <div class="field full"><label>Attach receipt (optional)</label><input id="f-file" type="file" accept="image/*,.pdf"><div class="hint">Keep under 4MB. You can skip this and attach it later from the request's Files section.</div></div>
    </div>
    <div class="hint" style="margin-bottom:12px;">Petty cash reimbursements are paid out in cash only.</div>
    <div id="f-error"></div>
  `;
  modal.appendChild(wrap);
  const row = document.createElement('div'); row.className='action-row';
  const b = document.createElement('button'); b.className='btn primary'; b.textContent='Submit for approval';
  b.onclick = async ()=>{
    const title = document.getElementById('f-title').value.trim();
    const payee = document.getElementById('f-payee').value.trim();
    const amount = parseFloat(document.getElementById('f-amount').value);
    const notes = document.getElementById('f-notes').value.trim();
    const fileInput = document.getElementById('f-file');
    const errEl = document.getElementById('f-error'); errEl.innerHTML='';
    if(!title || !payee || !amount || amount<=0){ errEl.innerHTML='<div class="notice err">Fill in what this is for, the payee, and a valid amount.</div>'; return; }
    const file = fileInput.files[0];
    if(file && file.size > 4*1024*1024){ errEl.innerHTML='<div class="notice err">That file is over 4MB. Attach a smaller image or PDF.</div>'; return; }
    b.disabled=true; b.textContent='Submitting…';
    try{
      const {request} = await apiPost('/api/requests', {type:'PettyCash', title, payee, amount, notes});
      let mapped = mapRequest(request);
      if(file){
        const {request:withFile} = await apiUpload(`/api/requests/${mapped.id}/attachments`, file, 'Receipt');
        mapped = mapRequest(withFile);
      }
      upsertRequest(mapped);
      state.modal = null; render();
    }catch(e){
      errEl.innerHTML = `<div class="notice err">${escapeHtml(e.message)}</div>`;
      b.disabled=false; b.textContent='Submit for approval';
    }
  };
  row.appendChild(b); modal.appendChild(row);
}

function renderNewPOModal(modal){
  const head = document.createElement('div'); head.className='modal-head';
  head.innerHTML = `<h2 style="font-size:16px;">New purchase order</h2>`;
  head.appendChild(closeBtn()); modal.appendChild(head);

  const datalist = document.createElement('datalist');
  datalist.id = 'products-datalist';
  function fillDatalist(supplierKey){
    datalist.innerHTML = productsForSupplierKey(supplierKey).filter(p=>p.active!==false).map(p=>`<option value="${escapeHtml(p.item)}">`).join('');
  }
  fillDatalist(null);
  modal.appendChild(datalist);

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="form-grid">
      <div class="field"><label>Branch</label><select id="po-branch">${BRANCHES.map(b=>`<option value="${b.code}">${b.label}</option>`).join('')}</select></div>
      <div class="field"><label>Requestor</label><div style="padding:9px 11px;font-size:13.5px;color:var(--ink-0);">${escapeHtml(curName())}</div></div>
      <div class="field full">
        <label>Supplier</label>
        <select id="po-supplier">
          <option value="">— Choose from supplier list —</option>
          ${SUPPLIERS.map(s=>`<option value="${s.key}">${escapeHtml(s.name)}</option>`).join('')}
          <option value="__other__">Other (not in supplier list)</option>
        </select>
      </div>
      <div class="field full" id="po-supplier-other-wrap" style="display:none"><label>Supplier name</label><input id="po-supplier-other" placeholder="Supplier name"></div>
      <div class="field full"><label>Check payable to</label><input id="po-payee" placeholder="Auto-fills from supplier"></div>
    </div>
    <div class="hint" id="po-supplier-hint" style="margin-bottom:12px;"></div>
    <div class="hint" style="margin-bottom:12px;">Purchase orders are paid by check only.</div>
  `;
  modal.appendChild(wrap);

  const supplierSel = wrap.querySelector('#po-supplier');
  const otherWrap = wrap.querySelector('#po-supplier-other-wrap');
  const payeeInput = wrap.querySelector('#po-payee');
  const hintEl = wrap.querySelector('#po-supplier-hint');
  supplierSel.onchange = ()=>{
    const val = supplierSel.value;
    if(val==='__other__'){ otherWrap.style.display=''; hintEl.textContent=''; payeeInput.value=''; fillDatalist(null); return; }
    otherWrap.style.display = 'none';
    const sup = SUPPLIERS.find(s=>s.key===val);
    if(sup){ payeeInput.value = sup.payTo; hintEl.textContent = 'Contact: ' + (sup.contact||'—') + (sup.phone?' · '+sup.phone:'') + ' · Items below are filtered to what ' + sup.name + ' supplies.'; fillDatalist(sup.key); }
    else { hintEl.textContent=''; fillDatalist(null); }
  };

  // line items
  const itemsCard = document.createElement('div');
  itemsCard.className = 'card';
  itemsCard.innerHTML = `<h2 style="font-size:13px;color:var(--ink-1);margin-bottom:10px;">Order items</h2><div id="po-rows"></div>`;
  modal.appendChild(itemsCard);
  const addRowBtn = document.createElement('button');
  addRowBtn.className = 'btn sm'; addRowBtn.textContent = '+ Add item'; addRowBtn.style.marginTop='6px';
  itemsCard.appendChild(addRowBtn);

  let rows = [{id:uid(), item:'', qty:1, cost:0}];
  const rowsEl = itemsCard.querySelector('#po-rows');

  function renderRows(){
    rowsEl.innerHTML = '';
    rows.forEach(row=>{
      const rowEl = document.createElement('div');
      rowEl.style.cssText = 'display:grid;grid-template-columns:2fr 70px 100px 100px 32px;gap:8px;align-items:center;margin-bottom:8px;';
      rowEl.innerHTML = `
        <input list="products-datalist" placeholder="Item" value="${escapeHtml(row.item)}" data-f="item" style="background:var(--bg-2);border:1px solid var(--line);border-radius:7px;color:var(--ink-0);padding:8px 10px;font-size:13px;">
        <input type="number" min="0" step="1" value="${row.qty}" data-f="qty" style="background:var(--bg-2);border:1px solid var(--line);border-radius:7px;color:var(--ink-0);padding:8px 8px;font-size:13px;">
        <input type="number" min="0" step="0.01" value="${row.cost}" data-f="cost" style="background:var(--bg-2);border:1px solid var(--line);border-radius:7px;color:var(--ink-0);padding:8px 8px;font-size:13px;">
        <div style="font-family:var(--font-m);font-size:12.5px;color:var(--ink-1);text-align:right;padding-right:4px;">${fmtMoney(row.qty*row.cost).replace('PHP ','')}</div>
        <button data-act="remove" style="background:transparent;border:1px solid var(--line-strong);border-radius:7px;color:var(--ink-2);height:32px;">&times;</button>
      `;
      const itemInput = rowEl.querySelector('[data-f="item"]');
      const qtyInput = rowEl.querySelector('[data-f="qty"]');
      const costInput = rowEl.querySelector('[data-f="cost"]');
      itemInput.oninput = ()=>{
        row.item = itemInput.value;
        const match = state.products.find(p=>p.item.toLowerCase()===itemInput.value.toLowerCase());
        if(match && !row.costTouched){ row.cost = match.cost; costInput.value = match.cost; }
        recompute();
      };
      qtyInput.oninput = ()=>{ row.qty = parseFloat(qtyInput.value)||0; recompute(); };
      costInput.oninput = ()=>{ row.cost = parseFloat(costInput.value)||0; row.costTouched=true; recompute(); };
      rowEl.querySelector('[data-act="remove"]').onclick = ()=>{ rows = rows.filter(x=>x.id!==row.id); if(rows.length===0) rows.push({id:uid(), item:'', qty:1, cost:0}); renderRows(); };
      rowsEl.appendChild(rowEl);
    });
    recompute();
  }
  addRowBtn.onclick = ()=>{ rows.push({id:uid(), item:'', qty:1, cost:0}); renderRows(); };

  const totalCard = document.createElement('div');
  totalCard.className = 'check-callout';
  totalCard.innerHTML = `<div class="hint" style="margin-bottom:2px;">Total amount</div><div class="num" id="po-total">PHP 0.00</div>`;
  modal.appendChild(totalCard);
  function recompute(){
    const total = rows.reduce((s,r)=>s+(r.qty*r.cost),0);
    document.getElementById('po-total').textContent = fmtMoney(total);
  }
  renderRows();

  const rest = document.createElement('div');
  rest.innerHTML = `
    <div class="field full" style="margin-top:14px;"><label>Notes</label><textarea id="po-notes" placeholder="Any details the supervisor should know"></textarea></div>
    <div id="po-error"></div>
  `;
  modal.appendChild(rest);

  const row = document.createElement('div'); row.className='action-row';
  const b = document.createElement('button'); b.className='btn primary'; b.textContent='Submit for approval';
  b.onclick = async ()=>{
    const branch = wrap.querySelector('#po-branch').value;
    const supplierVal = supplierSel.value;
    const supplierObj = SUPPLIERS.find(s=>s.key===supplierVal);
    const supplierName = supplierVal==='__other__' ? wrap.querySelector('#po-supplier-other').value.trim() : (supplierObj ? supplierObj.name : '');
    const payee = payeeInput.value.trim();
    const notes = document.getElementById('po-notes').value.trim();
    const errEl = document.getElementById('po-error'); errEl.innerHTML='';

    const validRows = rows.filter(r=>r.item.trim() && r.qty>0);
    const total = validRows.reduce((s,r)=>s+(r.qty*r.cost),0);

    if(!supplierName){ errEl.innerHTML='<div class="notice err">Choose a supplier, or enter one if it is not on the list.</div>'; return; }
    if(!payee){ errEl.innerHTML='<div class="notice err">Enter who the check should be payable to.</div>'; return; }
    if(validRows.length===0 || total<=0){ errEl.innerHTML='<div class="notice err">Add at least one item with a quantity greater than zero.</div>'; return; }

    b.disabled=true; b.textContent='Submitting…';
    try{
      const {request} = await apiPost('/api/requests', {
        type:'PO', branch, supplier:supplierName, payee,
        lineItems: validRows.map(r=>({item:r.item, qty:r.qty, cost:r.cost})),
        notes,
      });
      upsertRequest(mapRequest(request));
      state.modal = null; render();
    }catch(e){
      errEl.innerHTML = `<div class="notice err">${escapeHtml(e.message)}</div>`;
      b.disabled=false; b.textContent='Submit for approval';
    }
  };
  row.appendChild(b); modal.appendChild(row);
}

// ============ DETAIL / ACTION MODALS (shared) ============
function renderDetailModal(modal){
  const r = findReq(state.modal.id); if(!r){ state.modal=null; return; }
  const head = document.createElement('div'); head.className='modal-head';
  head.innerHTML = `<div>
    <span class="badge ${r.type==='PO'?'po':'pc'}">${r.type==='PO'?'Purchase order':'Petty cash'}</span>
    <h2 style="font-size:16px;margin-top:8px;">${escapeHtml(r.title)}</h2>
    <div class="req-sub" style="margin-top:4px;">${r.id}${r.branch?' &middot; '+escapeHtml(r.branch):''} &middot; ${escapeHtml(r.supplier||r.payee)} &middot; ${fmtMoney(r.amount)}</div>
  </div>`;
  head.appendChild(closeBtn()); modal.appendChild(head);
  if(r.deletedAt){
    const delBanner = document.createElement('div'); delBanner.className='notice err';
    delBanner.textContent = 'This request was deleted by ' + (r.deletedBy||'—') + ' on ' + fmtDateTime(r.deletedAt) + '. It is hidden from all views and reports. Super Admins can restore it or delete it permanently.';
    modal.appendChild(delBanner);
  }
  if(r.payee || r.paymentMethod || r.requestor){
    const meta = document.createElement('div');
    meta.style.cssText = 'font-size:12.5px;color:var(--ink-2);margin-bottom:12px;';
    meta.innerHTML = `Payable to <span style="color:var(--ink-0)">${escapeHtml(r.payee)}</span> &middot; ${escapeHtml(r.paymentMethod||'Check')} &middot; requested by ${escapeHtml(r.requestor||r.createdBy)}`;
    modal.appendChild(meta);
  }
  if(r.lineItems && r.lineItems.length){
    const t = document.createElement('table'); t.className='simple'; t.style.marginBottom='14px';
    t.innerHTML = `<thead><tr><th>Item</th><th>Qty</th><th>Unit cost</th><th style="text-align:right">Total</th></tr></thead>` +
      '<tbody>' + r.lineItems.map(li=>`<tr><td>${escapeHtml(li.item)}</td><td>${li.qty}</td><td>${fmtMoney(li.cost).replace('PHP ','')}</td><td style="text-align:right;font-family:var(--font-m)">${fmtMoney(li.total).replace('PHP ','')}</td></tr>`).join('') + '</tbody>';
    modal.appendChild(t);
  }
  if(r.notes){ const n=document.createElement('div'); n.style.cssText='font-size:13px;color:var(--ink-1);margin-bottom:14px;'; n.textContent=r.notes; modal.appendChild(n); }
  if(r.check && r.check.number){
    const cc=document.createElement('div'); cc.className='check-callout';
    cc.innerHTML = `<div class="hint" style="margin-bottom:2px;">${(r.paymentMethod && r.paymentMethod!=='Check') ? r.paymentMethod+' reference on record' : (r.type==='PO'?'Check number on record':'Payment reference on record')}</div><div class="num">#${escapeHtml(r.check.number)}</div>${r.check.amount!=null?`<div class="hint" style="margin-top:4px;">Amount: ${fmtMoney(r.check.amount)}</div>`:''}`;
    modal.appendChild(cc);
  }
  if(r.delivery && r.delivery.deliveredAmount!=null && r.type==='PO'){
    const isVariance = r.delivery.varianceStatus==='Needs resolution';
    const isResolved = r.delivery.varianceStatus==='Resolved';
    const box = document.createElement('div');
    box.className = isVariance ? 'notice err' : (isResolved ? 'notice ok' : 'notice ok');
    let html = `Delivery receipt amount: <strong style="font-weight:500">${fmtMoney(r.delivery.deliveredAmount)}</strong>`;
    if(isVariance){ html += ` — differs from the check by ${fmtMoney(Math.abs(r.delivery.variance))}. Not yet resolved.`; }
    else if(isResolved){ html += ` — variance resolved: ${escapeHtml(r.delivery.resolution)}${r.delivery.resolutionNotes?' — '+escapeHtml(r.delivery.resolutionNotes):''}.`; }
    else { html += ` — matches the check amount.`; }
    box.innerHTML = html;
    modal.appendChild(box);
  }
  if(r.pos && r.status==='Recorded in POS'){
    const box = document.createElement('div'); box.className='notice ok';
    box.textContent = 'POS: ' + (r.pos.reference ? 'recorded as '+r.pos.reference : '') + (r.pos.hasScreenshot ? (r.pos.reference?' · ':'')+'screenshot on file' : '') + (!r.pos.reference && !r.pos.hasScreenshot ? 'recorded' : '');
    modal.appendChild(box);
  }
  const actions = actionsFor(r);
  if(actions.length){
    const row=document.createElement('div'); row.className='action-row';
    actions.forEach(a=>{ const b=document.createElement('button'); b.className='btn '+(a.variant||''); b.textContent=a.label; b.onclick=()=>a.onClick(r); row.appendChild(b); });
    modal.appendChild(row);
  }
  modal.appendChild(divider());
  const filesHead=document.createElement('h3'); filesHead.style.cssText='font-size:12px;color:var(--ink-2);margin-bottom:8px;letter-spacing:.03em;';
  filesHead.textContent = 'Files (' + (r.attachments||[]).length + ')'; modal.appendChild(filesHead);
  const fileList=document.createElement('div'); fileList.className='file-list';
  if(!r.attachments || r.attachments.length===0){ fileList.innerHTML='<div class="hint">No files attached yet.</div>'; }
  else{
    r.attachments.forEach(a=>{
      const row=document.createElement('div'); row.className='file-row';
      row.innerHTML = `<div><div class="file-name">${escapeHtml(a.name)}</div><div class="file-meta">${escapeHtml(a.label)} &middot; ${a.uploadedBy} &middot; ${fmtDateTime(a.uploadedAt)}</div></div>`;
      const btn=document.createElement('button'); btn.className='btn ghost'; btn.textContent='View';
      btn.onclick=()=>{ window.open(`/api/attachments/${a.id}`, '_blank'); };
      row.appendChild(btn); fileList.appendChild(row);
    });
  }
  modal.appendChild(fileList);
  const addFileRow = document.createElement('div');
  addFileRow.style.cssText = 'display:flex;gap:8px;margin-top:10px;align-items:center;flex-wrap:wrap;';
  addFileRow.innerHTML = `
    <input id="addfile-label" placeholder="What is this file (e.g. Purchase order)" style="background:var(--bg-2);border:1px solid var(--line);border-radius:7px;color:var(--ink-0);padding:8px 10px;font-size:12.5px;flex:1;min-width:160px;">
    <input id="addfile-input" type="file" accept="image/*,.pdf" style="font-size:12.5px;">
  `;
  const addFileBtn = document.createElement('button'); addFileBtn.className='btn sm'; addFileBtn.textContent='Attach file'; addFileBtn.style.marginTop='6px';
  addFileBtn.onclick = async ()=>{
    const label = document.getElementById('addfile-label').value.trim() || 'Attachment';
    const fileInput = document.getElementById('addfile-input');
    const file = fileInput.files[0];
    if(!file){ return; }
    if(file.size > 4*1024*1024){ alert('That file is over 4MB. Attach a smaller image or PDF.'); return; }
    addFileBtn.disabled = true; addFileBtn.textContent = 'Saving…';
    try{
      const {request} = await apiUpload(`/api/requests/${r.id}/attachments`, file, label);
      upsertRequest(mapRequest(request));
      state.modal = {type:'detail', id:r.id}; render();
    }catch(e){
      alert(e.message);
      addFileBtn.disabled = false; addFileBtn.textContent = 'Attach file';
    }
  };
  modal.appendChild(addFileRow);
  modal.appendChild(addFileBtn);
  modal.appendChild(divider());
  const tlHead=document.createElement('h3'); tlHead.style.cssText='font-size:12px;color:var(--ink-2);margin-bottom:8px;letter-spacing:.03em;'; tlHead.textContent='History';
  modal.appendChild(tlHead);
  const tl=document.createElement('div'); tl.className='timeline';
  [...r.history].reverse().forEach(h=>{
    const it=document.createElement('div'); it.className='tl-item';
    it.innerHTML = `<div class="tl-when">${fmtDateTime(h.at)} &middot; ${h.by}</div><div class="tl-what">${escapeHtml(h.text)}</div>`;
    tl.appendChild(it);
  });
  modal.appendChild(tl);
}

function renderRejectModal(modal){
  const r = findReq(state.modal.id);
  const head=document.createElement('div'); head.className='modal-head'; head.innerHTML='<h2 style="font-size:16px;">Reject request</h2>'; head.appendChild(closeBtn()); modal.appendChild(head);
  const field=document.createElement('div'); field.className='field'; field.innerHTML='<label>Reason</label><textarea id="reject-reason" placeholder="Why is this being sent back?"></textarea>'; modal.appendChild(field);
  const errWrap=document.createElement('div'); errWrap.id='reject-error'; modal.appendChild(errWrap);
  const row=document.createElement('div'); row.className='action-row';
  const b=document.createElement('button'); b.className='btn danger'; b.textContent='Reject request';
  b.onclick=async ()=>{
    const reason=document.getElementById('reject-reason').value.trim();
    const errEl=document.getElementById('reject-error');
    if(!reason){ errEl.innerHTML='<div class="notice err">Add a reason so the admin knows what to fix.</div>'; return; }
    b.disabled=true; b.textContent='Saving…';
    try{
      const {request} = await apiPost(`/api/requests/${r.id}/action`, {action:'reject', reason});
      upsertRequest(mapRequest(request));
      state.modal=null; render();
    }catch(e){ errEl.innerHTML = `<div class="notice err">${escapeHtml(e.message)}</div>`; b.disabled=false; b.textContent='Reject request'; }
  };
  row.appendChild(b); modal.appendChild(row);
}

function renderCheckModal(modal){
  const r = findReq(state.modal.id); const isPO = r.type==='PO';
  const method = r.paymentMethod || (r.type==='PO' ? 'Check' : 'Cash');
  const isCheck = method === 'Check';
  const head=document.createElement('div'); head.className='modal-head'; head.innerHTML = `<h2 style="font-size:16px;">${isCheck ? (isPO?'Prepare check':'Prepare payment') : 'Prepare '+method.toLowerCase()+' payment'}</h2>`; head.appendChild(closeBtn()); modal.appendChild(head);
  const info=document.createElement('div'); info.className='notice';
  info.textContent = 'Paying ' + r.payee + ' — ' + fmtMoney(r.amount) + ' via ' + method + '. The reference entered here is what the supervisor confirms on handover, so it can never go untracked.';
  modal.appendChild(info);
  const grid=document.createElement('div');
  grid.innerHTML = `
    <div class="form-grid">
      <div class="field"><label>${isCheck ? 'Check number' : method+' reference'}</label><input id="check-number" placeholder="${isCheck?'e.g. 0001234':'e.g. transaction ID, or CASH'}"></div>
      <div class="field"><label>Payment date</label><input id="check-date" type="date" value="${todayStr()}"></div>
      <div class="field"><label>Amount (PHP)</label><input id="check-amount" type="number" min="0" step="0.01" value="${r.amount}"></div>
      <div class="field"><label>Attach copy (optional)</label><input id="check-file" type="file" accept="image/*,.pdf"></div>
    </div>
    <div id="check-error"></div>
  `;
  modal.appendChild(grid);
  const row=document.createElement('div'); row.className='action-row';
  const b=document.createElement('button'); b.className='btn primary'; b.textContent = isCheck ? (isPO?'Mark check prepared':'Mark payment prepared') : 'Mark payment prepared';
  b.onclick=async ()=>{
    const num=document.getElementById('check-number').value.trim();
    const payDate=document.getElementById('check-date').value || todayStr();
    const payAmount=parseFloat(document.getElementById('check-amount').value);
    const errEl=document.getElementById('check-error'); errEl.innerHTML='';
    if(!num){ errEl.innerHTML='<div class="notice err">Enter the reference number.</div>'; return; }
    if(!payAmount || payAmount<=0){ errEl.innerHTML='<div class="notice err">Enter a valid amount.</div>'; return; }
    b.disabled=true; b.textContent='Saving…';
    try{
      const fileInput=document.getElementById('check-file'); const file=fileInput.files[0];
      if(file){ await apiUpload(`/api/requests/${r.id}/attachments`, file, isCheck?'Check copy':'Payment copy'); }
      const {request} = await apiPost(`/api/requests/${r.id}/action`, {action:'check', number:num, date:payDate, amount:payAmount});
      upsertRequest(mapRequest(request));
      state.modal=null; render();
    }catch(e){ errEl.innerHTML = `<div class="notice err">${escapeHtml(e.message)}</div>`; b.disabled=false; b.textContent='Mark payment prepared'; }
  };
  row.appendChild(b); modal.appendChild(row);
}

function renderDeliveryModal(modal){
  const r = findReq(state.modal.id); const isPO = r.type==='PO';
  const head=document.createElement('div'); head.className='modal-head'; head.innerHTML = `<h2 style="font-size:16px;">${isPO?'Log delivery':'Log reimbursement paid'}</h2>`; head.appendChild(closeBtn()); modal.appendChild(head);
  const checkAmount = (r.check && r.check.amount!=null) ? r.check.amount : r.amount;
  if(isPO){
    const info=document.createElement('div'); info.className='notice';
    info.textContent = 'Check was written for ' + fmtMoney(checkAmount) + '. Enter what the delivery receipt actually shows — if a supplier was out of stock on something, or sent extra, the amounts will differ and that gets flagged for follow-up.';
    modal.appendChild(info);
  }
  const grid=document.createElement('div');
  grid.innerHTML = `
    <div class="form-grid">
      <div class="field full"><label>${isPO?'Attach delivery receipt / invoice':'Attach acknowledgment (optional)'}</label><input id="delivery-file" type="file" accept="image/*,.pdf"></div>
      ${isPO ? `<div class="field"><label>Amount per delivery receipt (PHP)</label><input id="delivery-amount" type="number" min="0" step="0.01" value="${checkAmount}"></div>` : ''}
      <div class="field${isPO?'':' full'}"><label>Notes (optional)</label><input id="delivery-notes" placeholder="${isPO?'e.g. 2 boxes out of stock, credited next order':'e.g. paid in cash to staff'}"></div>
    </div>
    <div id="delivery-error"></div>
  `;
  modal.appendChild(grid);
  const row=document.createElement('div'); row.className='action-row';
  const b=document.createElement('button'); b.className='btn primary'; b.textContent = isPO?'Mark delivered':'Mark reimbursed';
  b.onclick=async ()=>{
    const fileInput=document.getElementById('delivery-file'); const notes=document.getElementById('delivery-notes').value.trim(); const file=fileInput.files[0];
    const errEl=document.getElementById('delivery-error'); errEl.innerHTML='';
    if(isPO && !file){ errEl.innerHTML='<div class="notice err">Attach the delivery receipt or invoice.</div>'; return; }
    let deliveredAmount = r.amount;
    if(isPO){
      deliveredAmount = parseFloat(document.getElementById('delivery-amount').value);
      if(!deliveredAmount || deliveredAmount<0){ errEl.innerHTML='<div class="notice err">Enter the amount shown on the delivery receipt.</div>'; return; }
    }
    b.disabled=true; b.textContent='Saving…';
    try{
      if(file){ await apiUpload(`/api/requests/${r.id}/attachments`, file, isPO?'Delivery receipt / invoice':'Acknowledgment'); }
      const {request} = await apiPost(`/api/requests/${r.id}/action`, {action:'delivery', notes, deliveredAmount});
      upsertRequest(mapRequest(request));
      state.modal=null; render();
    }catch(e){ errEl.innerHTML = `<div class="notice err">${escapeHtml(e.message)}</div>`; b.disabled=false; b.textContent = isPO?'Mark delivered':'Mark reimbursed'; }
  };
  row.appendChild(b); modal.appendChild(row);
}

function renderVarianceModal(modal){
  const r = findReq(state.modal.id);
  const head=document.createElement('div'); head.className='modal-head'; head.innerHTML='<h2 style="font-size:16px;">Resolve payment variance</h2>'; head.appendChild(closeBtn()); modal.appendChild(head);
  const checkAmount = (r.check && r.check.amount!=null) ? r.check.amount : r.amount;
  const info=document.createElement('div'); info.className='notice';
  info.textContent = 'Check: ' + fmtMoney(checkAmount) + '  ·  Delivery receipt: ' + fmtMoney(r.delivery.deliveredAmount) + '  ·  Difference: ' + fmtMoney(Math.abs(r.delivery.variance)) + (r.delivery.variance<0 ? ' short' : ' over') + '. ' + (r.delivery.notes||'');
  modal.appendChild(info);
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="field"><label>How was this resolved</label><select id="var-resolution">
      <option value="Credit applied to next PO">Credit applied to next PO</option>
      <option value="Refund received from supplier">Refund received from supplier</option>
      <option value="Additional payment issued">Additional payment issued</option>
      <option value="Written off, approved by owner">Written off, approved by owner</option>
      <option value="Other">Other</option>
    </select></div>
    <div class="field full"><label>Notes</label><textarea id="var-notes" placeholder="Reference number, who approved it, etc."></textarea></div>
    <div id="var-error"></div>
  `;
  modal.appendChild(wrap);
  const row=document.createElement('div'); row.className='action-row';
  const b=document.createElement('button'); b.className='btn primary'; b.textContent='Mark variance resolved';
  b.onclick=async ()=>{
    const resolution = document.getElementById('var-resolution').value;
    const notes = document.getElementById('var-notes').value.trim();
    const errEl=document.getElementById('var-error');
    b.disabled=true; b.textContent='Saving…';
    try{
      const {request} = await apiPost(`/api/requests/${r.id}/action`, {action:'resolve-variance', resolution, notes});
      upsertRequest(mapRequest(request));
      state.modal=null; render();
    }catch(e){ errEl.innerHTML = `<div class="notice err">${escapeHtml(e.message)}</div>`; b.disabled=false; b.textContent='Mark variance resolved'; }
  };
  row.appendChild(b); modal.appendChild(row);
}

function renderPosModal(modal){
  const r = findReq(state.modal.id);
  const head=document.createElement('div'); head.className='modal-head'; head.innerHTML='<h2 style="font-size:16px;">Record in POS</h2>'; head.appendChild(closeBtn()); modal.appendChild(head);
  const info=document.createElement('div'); info.className='notice'; info.textContent='Confirm this expense has been entered in the gym POS system. If your POS does not generate an entry number, attach a screenshot of the entry instead — one of the two is required.'; modal.appendChild(info);
  const field=document.createElement('div'); field.className='field'; field.innerHTML='<label>POS reference / entry number (optional if you attach a screenshot)</label><input id="pos-ref" placeholder="e.g. EXP-00231, or leave blank">'; modal.appendChild(field);
  const fileField=document.createElement('div'); fileField.className='field full'; fileField.innerHTML='<label>Screenshot of POS entry (optional if you enter a reference)</label><input id="pos-file" type="file" accept="image/*,.pdf">'; modal.appendChild(fileField);
  const errWrap=document.createElement('div'); errWrap.id='pos-error'; modal.appendChild(errWrap);
  const row=document.createElement('div'); row.className='action-row';
  const b=document.createElement('button'); b.className='btn primary'; b.textContent='Confirm recorded';
  b.onclick=async ()=>{
    const ref=document.getElementById('pos-ref').value.trim();
    const fileInput=document.getElementById('pos-file'); const file=fileInput.files[0];
    const errEl=document.getElementById('pos-error'); errEl.innerHTML='';
    if(!ref && !file){ errEl.innerHTML='<div class="notice err">Enter a POS reference, attach a screenshot of the entry, or both.</div>'; return; }
    b.disabled=true; b.textContent='Saving…';
    try{
      if(file){ await apiUpload(`/api/requests/${r.id}/attachments`, file, 'POS entry screenshot'); }
      const {request} = await apiPost(`/api/requests/${r.id}/action`, {action:'pos', reference:ref});
      upsertRequest(mapRequest(request));
      state.modal=null; render();
    }catch(e){ errEl.innerHTML = `<div class="notice err">${escapeHtml(e.message)}</div>`; b.disabled=false; b.textContent='Confirm recorded'; }
  };
  row.appendChild(b); modal.appendChild(row);
}

// ============ SALES TRACKER ============
const SALE_CATEGORIES = ['GYM','HIIT','MARTIAL ARTS','MEMBERSHIP','PERSONAL TRAINING','OTHERS'];
const SALE_METHODS = ['Cash','Card','Bank transfer','GCash'];


const MARTIAL_DISCIPLINES = ['Boxing','Muay Thai','Taekwondo'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function salesBranchOf(s){ return s.branch || ''; }

function renderSales(el){
  const sr = salesRole();
  const canEdit = sr==='full';
  if(!state.salesArea) state.salesArea = 'core';

  // Admins: view-only, and only the "Sales by Admin" report — no area switch, no other tabs.
  if(sr==='admin'){
    state.salesArea='core'; state.salesTab='admin';
    const body=document.createElement('div'); el.appendChild(body);
    try{ return renderAdminReport(body); }
    catch(err){ console.error('Sales view error:', err); body.innerHTML='<div class="empty">Could not load this view.</div>'; }
    return;
  }

  if(!state.salesTab) state.salesTab = 'overview';

  // Top-level area switch: Core Services vs Drinks & Merchandise
  const areaBar = document.createElement('div');
  areaBar.style.cssText = 'display:flex;gap:8px;margin-bottom:16px;border-bottom:1px solid var(--line);padding-bottom:14px;';
  [{k:'core', l:'Core Services'}, {k:'merch', l:'Drinks & Merchandise'}].forEach(a=>{
    const b = document.createElement('button');
    b.className = 'btn' + (state.salesArea===a.k ? ' primary' : '');
    b.textContent = a.l;
    b.onclick = ()=>{ state.salesArea = a.k; render(); };
    areaBar.appendChild(b);
  });
  el.appendChild(areaBar);

  if(state.salesArea==='merch'){
    const body = document.createElement('div'); el.appendChild(body);
    try{ return renderMerchReport(body); }
    catch(err){ console.error('Merch view error:', err); body.innerHTML='<div class="empty">Could not load this view.</div>'; return; }
  }

  // Tab bar (Core Services). View reports for everyone; upload/entries/imports only for editors.
  const tabs = document.createElement('div'); tabs.className='toolbar'; tabs.style.marginBottom='18px';
  const tabDefs = [
    {k:'overview', l:'Overview'},
    {k:'branchperf', l:'Performance per Branch'},
    {k:'category', l:'Sales by Category'},
    {k:'item', l:'Sales by Item'},
    {k:'admin', l:'Sales by Admin'},
  ];
  if(canEdit){
    tabDefs.push({k:'upload', l:'Upload POS report'});
    tabDefs.push({k:'entries', l:'Entries'});
    tabDefs.push({k:'batches', l:'Manage imports'});
  }
  if(!tabDefs.some(t=>t.k===state.salesTab)) state.salesTab='overview';
  tabDefs.forEach(t=>{
    const b = document.createElement('button');
    b.className = 'btn' + (state.salesTab===t.k?' primary':'');
    b.textContent = t.l;
    b.onclick = ()=>{ state.salesTab = t.k; render(); };
    tabs.appendChild(b);
  });
  const xbtn=document.createElement('button');
  xbtn.className='btn'; xbtn.textContent='⬇ Export to Excel';
  xbtn.style.marginLeft='auto';
  xbtn.onclick=()=>exportDashboardsToExcel(xbtn);
  tabs.appendChild(xbtn);
  el.appendChild(tabs);

  const body = document.createElement('div');
  el.appendChild(body);
  ensureReportMonth();
  try{
    if(state.salesTab==='upload') return renderSalesUpload(body);
    if(state.salesTab==='branchperf') return renderBranchPerf(body);
    if(state.salesTab==='category') return renderCategoryReport(body);
    if(state.salesTab==='item') return renderItemReport(body);
    if(state.salesTab==='admin') return renderAdminReport(body);
    if(state.salesTab==='entries') return renderSalesEntries(body);
    if(state.salesTab==='batches') return renderSalesBatches(body);
    return renderSalesOverview(body);
  }catch(err){
    console.error('Sales view error:', err);
    body.innerHTML = '<div class="empty">Could not load this view. Try another tab or refresh.</div>';
  }
}

// ---------- OVERVIEW: metrics + charts + actual vs target ----------
function renderSalesOverview(el){
  if(!state.salesPeriod) state.salesPeriod='month';
  periodFilterBar(el, SKEYS, {branch:true});
  const branch = state.salesBranch || 'All';
  const P = resolvePeriod(state.salesPeriod, state.salesMonth, state.salesQuarter);
  const yr=P.yr;
  const scoped = salesInPeriod(branch, yr, P.months);
  const periodTotal = scoped.reduce((s,x)=>s+x.amount,0);
  const todaySales = state.sales.filter(s=>isPosSale(s)&&isCoreSale(s)&&s.date===todayStr() && (branch==='All'||salesBranchOf(s)===branch));
  const todayTotal = todaySales.reduce((s,x)=>s+x.amount,0);
  const t = targetFor(yr, branch, P.months);
  const minT=t.min, medT=t.med, maxT=t.max;
  const pctToMin = minT? Math.round(periodTotal/minT*100):0;
  const periodLabel = P.label;

  const metrics=document.createElement('div'); metrics.className='metrics';
  const overMin=periodTotal-minT;
  metrics.innerHTML=`
    <div class="metric good"><div class="num">${money(periodTotal)}</div><div class="lbl">${periodLabel} sales (PHP)</div></div>
    <div class="metric"><div class="num">${money(todayTotal)}</div><div class="lbl">Today (PHP)</div></div>
    <div class="metric ${minT&&periodTotal>=minT?'good':'flag'}"><div class="num">${pctToMin}%</div><div class="lbl">of minimum target</div></div>
    <div class="metric ${overMin>=0?'good':'flag'}"><div class="num">${money(Math.abs(overMin))}</div><div class="lbl">${overMin>=0?'over':'under'} minimum</div></div>`;
  el.appendChild(metrics);

  if(!state.sales.length){ const e=document.createElement('div'); e.className='empty'; e.textContent='No sales yet. Upload a POS report to get started.'; el.appendChild(e); return; }

  if(minT){
    const gaugeCard=document.createElement('div'); gaugeCard.className='card';
    gaugeCard.innerHTML=`<h2 style="font-size:14px;color:#ffffff;margin-bottom:14px;">Actual vs Target — ${periodLabel}${branch!=='All'?(' · '+branch):''}</h2>`;
    const gauge=document.createElement('div'); const cap=maxT||1;
    const seg=(val,color,label)=>{ const pct=Math.min(100,val/cap*100);
      return `<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;font-size:12px;color:#c9d1d9;margin-bottom:3px;"><span>${label}</span><span>${money(val)}</span></div><div class="bt" style="height:10px;position:relative;"><div class="bf" style="width:${pct}%;background:${color};"></div></div></div>`; };
    gauge.innerHTML=seg(periodTotal, periodTotal>=minT?'var(--lime)':'var(--amber)','Actual')+seg(minT,'rgba(255,255,255,.25)','Minimum target')+seg(medT,'rgba(255,255,255,.25)','Medial target')+seg(maxT,'rgba(255,255,255,.25)','Max target');
    gaugeCard.appendChild(gauge); el.appendChild(gaugeCard);
  }

  const trendCard=document.createElement('div'); trendCard.className='card';
  trendCard.innerHTML='<h2 style="font-size:14px;color:#ffffff;margin-bottom:12px;">Monthly actual vs target</h2>';
  const c1=document.createElement('canvas'); c1.style.maxHeight='260px'; trendCard.appendChild(c1); el.appendChild(trendCard);
  const catCard=document.createElement('div'); catCard.className='card';
  catCard.innerHTML='<h2 style="font-size:14px;color:#ffffff;margin-bottom:12px;">Sales by category</h2>';
  const c2=document.createElement('canvas'); c2.style.maxHeight='260px'; catCard.appendChild(c2); el.appendChild(catCard);

  const maSales=scoped.filter(s=>s.category==='MARTIAL ARTS');
  let c4=null;
  if(maSales.length){ const maCard=document.createElement('div'); maCard.className='card';
    maCard.innerHTML='<h2 style="font-size:14px;color:#ffffff;margin-bottom:12px;">Martial arts by discipline</h2>';
    c4=document.createElement('canvas'); c4.style.maxHeight='220px'; maCard.appendChild(c4); el.appendChild(maCard); }

  setTimeout(()=>{ drawTrendChart(c1, yr, branch); drawCategoryChart(c2, scoped); if(c4) drawDisciplineChart(c4, maSales); },30);

  // Actual vs Target numbers per month (replaces Sales-per-admin) — instruction 2
  monthlyActualVsTargetTable(el, yr, branch, 12);
  // Actual vs Target per quarter, side by side
  quarterlyActualVsTarget(el, yr, branch);
  // Summary & recommendations — instruction 4
  renderPerfNarrative(el, yr, branch, 12);
}
function chartColors(n){
  const base = ['#e5231b','#f0a020','#3fb950','#58a6ff','#bc8cff','#f778ba','#56d4dd','#e3b341','#7ee787','#ff9bce'];
  const out=[]; for(let i=0;i<n;i++) out.push(base[i%base.length]); return out;
}

// Softer, muted palette for pies and bars (easier on the eye than the vivid set).
function chartPalette(n){
  const base = ['#c96b6b','#d1a56b','#7fae82','#7f9dc4','#a892c4','#c48fa8','#6faeb2','#c4b07f','#8fbf9a','#b89ca8'];
  const out=[]; for(let i=0;i<n;i++) out.push(base[i%base.length]); return out;
}

// Force chart text to be light on the dark theme, across Chart.js versions.
// v3/v4 read Chart.defaults.color; v2 reads Chart.defaults.global.defaultFontColor.
function applyChartTextDefaults(){
  if(typeof Chart==='undefined' || !Chart.defaults) return;
  try{
    Chart.defaults.color = '#ffffff';
    if(Chart.defaults.plugins && Chart.defaults.plugins.legend && Chart.defaults.plugins.legend.labels)
      Chart.defaults.plugins.legend.labels.color = '#ffffff';
    if(Chart.defaults.global){ Chart.defaults.global.defaultFontColor = '#ffffff'; }
  }catch(e){}
}
applyChartTextDefaults();
if(typeof window!=='undefined') window.addEventListener('load', applyChartTextDefaults);

// Inline plugin: draw the % share directly on each pie/doughnut slice (white),
// so users don't have to hover. Self-contained — no external plugin needed.
const pieLabelPlugin = {
  id:'pieLabels',
  afterDatasetsDraw(chart){
    const ds=chart.data.datasets && chart.data.datasets[0];
    if(!ds) return;
    const total=ds.data.reduce((a,b)=>a+(Number(b)||0),0)||1;
    const meta=chart.getDatasetMeta(0);
    const ctx=chart.ctx;
    ctx.save();
    ctx.fillStyle='#ffffff';
    ctx.font='600 12px system-ui, sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.shadowColor='rgba(0,0,0,.55)'; ctx.shadowBlur=3;
    meta.data.forEach((arc,i)=>{
      const v=Number(ds.data[i])||0;
      const pct=v/total*100;
      if(pct<4) return; // skip slivers to avoid clutter
      let p;
      try{ p=arc.getCenterPoint(); }catch(e){ p={x:arc.x,y:arc.y}; }
      ctx.fillText(pct.toFixed(1)+'%', p.x, p.y);
    });
    ctx.restore();
  }
};

function drawTrendChart(canvas, year, branch){
  if(typeof Chart==='undefined') return;
  const actual = new Array(12).fill(0);
  state.sales.filter(s=>isPosSale(s) && isCoreSale(s) && Number(s.date.slice(0,4))===year && (branch==='All'||salesBranchOf(s)===branch))
    .forEach(s=>{ const m=Number(s.date.slice(5,7))-1; actual[m]+=s.amount; });
  const tb = branch==='All'?'All':branch;
  const minA=new Array(12).fill(0), medA=new Array(12).fill(0), maxA=new Array(12).fill(0);
  (state.targets||[]).filter(t=>t.year===year && t.branch===tb).forEach(t=>{
    minA[t.month-1]=Number(t.min_target); medA[t.month-1]=Number(t.medial_target); maxA[t.month-1]=Number(t.max_target);
  });
  if(canvas._chart) canvas._chart.destroy();
  canvas._chart = new Chart(canvas, {
    type:'bar',
    data:{ labels:MONTH_NAMES, datasets:[
      {type:'bar', label:'Actual', data:actual, backgroundColor:actual.map((v,i)=> v>=minA[i]&&minA[i]>0 ? '#3fb950':'#e5231b'), borderRadius:4, order:2},
      {type:'line', label:'Min target', data:minA, borderColor:'#f0a020', borderWidth:2, pointRadius:0, tension:.2, order:1},
      {type:'line', label:'Medial', data:medA, borderColor:'#58a6ff', borderWidth:1.5, borderDash:[5,4], pointRadius:0, tension:.2, order:1},
      {type:'line', label:'Max', data:maxA, borderColor:'#bc8cff', borderWidth:1.5, borderDash:[2,3], pointRadius:0, tension:.2, order:1},
    ]},
    options:chartOpts()
  });
}

function drawCategoryChart(canvas, sales){
  if(typeof Chart==='undefined') return;
  const by={}; sales.forEach(s=>by[s.category]=(by[s.category]||0)+s.amount);
  const labels=Object.keys(by), data=labels.map(l=>by[l]);
  const total=data.reduce((a,b)=>a+b,0)||1;
  if(canvas._chart) canvas._chart.destroy();
  canvas._chart = new Chart(canvas, {
    type:'doughnut',
    plugins:[pieLabelPlugin],
    data:{ labels, datasets:[{data, backgroundColor:chartPalette(labels.length), borderColor:'#0d0d0f', borderWidth:2}]},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{
          position:'right',
          labels:{
            color:'#ffffff', font:{size:11}, padding:10,
            generateLabels:(chart)=>{
              const d=chart.data.datasets[0].data;
              return chart.data.labels.map((lab,i)=>({
                text: `${lab}  ${(d[i]/total*100).toFixed(1)}%`,
                fillStyle: chart.data.datasets[0].backgroundColor[i],
                strokeStyle: chart.data.datasets[0].backgroundColor[i],
                fontColor: '#ffffff',
                index:i
              }));
            }
          }
        },
        tooltip:{ callbacks:{ label:(c)=>` ${fmtMoney(c.parsed)} (${(c.parsed/total*100).toFixed(1)}%)` } }
      }
    }
  });
}

// Drinks & Merchandise is tracked in its own separate dashboard, not in these
// sales reports. Exclude it everywhere so category/service/admin all align.
function isCoreSale(s){ return (s.category||'') !== 'Drinks & Merchandise'; }
// POS-sourced sales feed the category/service/target reports. Admin-tracker
// rows feed ONLY the Admin Sales Performance report — keep them apart.
function isPosSale(s){ return s.source !== 'admin-tracker'; }
function isAdminSale(s){ return s.source === 'admin-tracker'; }

function drawAdminChart(canvas, sales){
  if(typeof Chart==='undefined') return;
  const by={}; sales.filter(isCoreSale).forEach(s=>{ const a=(s.enteredBy&&s.enteredBy.trim())||'Unknown'; by[a]=(by[a]||0)+s.amount; });
  const entries=Object.entries(by).sort((a,b)=>b[1]-a[1]);
  const labels=entries.map(e=>e[0]), data=entries.map(e=>e[1]);
  if(canvas._chart) canvas._chart.destroy();
  canvas._chart = new Chart(canvas, {
    type:'bar',
    data:{ labels, datasets:[{label:'Sales (PHP)', data, backgroundColor:chartPalette(labels.length), borderRadius:4}]},
    options:{
      indexAxis:'y',
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:(c)=>' '+fmtMoney(c.parsed.x)}} },
      scales:{
        x:{ ticks:{color:'#c9d1d9', font:{size:10}, callback:v=>v>=1000?(v/1000)+'k':v}, grid:{color:'rgba(255,255,255,.05)'} },
        y:{ type:'category', ticks:{color:'#ffffff', font:{size:12}}, grid:{display:false} }
      }
    }
  });
}

function drawDisciplineChart(canvas, maSales){
  if(typeof Chart==='undefined') return;
  const by={}; maSales.forEach(s=>{ const d=s.discipline||'Other'; by[d]=(by[d]||0)+s.amount; });
  const labels=Object.keys(by), data=labels.map(l=>by[l]);
  if(canvas._chart) canvas._chart.destroy();
  canvas._chart = new Chart(canvas, {
    type:'polarArea',
    data:{ labels, datasets:[{data, backgroundColor:chartPalette(labels.length).map(c=>c+'cc')}]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'right', labels:{color:'#ffffff', font:{size:11}}}}, scales:{r:{ticks:{display:false}, grid:{color:'rgba(255,255,255,.08)'}}} }
  });
}

function chartOpts(){
  return {
    responsive:true, maintainAspectRatio:false,
    plugins:{legend:{labels:{color:'#ffffff', font:{size:11}}}},
    scales:{
      x:{ticks:{color:'#c9d1d9', font:{size:10}}, grid:{color:'rgba(255,255,255,.05)'}},
      y:{ticks:{color:'#c9d1d9', font:{size:10}, callback:v=>v>=1000?(v/1000)+'k':v}, grid:{color:'rgba(255,255,255,.05)'}}
    }
  };
}

// ---------- UPLOAD POS REPORT ----------
function renderSalesUpload(el){
  if(!canEditSales()){ const n=document.createElement('div'); n.className='empty'; n.textContent='Uploading POS reports is restricted. You have view-only access to the Sales Dashboard.'; el.appendChild(n); return; }
  const intro = document.createElement('div'); intro.className='notice';
  intro.innerHTML = 'Upload the POS <strong>“Sales Summary by Category”</strong> CSV export after your shift. The system reads the date, staff, and each line, maps them to your tracker categories, and skips merchandise/drinks. You review before anything is saved.';
  el.appendChild(intro);

  const card = document.createElement('div'); card.className='card';
  card.innerHTML = `
    <div class="field full"><label>POS report (CSV)</label><input id="pos-file" type="file" accept=".csv,text/csv"></div>
    <div id="pos-status" class="hint" style="margin-top:8px;"></div>
  `;
  el.appendChild(card);
  const resultHost = document.createElement('div');
  el.appendChild(resultHost);

  const status = card.querySelector('#pos-status');
  card.querySelector('#pos-file').onchange = async (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    status.textContent = 'Reading the report…';
    resultHost.innerHTML = '';
    try{
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch('/api/sales/import', {method:'POST', body:fd});
      const data = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error || 'Could not read the file.');
      status.textContent = '';
      state.posPreview = data.preview;
      renderPosPreview(resultHost, data.preview);
    }catch(err){ status.innerHTML = `<span style="color:var(--red-ink)">${escapeHtml(err.message)}</span>`; }
  };
}

function renderPosPreview(host, preview){
  host.innerHTML = '';

  // Warnings
  if(preview.warnings && preview.warnings.length){
    const w = document.createElement('div'); w.className='notice err';
    w.innerHTML = '<strong>Please review before importing:</strong><ul style="margin:6px 0 0 18px;padding:0;">' +
      preview.warnings.map(x=>`<li>${escapeHtml(x)}</li>`).join('') + '</ul>';
    host.appendChild(w);
  }

  // Header summary — editable staff/branch/date
  const head = document.createElement('div'); head.className='card';
  head.innerHTML = `
    <h2 style="font-size:14px;color:var(--ink-1);margin-bottom:12px;">Import summary</h2>
    <div class="form-grid">
      <div class="field"><label>Date</label><input id="imp-date" type="date" value="${preview.date||todayStr()}"></div>
      <div class="field"><label>Staff (admin)</label><input id="imp-staff" value="${escapeHtml(preview.staff||'')}"></div>
      <div class="field"><label>Branch</label><select id="imp-branch">
        <option value="Manila" ${preview.branch==='Manila'?'selected':''}>Manila</option>
        <option value="Malabon" ${preview.branch==='Malabon'?'selected':''}>Malabon</option>
      </select></div>
    </div>
    <div class="hint" style="margin-top:6px;">Sales to import: <strong>${fmtMoney(preview.keptSum)}</strong> · excluded merchandise/drinks: ${fmtMoney(preview.excludedSum)} · POS grand total: ${preview.grandTotal!=null?fmtMoney(preview.grandTotal):'—'}</div>
  `;
  host.appendChild(head);

  // Line items with New/Renew where needed
  const tableCard = document.createElement('div'); tableCard.className='card';
  const table = document.createElement('table'); table.className='simple'; table.style.minWidth='680px';
  table.innerHTML = '<thead><tr><th>Item (POS)</th><th>Availment</th><th>Category</th><th>Qty</th><th style="text-align:right">Amount</th><th>New/Renew</th></tr></thead>';
  const tbody = document.createElement('tbody');
  preview.lines.forEach((L,i)=>{
    const tr = document.createElement('tr');
    const catCell = L.unmapped
      ? `<span class="badge flag">${escapeHtml(L.category)}?</span>`
      : `${escapeHtml(L.category)}${L.discipline?` <span class="hint">(${escapeHtml(L.discipline)})</span>`:''}`;
    tr.innerHTML = `
      <td>${escapeHtml(L.item)}</td>
      <td>${escapeHtml(L.availment)}</td>
      <td>${catCell}</td>
      <td>${L.qty}</td>
      <td style="text-align:right;font-family:var(--font-m)">${fmtMoney(L.amount).replace('PHP ','')}</td>
      <td></td>`;
    if(L.needsKind){
      const sel = document.createElement('select'); sel.dataset.idx=i;
      sel.innerHTML = '<option value="New">New</option><option value="Renew">Renew</option>';
      sel.value = L.saleKind || 'New';
      sel.className = 'pos-kind';
      tr.lastElementChild.appendChild(sel);
    } else {
      tr.lastElementChild.innerHTML = '<span class="hint">—</span>';
    }
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  const scroll = document.createElement('div'); scroll.style.overflowX='auto'; scroll.appendChild(table);
  tableCard.appendChild(scroll);
  host.appendChild(tableCard);

  // Commit
  const row = document.createElement('div'); row.className='action-row';
  const importBtn = document.createElement('button'); importBtn.className='btn primary'; importBtn.textContent='Import these sales';
  importBtn.onclick = async ()=>{
    const date = document.getElementById('imp-date').value;
    const staff = document.getElementById('imp-staff').value.trim();
    const branch = document.getElementById('imp-branch').value;
    if(!staff){ alert('Enter the staff name.'); return; }
    // gather New/Renew choices
    host.querySelectorAll('.pos-kind').forEach(sel=>{ preview.lines[Number(sel.dataset.idx)].saleKind = sel.value; });
    importBtn.disabled=true; importBtn.textContent='Importing…';
    try{
      const res = await apiPut('/api/sales/import', {date, staff, branch, lines:preview.lines});
      // reload sales
      const fresh = await apiGet('/api/sales');
      state.sales = (fresh.sales||[]).map(mapSale);
      state.posPreview = null;
      state.salesTab = 'overview';
      alert('Imported ' + res.imported + ' sales lines totalling ' + fmtMoney(res.total) + '.');
      render();
    }catch(e){ alert(e.message); importBtn.disabled=false; importBtn.textContent='Import these sales'; }
  };
  row.appendChild(importBtn);
  const cancel = document.createElement('button'); cancel.className='btn ghost'; cancel.textContent='Cancel';
  cancel.onclick = ()=>{ state.posPreview=null; render(); };
  row.appendChild(cancel);
  host.appendChild(row);
}

// ---------- ENTRIES ----------
function renderSalesEntries(el){
  const month = state.salesMonth;
  let monthSales = state.sales.filter(s=>s.date.slice(0,7)===month);
  const branchFilter = state.salesBranch || 'All';
  if(branchFilter!=='All') monthSales = monthSales.filter(s=>salesBranchOf(s)===branchFilter);

  const head = document.createElement('div'); head.className='section-head';
  head.innerHTML = '<h2>Entries — ' + month + '</h2>';
  const toolbar = document.createElement('div'); toolbar.className='toolbar';
  toolbar.innerHTML = `<input type="month" id="sales-month" value="${month}">`;
  const brSel = document.createElement('select');
  brSel.innerHTML = ['All','Manila','Malabon'].map(b=>`<option value="${b}" ${branchFilter===b?'selected':''}>${b==='All'?'Both branches':b}</option>`).join('');
  brSel.onchange = ()=>{ state.salesBranch = brSel.value; render(); };
  toolbar.appendChild(brSel);
  const exBtn=document.createElement('button'); exBtn.className='btn'; exBtn.textContent='Export to Excel';
  exBtn.onclick=()=>{
    const rows = monthSales.map(s=>({
      'Date':s.date,'Branch':s.branch||'','Category':s.category,'Discipline':s.discipline||'',
      'Item':s.item||s.description||'','Availment':s.availment||'','New/Renew':s.saleKind||'',
      'Qty':s.qty||1,'Amount (PHP)':s.amount,'Method':s.method||'','Admin':s.enteredBy||'','Source':s.source||'',
    }));
    exportRowsToExcel(rows, 'Sales '+month, 'roshan-sales-'+month);
  };
  toolbar.appendChild(exBtn);
  if(curRole()==='Admin' || accessTier(curRole())==='SuperAdmin'){
    const b=document.createElement('button'); b.className='btn primary'; b.textContent='+ Log sale';
    b.onclick=()=>{ state.modal={type:'newSale'}; render(); };
    toolbar.appendChild(b);
  }
  head.appendChild(toolbar);
  el.appendChild(head);
  toolbar.querySelector('#sales-month').onchange = (e)=>{ state.salesMonth = e.target.value; render(); };

  if(monthSales.length===0){
    const e=document.createElement('div'); e.className='empty'; e.textContent='No sales for this month yet.'; el.appendChild(e); return;
  }
  const table = document.createElement('table'); table.className='simple'; table.style.minWidth='820px';
  table.innerHTML = `<thead><tr><th>Date</th><th>Branch</th><th>Category</th><th>Item</th><th>Availment</th><th>Kind</th><th>Admin</th><th style="text-align:right">Amount</th></tr></thead>`;
  const tbody = document.createElement('tbody');
  [...monthSales].sort((a,b)=>b.date.localeCompare(a.date)).forEach(s=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${fmtDate(s.date)}</td><td>${escapeHtml(s.branch||'—')}</td><td>${escapeHtml(s.category)}${s.discipline?` <span class="hint">(${escapeHtml(s.discipline)})</span>`:''}</td><td>${escapeHtml(s.item||s.description||'—')}</td><td>${escapeHtml(s.availment||'—')}</td><td>${s.saleKind?`<span class="badge ${s.saleKind==='New'?'ok':'neutral'}">${s.saleKind}</span>`:'—'}</td><td>${escapeHtml(s.enteredBy||'—')}</td><td style="text-align:right;font-family:var(--font-m)">${fmtMoney(s.amount)}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  const scroll=document.createElement('div'); scroll.style.overflowX='auto'; scroll.appendChild(table);
  const tableCard = document.createElement('div'); tableCard.className='card'; tableCard.appendChild(scroll);
  el.appendChild(tableCard);
}


// ============ DRINKS & MERCHANDISE (separate month-by-month report) ============
function renderMerchReport(el){
  const merch = state.sales.filter(s=>(s.category||'')==='Drinks & Merchandise');
  if(!state.merchYear) state.merchYear = Number((state.salesMonth||'2026-01').slice(0,4));
  if(!state.merchBranch) state.merchBranch = 'All';
  const yr = state.merchYear, branch = state.merchBranch;

  const intro = document.createElement('div'); intro.className='notice';
  intro.textContent = 'Drinks & Merchandise is tracked separately from core service sales. This is your month-by-month view.';
  el.appendChild(intro);

  // Filter bar
  const bar = document.createElement('div'); bar.className='toolbar'; bar.style.marginBottom='16px';
  const yrs = [...new Set(merch.map(s=>Number(s.date.slice(0,4))))].sort();
  if(!yrs.includes(yr) && yrs.length) state.merchYear = yrs[yrs.length-1];
  const ySel = document.createElement('select');
  ySel.innerHTML = (yrs.length?yrs:[yr]).map(y=>`<option value="${y}" ${state.merchYear===y?'selected':''}>${y}</option>`).join('');
  ySel.onchange = ()=>{ state.merchYear = Number(ySel.value); render(); };
  bar.appendChild(ySel);
  const brSel = document.createElement('select');
  brSel.innerHTML = ['All','Manila','Malabon'].map(b=>`<option value="${b}" ${branch===b?'selected':''}>${b==='All'?'Both branches':b}</option>`).join('');
  brSel.onchange = ()=>{ state.merchBranch = brSel.value; render(); };
  bar.appendChild(brSel);
  const exBtn = document.createElement('button'); exBtn.className='btn'; exBtn.textContent='Export to Excel';
  bar.appendChild(exBtn);
  el.appendChild(bar);

  if(!merch.length){
    const e=document.createElement('div'); e.className='empty';
    e.textContent='No Drinks & Merchandise sales loaded yet.';
    el.appendChild(e); return;
  }

  // Monthly totals for the year
  const inScope = (s)=> Number(s.date.slice(0,4))===yr && (branch==='All'||s.branch===branch);
  const scoped = merch.filter(inScope);
  const monthly = new Array(12).fill(0);
  const monthlyMnl = new Array(12).fill(0), monthlyMbn = new Array(12).fill(0);
  scoped.forEach(s=>{ const m=Number(s.date.slice(5,7))-1; monthly[m]+=s.amount; });
  merch.filter(s=>Number(s.date.slice(0,4))===yr).forEach(s=>{
    const m=Number(s.date.slice(5,7))-1;
    if(s.branch==='Manila') monthlyMnl[m]+=s.amount; else if(s.branch==='Malabon') monthlyMbn[m]+=s.amount;
  });
  const yearTotal = monthly.reduce((a,b)=>a+b,0);

  // Headline
  const head = document.createElement('div'); head.className='card';
  const activeMonths = monthly.filter(v=>v>0).length;
  head.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;">
    <h2 style="font-size:15px;">Drinks & Merchandise — ${yr}${branch!=='All'?' · '+branch:''}</h2>
    <div style="text-align:right;"><div style="font-size:20px;font-weight:700;color:var(--lime);">${fmtMoney(yearTotal)}</div>
      <div class="hint">${activeMonths?'avg '+fmtMoney(yearTotal/activeMonths)+'/mo':''}</div></div>
  </div>`;
  el.appendChild(head);

  // Chart: month by month
  const chartCard = document.createElement('div'); chartCard.className='card';
  chartCard.innerHTML = '<h2 style="font-size:13px;color:var(--ink-1);margin-bottom:12px;">Month-by-month sales</h2>';
  const cv = document.createElement('canvas'); cv.style.maxHeight='300px'; chartCard.appendChild(cv);
  el.appendChild(chartCard);
  setTimeout(()=>{
    if(typeof Chart==='undefined') return;
    if(cv._c) cv._c.destroy();
    const datasets = branch==='All'
      ? [{label:'Manila',data:monthlyMnl,backgroundColor:'#7f9dc4',borderRadius:4},
         {label:'Malabon',data:monthlyMbn,backgroundColor:'#c96b6b',borderRadius:4}]
      : [{label:'Sales',data:monthly,backgroundColor:'#7fae82',borderRadius:4}];
    cv._c = new Chart(cv,{type:'bar',data:{labels:MONTH_NAMES,datasets},options:barOpts()});
  },30);

  // Table: month by month
  const tableCard = document.createElement('div'); tableCard.className='card';
  const t = document.createElement('table'); t.className='simple'; t.style.width='100%';
  t.innerHTML = branch==='All'
    ? '<thead><tr><th>Month</th><th style="text-align:right">Manila</th><th style="text-align:right">Malabon</th><th style="text-align:right">Total</th></tr></thead>'
    : '<thead><tr><th>Month</th><th style="text-align:right">Sales</th></tr></thead>';
  const tb = document.createElement('tbody');
  let prev=null;
  MONTH_NAMES.forEach((mn,i)=>{
    if(branch==='All'){
      if(monthlyMnl[i]===0 && monthlyMbn[i]===0) return;
      const tot=monthlyMnl[i]+monthlyMbn[i];
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${mn}</td><td style="text-align:right;font-family:var(--font-m)">${fmtMoney(monthlyMnl[i]).replace('PHP ','')}</td><td style="text-align:right;font-family:var(--font-m)">${fmtMoney(monthlyMbn[i]).replace('PHP ','')}</td><td style="text-align:right;font-family:var(--font-m)">${fmtMoney(tot).replace('PHP ','')}</td>`;
      tb.appendChild(tr);
    } else {
      if(monthly[i]===0) return;
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${mn}</td><td style="text-align:right;font-family:var(--font-m)">${fmtMoney(monthly[i]).replace('PHP ','')}</td>`;
      tb.appendChild(tr);
    }
  });
  const totRow=document.createElement('tr'); totRow.style.cssText='font-weight:700;border-top:2px solid var(--line);';
  totRow.innerHTML = branch==='All'
    ? `<td>Total</td><td style="text-align:right;font-family:var(--font-m)">${fmtMoney(monthlyMnl.reduce((a,b)=>a+b,0)).replace('PHP ','')}</td><td style="text-align:right;font-family:var(--font-m)">${fmtMoney(monthlyMbn.reduce((a,b)=>a+b,0)).replace('PHP ','')}</td><td style="text-align:right;font-family:var(--font-m)">${fmtMoney(yearTotal).replace('PHP ','')}</td>`
    : `<td>Total</td><td style="text-align:right;font-family:var(--font-m)">${fmtMoney(yearTotal).replace('PHP ','')}</td>`;
  tb.appendChild(totRow);
  t.appendChild(tb); tableCard.appendChild(t);
  el.appendChild(tableCard);

  exBtn.onclick = ()=>{
    const rows = MONTH_NAMES.map((mn,i)=>({
      'Month':mn, 'Manila':monthlyMnl[i], 'Malabon':monthlyMbn[i], 'Total':monthlyMnl[i]+monthlyMbn[i]
    })).filter(r=>r.Total>0);
    exportRowsToExcel(rows, 'Drinks & Merchandise '+yr, 'roshan-drinks-merch-'+yr);
  };
}

// ============ DRINKS & MERCHANDISE END ============
const SERVICES_ORDER = ['GYM','HIIT','Personal Training','Martial Arts','OTHERS'];
const QUARTERS = {1:'Q1',2:'Q1',3:'Q1',4:'Q2',5:'Q2',6:'Q2',7:'Q3',8:'Q3',9:'Q3',10:'Q4',11:'Q4',12:'Q4'};

// Per-admin monthly figures. Jan–Jun from the Admin Sales Tracker xlsx; July from the
// uploaded July POS files (core services + Keyfob/access card as OTHERS). Ela's July is the
// Manila All-Staff total minus Andre+Mica+Emman. Francis had no July file in the folder.
const ADMIN_PERF_2026 = {
  year: 2026,
  months: [1,2,3,4,5,6,7],
  admins: {
    'Andre':   { branch:'Manila',  sales: [510726, 408059, 392215, 608596, 491463, 495741, 483011], target: [425000, 425000, 425000, 500000, 425000, 425000, 425000] },
    'Mica':    { branch:'Manila',  sales: [321623, 286770, 529497, 511746, 245313, 340170, 103237], target: [425000, 425000, 425000, 500000, 425000, 425000, 212500] },
    'Loraine': { branch:'Malabon', sales: [297010, 285923, 240550, 365530, 294747, 441708, 394564], target: [325000, 325000, 325000, 400000, 325000, 375000, 375000] },
    'Kloe':    { branch:'Malabon', sales: [361883, 247940, 410304, 448116, 256751,  69000, 219620], target: [325000, 325000, 325000, 400000, 325000, 275000, 375000] },
    'Francis': { branch:'Malabon', sales: [0, 0, 0, 0, 0, 43849, 0], target: [0, 0, 0, 0, 0, 100000, 0] },
    'Ela':     { branch:'Manila',  sales: [0, 58970, 31890, 22360, 43367, 22670, 34377], target: [0, 0, 0, 0, 0, 0, 0] },
    'Emman':   { branch:'Manila',  sales: [0, 0, 0, 0, 0, 0, 189850], target: [0, 0, 0, 0, 0, 0, 212500] },
  }
};

// Editable per-admin monthly quotas. Manual edits are layered over the tracker defaults
// above and saved in this browser (localStorage). Swap load/save for an API later to share.
const ADMIN_QUOTA_LS_KEY = 'roshan.adminQuota.2026';
function loadAdminQuotaOverrides(){
  if(state.adminQuotaOverrides) return state.adminQuotaOverrides;
  let o={};
  try{ if(typeof localStorage!=='undefined'){ const raw=localStorage.getItem(ADMIN_QUOTA_LS_KEY); if(raw) o=JSON.parse(raw)||{}; } }catch(e){ o={}; }
  state.adminQuotaOverrides=o; return o;
}
function saveAdminQuotaOverride(name, monthNum, value){
  const o=loadAdminQuotaOverrides(); const key=name+':'+monthNum;
  if(value===null||value===undefined||value===''){ delete o[key]; }
  else o[key]=Number(value)||0;
  try{ if(typeof localStorage!=='undefined') localStorage.setItem(ADMIN_QUOTA_LS_KEY, JSON.stringify(o)); }catch(e){}
}
function adminTargetFor(name, monthNum){
  const o=loadAdminQuotaOverrides(); const key=name+':'+monthNum;
  if(Object.prototype.hasOwnProperty.call(o,key)) return Number(o[key])||0;
  const d=ADMIN_PERF_2026.admins[name]; if(!d) return 0;
  const idx=ADMIN_PERF_2026.months.indexOf(monthNum);
  return idx>=0 ? (Number(d.target[idx])||0) : 0;
}
// Match a POS "Staff" / entered_by value to one of our admin short names.
// Most-specific tokens first so "Michaela..." maps to Mica, not Ela.
const ADMIN_NAME_TOKENS = { Mica:['michaela','mica'], Emman:['emmannoel','emman'], Andre:['andre'],
  Loraine:['loraine'], Kloe:['kloe'], Francis:['francis'], Ela:['ela'] };
function adminOfName(enteredBy){
  const s=(enteredBy||'').trim().toLowerCase(); if(!s) return null;
  for(const name of Object.keys(ADMIN_PERF_2026.admins)){ if(s===name.toLowerCase()) return name; }
  for(const name of ['Mica','Emman','Andre','Loraine','Kloe','Francis','Ela']){
    if(ADMIN_NAME_TOKENS[name].some(tok=>s.includes(tok))) return name;
  }
  return null;
}
// An admin's sales for a month: embedded (Jan–Jul) or, from Aug on, the uploaded POS report.
function adminSalesForMonth(name, monthNum){
  const perf=ADMIN_PERF_2026; const idx=perf.months.indexOf(monthNum);
  if(idx>=0) return Number(perf.admins[name].sales[idx])||0;
  let sum=0;
  state.sales.forEach(s=>{
    if(!isPosSale(s)||!isCoreSale(s)) return;
    if(Number(s.date.slice(0,4))!==perf.year) return;
    if(Number(s.date.slice(5,7))!==monthNum) return;
    if(adminOfName(s.enteredBy)!==name) return;
    sum+=s.amount;
  });
  return sum;
}
// Months to show: embedded Jan–Jul plus any later month that has uploaded per-admin POS sales.
function effectiveAdminMonths(){
  const perf=ADMIN_PERF_2026; const set=new Set(perf.months);
  const maxEmb=Math.max.apply(null, perf.months);
  state.sales.forEach(s=>{
    if(!isPosSale(s)||!isCoreSale(s)) return;
    if(Number(s.date.slice(0,4))!==perf.year) return;
    const m=Number(s.date.slice(5,7));
    if(m>maxEmb && adminOfName(s.enteredBy)) set.add(m);
  });
  return [...set].sort((a,b)=>a-b);
}

function renderSalesReports(el){
  if(!state.reportWhich) state.reportWhich = 'category';
  if(!state.reportBranch) state.reportBranch = 'All';
  if(!state.reportPeriod) state.reportPeriod = 'month';
  if(!state.reportMonth) state.reportMonth = state.salesMonth;
  const yr = Number(state.reportMonth.slice(0,4));

  // Report picker
  const nav = document.createElement('div'); nav.className='toolbar'; nav.style.marginBottom='14px';
  const reports = [
    {k:'category', l:'1 · By Category'},
    {k:'service', l:'2 · By Service'},
    {k:'mvm', l:'3 · Month vs Month Sales'},
    {k:'target', l:'4 · Sales vs Target'},
    {k:'admin', l:'5 · Admin Sales Performance'},
    {k:'datacheck', l:'✓ Data Check'},
  ];
  reports.forEach(r=>{
    const b=document.createElement('button');
    b.className='btn sm'+(state.reportWhich===r.k?' primary':'');
    b.textContent=r.l; b.onclick=()=>{ state.reportWhich=r.k; render(); };
    nav.appendChild(b);
  });
  el.appendChild(nav);

  // Shared filter bar (branch + period + month/year)
  const bar = document.createElement('div'); bar.className='toolbar'; bar.style.marginBottom='16px';
  const brSel=document.createElement('select');
  brSel.innerHTML=['All','Manila','Malabon'].map(b=>`<option value="${b}" ${state.reportBranch===b?'selected':''}>${b==='All'?'Both branches':b}</option>`).join('');
  brSel.onchange=()=>{ state.reportBranch=brSel.value; render(); };
  bar.appendChild(brSel);

  // period mode only relevant to some reports
  if(['target','admin'].includes(state.reportWhich)){
    const pSel=document.createElement('select');
    pSel.innerHTML=[['month','Monthly'],['quarter','Quarterly'],['year','Yearly']].map(([v,l])=>`<option value="${v}" ${state.reportPeriod===v?'selected':''}>${l}</option>`).join('');
    pSel.onchange=()=>{ state.reportPeriod=pSel.value; render(); };
    bar.appendChild(pSel);
  }
  const mInput=document.createElement('input'); mInput.type='month'; mInput.value=state.reportMonth;
  mInput.onchange=(e)=>{ state.reportMonth=e.target.value; render(); };
  bar.appendChild(mInput);
  el.appendChild(bar);

  if(!state.sales.length){ const e=document.createElement('div'); e.className='empty'; e.textContent='No sales loaded yet.'; el.appendChild(e); return; }

  const host=document.createElement('div'); el.appendChild(host);
  const which=state.reportWhich;
  if(which==='category') reportByCategory(host);
  else if(which==='service') reportByService(host);
  else if(which==='mvm') reportMonthVsMonth(host);
  else if(which==='target') reportVsTarget(host);
  else if(which==='admin') reportAdminPerformance(host);
  else if(which==='datacheck') reportDataCheck(host);
}

// helpers
function salesInScope(branch, ym){
  return state.sales.filter(s=>{
    if(!isPosSale(s)) return false;  // admin-tracker rows are for the Admin report only
    if(!isCoreSale(s)) return false; // Drinks & Merchandise lives in its own dashboard
    if(branch!=='All' && (s.branch||'')!==branch) return false;
    if(ym && s.date.slice(0,7)!==ym) return false;
    return true;
  });
}
function targetFor(year, branch, monthNums){
  let min=0,med=0,max=0;
  (state.targets||[]).forEach(t=>{
    if(t.year!==year) return;
    if(branch==='All' ? t.branch!=='All' : t.branch!==branch) return;
    if(monthNums.includes(t.month)){ min+=Number(t.min_target); med+=Number(t.medial_target); max+=Number(t.max_target); }
  });
  return {min,med,max};
}
function moneyK(v){ return v>=1000?(v/1000).toFixed(0)+'k':String(Math.round(v)); }

// ---- Report 1: by category (service = category here per your taxonomy) ----
function reportByCategory(host){
  const ym=state.reportMonth, branch=state.reportBranch;
  const sales=salesInScope(branch, ym);
  const by={}; sales.forEach(s=>{ const c=s.category||'OTHERS'; by[c]=(by[c]||0)+s.amount; });
  const total=Object.values(by).reduce((a,b)=>a+b,0);
  titleCard(host, `Sales by Category — ${monthLabel(ym)}${branch!=='All'?' · '+branch:''}`, total);
  const pairs=Object.entries(by).sort((a,b)=>b[1]-a[1]);
  twoCol(host,
    (c)=>pieCanvas(c, pairs.map(p=>p[0]), pairs.map(p=>p[1])),
    (c)=>breakdownTable(c, pairs, total)
  );
}

// ---- Report 2: by service + detailed category breakdown ----
function reportByService(host){
  const ym=state.reportMonth, branch=state.reportBranch;
  const sales=salesInScope(branch, ym);
  const by={}; SERVICES_ORDER.forEach(s=>by[s]=0);
  sales.forEach(s=>{ const c=SERVICES_ORDER.includes(s.category)?s.category:'OTHERS'; by[c]=(by[c]||0)+s.amount; });
  const total=Object.values(by).reduce((a,b)=>a+b,0);
  titleCard(host, `Sales by Service — ${monthLabel(ym)}${branch!=='All'?' · '+branch:''}`, total);
  const pairs=SERVICES_ORDER.map(s=>[s,by[s]]).filter(p=>p[1]>0);
  twoCol(host,
    (c)=>pieCanvas(c, pairs.map(p=>p[0]), pairs.map(p=>p[1])),
    (c)=>breakdownTable(c, pairs, total)
  );
  // If both branches, add a per-branch grouped bar
  if(branch==='All'){
    const card=sectionCard(host,'Service by branch');
    const cv=document.createElement('canvas'); cv.style.maxHeight='300px'; card.appendChild(cv);
    const mnl=SERVICES_ORDER.map(s=>salesInScope('Manila',ym).filter(x=>x.category===s).reduce((a,b)=>a+b.amount,0));
    const mbn=SERVICES_ORDER.map(s=>salesInScope('Malabon',ym).filter(x=>x.category===s).reduce((a,b)=>a+b.amount,0));
    setTimeout(()=>{ if(typeof Chart==='undefined')return; if(cv._c)cv._c.destroy();
      cv._c=new Chart(cv,{type:'bar',data:{labels:SERVICES_ORDER,datasets:[
        {label:'Manila',data:mnl,backgroundColor:'#7f9dc4',borderRadius:4},
        {label:'Malabon',data:mbn,backgroundColor:'#c96b6b',borderRadius:4}]},options:barOpts()});},30);
  }

  // Detailed category breakdown (per your POS report categories)
  const detCard=sectionCard(host,'Sales per category (detailed)');
  const byDet={};
  sales.forEach(s=>{ const d=(s.description||s.item||s.category||'—'); byDet[d]=(byDet[d]||0)+s.amount; });
  const detPairs=Object.entries(byDet).sort((a,b)=>b[1]-a[1]);
  const dt=document.createElement('table'); dt.className='simple'; dt.style.width='100%';
  dt.innerHTML='<thead><tr><th>Category</th><th style="text-align:right">Sales</th><th style="text-align:right">Share</th></tr></thead>';
  const dtb=document.createElement('tbody');
  detPairs.forEach(([k,v])=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${escapeHtml(k)}</td><td style="text-align:right;font-family:var(--font-m)">${fmtMoney(v).replace('PHP ','')}</td><td style="text-align:right">${(v/total*100).toFixed(1)}%</td>`;
    dtb.appendChild(tr);
  });
  dt.appendChild(dtb); detCard.appendChild(dt);
}

// ---- Report 3: month vs month, both branches ----
function reportMonthVsMonth(host){
  const yr=Number(state.reportMonth.slice(0,4));
  const months=[]; for(let m=1;m<=12;m++) months.push(`${yr}-${String(m).padStart(2,'0')}`);
  const mnl=months.map(ym=>salesInScope('Manila',ym).reduce((a,b)=>a+b.amount,0));
  const mbn=months.map(ym=>salesInScope('Malabon',ym).reduce((a,b)=>a+b.amount,0));
  const both=months.map((_,i)=>mnl[i]+mbn[i]);
  const totalY=both.reduce((a,b)=>a+b,0);
  titleCard(host,`Total Sales Month vs Month — ${yr}`, totalY);
  const card=sectionCard(host,'Monthly totals by branch');
  const cv=document.createElement('canvas'); cv.style.maxHeight='320px'; card.appendChild(cv);
  setTimeout(()=>{ if(typeof Chart==='undefined')return; if(cv._c)cv._c.destroy();
    cv._c=new Chart(cv,{type:'bar',data:{labels:MONTH_NAMES,datasets:[
      {label:'Manila',data:mnl,backgroundColor:'#7f9dc4',borderRadius:4},
      {label:'Malabon',data:mbn,backgroundColor:'#c96b6b',borderRadius:4},
      {type:'line',label:'Combined',data:both,borderColor:'#7fae82',borderWidth:2,tension:.3,pointRadius:3}
    ]},options:barOpts()});},30);
  // MoM growth table
  const rows=months.map((ym,i)=>{
    const prev=i>0?both[i-1]:0;
    const g=prev?((both[i]-prev)/prev*100):0;
    return [MONTH_NAMES[i], mnl[i], mbn[i], both[i], i>0&&prev?(g>=0?'+':'')+g.toFixed(1)+'%':'—'];
  }).filter((r,i)=>both[i]>0);
  const tcard=sectionCard(host,'Month-on-month growth');
  tableFrom(tcard, ['Month','Manila','Malabon','Combined','MoM growth'], rows.map(r=>[
    r[0], fmtMoney(r[1]).replace('PHP ',''), fmtMoney(r[2]).replace('PHP ',''),
    fmtMoney(r[3]).replace('PHP ',''), r[4]
  ]));
}

// ---- Report 4: sales vs target (monthly / quarterly / yearly) ----
function reportVsTarget(host, opts){
  opts=opts||{};
  const showChart=opts.chart!==false, showTitle=opts.title!==false;
  const yr=Number(state.reportMonth.slice(0,4)), branch=state.reportBranch, period=state.reportPeriod;
  let buckets=[];
  if(period==='quarter'){ buckets=[{label:'Q1',months:[1,2,3]},{label:'Q2',months:[4,5,6]},{label:'Q3',months:[7,8,9]},{label:'Q4',months:[10,11,12]}]; }
  else if(period==='ytd'){ const endM=Number(state.reportMonth.slice(5,7)); for(let m=1;m<=endM;m++) buckets.push({label:MONTH_NAMES[m-1],months:[m]}); }
  else { for(let m=1;m<=12;m++) buckets.push({label:MONTH_NAMES[m-1],months:[m]}); }

  const rows=buckets.map(bk=>{
    const actual=bk.months.reduce((sum,m)=>sum+salesInScope(branch,`${yr}-${String(m).padStart(2,'0')}`).reduce((a,b)=>a+b.amount,0),0);
    const t=targetFor(yr,branch,bk.months);
    return {label:bk.label, actual, ...t};
  }).filter(r=>r.actual>0 || r.min>0);

  const totActual=rows.reduce((a,b)=>a+b.actual,0), totMin=rows.reduce((a,b)=>a+b.min,0);
  if(showTitle) titleCard(host, `Sales vs Target (${period}) — ${yr}${branch!=='All'?' · '+branch:''}`, totActual,
    totMin?`${(totActual/totMin*100).toFixed(1)}% of minimum target`:'');

  if(showChart){
    const card=sectionCard(host,'Actual vs targets');
    const cv=document.createElement('canvas'); cv.style.maxHeight='320px'; card.appendChild(cv);
    setTimeout(()=>{ if(typeof Chart==='undefined')return; if(cv._c)cv._c.destroy();
      cv._c=new Chart(cv,{data:{labels:rows.map(r=>r.label),datasets:[
        {type:'bar',label:'Actual',data:rows.map(r=>r.actual),backgroundColor:rows.map(r=>r.actual>=r.min&&r.min>0?'#7fae82':'#c96b6b'),borderRadius:4,order:3},
        {type:'line',label:'Min',data:rows.map(r=>r.min),borderColor:'#d1a56b',borderWidth:2,pointRadius:0,tension:.2,order:1},
        {type:'line',label:'Medial',data:rows.map(r=>r.med),borderColor:'#7f9dc4',borderWidth:1.5,borderDash:[5,4],pointRadius:0,order:1},
        {type:'line',label:'Max',data:rows.map(r=>r.max),borderColor:'#a892c4',borderWidth:1.5,borderDash:[2,3],pointRadius:0,order:1},
      ]},options:barOpts()});},30);
  }

  const tcard=sectionCard(host,'Detail');
  tableFrom(tcard,['Period','Actual','Min target','vs Min','Attainment','Medial','Max'],
    rows.map(r=>{
      const diff=r.actual-r.min;
      return [r.label, fmtMoney(r.actual).replace('PHP ',''), fmtMoney(r.min).replace('PHP ',''),
        (diff>=0?'+':'')+fmtMoney(Math.abs(diff)).replace('PHP ',''),
        r.min?(r.actual/r.min*100).toFixed(0)+'%':'—',
        fmtMoney(r.med).replace('PHP ',''), fmtMoney(r.max).replace('PHP ','')];
    }), rows.map(r=>r.actual>=r.min&&r.min>0));

  // Sales drivers: actual sales by service, sorted high-to-low, for the whole period shown
  const allMonths = period==='month' ? [Number(state.reportMonth.slice(5,7))]
    : period==='quarter' ? Object.keys(QUARTERS).filter(m=>QUARTERS[m]===QUARTERS[Number(state.reportMonth.slice(5,7))]).map(Number)
    : (function(){ const e=Number(state.reportMonth.slice(5,7)); const a=[]; for(let m=1;m<=e;m++)a.push(m); return a; })();
  const driverSales = state.sales.filter(s=>isPosSale(s)&&isCoreSale(s)&&Number(s.date.slice(0,4))===yr&&allMonths.includes(Number(s.date.slice(5,7)))&&(branch==='All'||s.branch===branch));
  const bySvc={}; driverSales.forEach(s=>{ const c=SERVICES_ORDER.includes(s.category)?s.category:'OTHERS'; bySvc[c]=(bySvc[c]||0)+s.amount; });
  const dtotal=Object.values(bySvc).reduce((a,b)=>a+b,0)||1;
  const driverPairs=Object.entries(bySvc).sort((a,b)=>b[1]-a[1]);
  const dcard=sectionCard(host,'Main sales drivers (actual, highest to lowest)');
  twoCol(dcard,
    (c)=>barhCanvas(c, driverPairs.map(p=>p[0]), driverPairs.map(p=>p[1])),
    (c)=>breakdownTable(c, driverPairs, dtotal)
  );
}


// ---- Report 5: Admin Sales Performance (from Admin Tracker, targets included) ----
function reportAdminPerformance(host){
  const yr=Number(state.reportMonth.slice(0,4)), branch=state.reportBranch, period=state.reportPeriod;
  let months=[], plabel='';
  if(period==='month'){ months=[Number(state.reportMonth.slice(5,7))]; plabel=monthLabel(state.reportMonth); }
  else if(period==='quarter'){ const q=QUARTERS[Number(state.reportMonth.slice(5,7))];
    months=Object.keys(QUARTERS).filter(m=>QUARTERS[m]===q).map(Number); plabel=`${q} ${yr}`; }
  else { months=[1,2,3,4,5,6,7,8,9,10,11,12]; plabel=String(yr); }

  // ADMIN data only (from the Admin Sales Tracker), never the POS category data.
  const sales=state.sales.filter(s=>isAdminSale(s) && Number(s.date.slice(0,4))===yr
    && months.includes(Number(s.date.slice(5,7))) && (branch==='All'||s.branch===branch));
  const by={}; sales.forEach(s=>{ const a=(s.enteredBy||'').trim()||'Unknown'; by[a]=(by[a]||0)+s.amount; });
  const total=Object.values(by).reduce((a,b)=>a+b,0);
  const t=targetFor(yr,branch,months);

  titleCard(host, `Admin Sales Performance — ${plabel}${branch!=='All'?' · '+branch:''}`, total,
    t.min?`team at ${(total/t.min*100).toFixed(1)}% of minimum target (${fmtMoney(t.min)})`:'');

  if(!Object.keys(by).length){
    const e=document.createElement('div'); e.className='notice';
    e.textContent='No admin sales data for this period. This report is powered by the Admin Sales Tracker; going forward, each shift\u2019s POS upload (tagged to its admin) adds to it.';
    host.appendChild(e); return;
  }

  const pairs=Object.entries(by).sort((a,b)=>b[1]-a[1]);
  twoCol(host,
    (c)=>barhCanvas(c, pairs.map(p=>p[0]), pairs.map(p=>p[1])),
    (c)=>pieCanvas(c, pairs.map(p=>p[0]), pairs.map(p=>p[1]))
  );

  // Table with target context
  const tcard=sectionCard(host,'Per-admin detail vs target');
  const rows=pairs.map(([a,v])=>[
    a, fmtMoney(v).replace('PHP ',''),
    (total?(v/total*100).toFixed(1):'0')+'%',
    t.min?(v/t.min*100).toFixed(1)+'%':'—'
  ]);
  tableFrom(tcard, ['Admin','Sales','Share of team','of team min target'], rows);

  // Team vs target summary bar
  if(t.min){
    const scard=sectionCard(host,'Team total vs target');
    const cv=document.createElement('canvas'); cv.style.maxHeight='150px'; scard.appendChild(cv);
    setTimeout(()=>{ if(typeof Chart==='undefined')return; if(cv._c)cv._c.destroy();
      cv._c=new Chart(cv,{type:'bar',data:{labels:['Team'],datasets:[
        {label:'Actual',data:[total],backgroundColor:total>=t.min?'#7fae82':'#c96b6b',borderRadius:4},
        {label:'Min target',data:[t.min],backgroundColor:'rgba(255,255,255,.15)',borderRadius:4},
      ]},options:{...barOpts(), indexAxis:'y'}});},30);
  }
  const note=document.createElement('div'); note.className='notice';
  note.textContent='Admin Sales Performance is sourced from the Roshan Gym Admin Sales Tracker (core services, excludes Drinks & Merchandise). Targets are the branch monthly targets for the selected period.';
  host.appendChild(note);
}

// ---- Data Check: verify loaded totals against source files ----
function reportDataCheck(host){
  const yr=Number(state.reportMonth.slice(0,4)), branch=state.reportBranch;
  const intro=document.createElement('div'); intro.className='notice';
  intro.innerHTML='Compare these dashboard totals against the <strong>TOTAL GROSS</strong> at the bottom of each POS Sales Breakdown file. They should match (core services; Drinks & Merchandise shown separately). Going forward, every POS upload shows its grand total on the review screen before you import.';
  host.appendChild(intro);

  // POS core totals by month/branch
  const posMonthly={}, merchMonthly={}, adminMonthly={};
  state.sales.forEach(s=>{
    const y=Number(s.date.slice(0,4)); if(y!==yr) return;
    const m=Number(s.date.slice(5,7)); const b=s.branch||'—';
    if(branch!=='All' && b!==branch) return;
    const key=`${m}|${b}`;
    if(s.source==='admin-tracker'){ adminMonthly[key]=(adminMonthly[key]||0)+s.amount; }
    else if((s.category||'')==='Drinks & Merchandise'){ merchMonthly[key]=(merchMonthly[key]||0)+s.amount; }
    else { posMonthly[key]=(posMonthly[key]||0)+s.amount; }
  });

  const card=sectionCard(host,`Loaded totals by month — ${yr}`);
  const t=document.createElement('table'); t.className='simple'; t.style.width='100%';
  t.innerHTML='<thead><tr><th>Month</th><th>Branch</th><th style="text-align:right">Core services (POS)</th><th style="text-align:right">Drinks & Merch</th><th style="text-align:right">Admin tracker</th></tr></thead>';
  const tb=document.createElement('tbody');
  const branches = branch==='All'?['Manila','Malabon']:[branch];
  let anyRow=false;
  for(let m=1;m<=12;m++){
    branches.forEach(b=>{
      const k=`${m}|${b}`;
      const pos=posMonthly[k]||0, mer=merchMonthly[k]||0, adm=adminMonthly[k]||0;
      if(pos===0&&mer===0&&adm===0) return;
      anyRow=true;
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${MONTH_NAMES[m-1]}</td><td>${escapeHtml(b)}</td>
        <td style="text-align:right;font-family:var(--font-m)">${fmtMoney(pos).replace('PHP ','')}</td>
        <td style="text-align:right;font-family:var(--font-m)">${mer?fmtMoney(mer).replace('PHP ',''):'—'}</td>
        <td style="text-align:right;font-family:var(--font-m)">${adm?fmtMoney(adm).replace('PHP ',''):'—'}</td>`;
      tb.appendChild(tr);
    });
  }
  t.appendChild(tb); card.appendChild(t);
  if(!anyRow) card.innerHTML+='<div class="empty">No data loaded for this year.</div>';

  // Note about admin vs POS difference
  const n2=document.createElement('div'); n2.className='notice';
  n2.innerHTML='<strong>Why two columns can differ:</strong> "Core services (POS)" comes from the POS Sales Breakdown files and drives reports 1–4. "Admin tracker" comes from the Roshan Gym Admin Sales Tracker and drives report 5 only. They cover the same sales from different systems, so small differences are normal.';
  host.appendChild(n2);
}
// ===================== SALES DASHBOARD — sub-tab reports =====================
// Shared helpers for the four report sub-tabs (Performance per Branch, Sales by
// Category, Sales by Item, Sales by Admin). July is intentionally absent from the
// loaded POS data and from the admin xlsx, so it stays hidden until uploaded.
function money(v){ return fmtMoney(v).replace('PHP ',''); }
function reportEmpty(host){ const e=document.createElement('div'); e.className='empty'; e.textContent='No sales loaded yet.'; host.appendChild(e); }
function ensureReportMonth(){
  if(state.reportMonth) return;
  let latest=null;
  state.sales.forEach(s=>{ if(!isPosSale(s)||!isCoreSale(s))return; const ym=s.date.slice(0,7);
    if(!latest||ym>latest)latest=ym; });
  state.reportMonth = latest || '2026-07';
}
function periodMonths(period, ym){
  const m=Number(ym.slice(5,7));
  if(period==='quarter'){ const q=QUARTERS[m]; return Object.keys(QUARTERS).filter(k=>QUARTERS[k]===q).map(Number); }
  if(period==='year'){ return [1,2,3,4,5,6,7,8,9,10,11,12]; }
  return [m];
}
function periodLabelFor(period, ym, yr){
  if(period==='quarter') return `${QUARTERS[Number(ym.slice(5,7))]} ${yr}`;
  if(period==='year') return String(yr);
  return monthLabel(ym);
}
function salesInPeriod(branch, yr, monthsArr){
  return state.sales.filter(s=>{
    if(!isPosSale(s)||!isCoreSale(s)) return false;
    if(branch!=='All' && (s.branch||'')!==branch) return false;
    if(Number(s.date.slice(0,4))!==yr) return false;
    return monthsArr.includes(Number(s.date.slice(5,7)));
  });
}
function minTargetSeries(yr, branch){
  const arr=new Array(12).fill(0);
  const pull=(br)=>{ (state.targets||[]).forEach(t=>{ if(t.year===yr && t.branch===br) arr[t.month-1]=Number(t.min_target)||0; }); };
  if(branch==='All'){
    pull('All');
    if(arr.every(v=>v===0)){
      const m=new Array(12).fill(0);
      (state.targets||[]).forEach(t=>{ if(t.year===yr && (t.branch==='Manila'||t.branch==='Malabon')) m[t.month-1]+=Number(t.min_target)||0; });
      return m;
    }
    return arr;
  }
  pull(branch); return arr;
}
function salesReportFilterBar(host, opts){
  opts=opts||{};
  const bar=document.createElement('div'); bar.className='toolbar'; bar.style.marginBottom='16px';
  if(opts.branch){
    const brSel=document.createElement('select');
    brSel.innerHTML=['All','Manila','Malabon'].map(b=>`<option value="${b}" ${state.reportBranch===b?'selected':''}>${b==='All'?'Both branches':b}</option>`).join('');
    brSel.onchange=()=>{ state.reportBranch=brSel.value; render(); };
    bar.appendChild(brSel);
  }
  if(opts.period){
    const pSel=document.createElement('select');
    pSel.innerHTML=[['month','Monthly'],['quarter','Quarterly'],['year','Yearly']].map(([v,l])=>`<option value="${v}" ${state.reportPeriod===v?'selected':''}>${l}</option>`).join('');
    pSel.onchange=()=>{ state.reportPeriod=pSel.value; render(); };
    bar.appendChild(pSel);
  }
  const mInput=document.createElement('input'); mInput.type='month'; mInput.value=state.reportMonth;
  mInput.onchange=(e)=>{ state.reportMonth=e.target.value; render(); };
  bar.appendChild(mInput);
  host.appendChild(bar);
}

// ---- Unified period filter: Monthly / Quarterly / YTD (instruction 3) ----
const RKEYS = {period:'reportPeriod', month:'reportMonth', quarter:'reportQuarter', branch:'reportBranch'};
const SKEYS = {period:'salesPeriod', month:'salesMonth', quarter:'salesQuarter', branch:'salesBranch'};
function distinctYears(){
  const ys=new Set();
  state.sales.forEach(s=>{ if(isPosSale(s)&&isCoreSale(s)) ys.add(Number(s.date.slice(0,4))); });
  return ys.size?[...ys].sort():[Number((state.reportMonth||'2026-06').slice(0,4))];
}
function resolvePeriod(periodVal, monthVal, quarterVal){
  monthVal = monthVal || '2026-06';
  const yr=Number(monthVal.slice(0,4));
  if(periodVal==='quarter'){
    const q=quarterVal || QUARTERS[Number(monthVal.slice(5,7))] || 'Q1';
    const months=Object.keys(QUARTERS).filter(k=>QUARTERS[k]===q).map(Number);
    return {yr, months, label:`${q} ${yr}`, kind:'quarter', q};
  }
  if(periodVal==='ytd'){
    const endM=Number(monthVal.slice(5,7));
    const months=[]; for(let m=1;m<=endM;m++) months.push(m);
    return {yr, months, label:`YTD (Jan–${MONTH_NAMES[endM-1]} ${yr})`, kind:'ytd', endM};
  }
  const m=Number(monthVal.slice(5,7));
  return {yr, months:[m], label:monthLabel(monthVal), kind:'month', m};
}
function periodFilterBar(host, keys, opts){
  opts=opts||{};
  const bar=document.createElement('div'); bar.className='toolbar'; bar.style.marginBottom='16px';
  if(opts.branch){
    const brSel=document.createElement('select');
    brSel.innerHTML=['All','Manila','Malabon'].map(b=>`<option value="${b}" ${state[keys.branch]===b?'selected':''}>${b==='All'?'Both branches':b}</option>`).join('');
    brSel.onchange=()=>{ state[keys.branch]=brSel.value; render(); };
    bar.appendChild(brSel);
  }
  const period=state[keys.period]||'month';
  const pSel=document.createElement('select');
  pSel.innerHTML=[['month','Monthly'],['quarter','Quarterly'],['ytd','YTD']].map(([v,l])=>`<option value="${v}" ${period===v?'selected':''}>${l}</option>`).join('');
  pSel.onchange=()=>{ state[keys.period]=pSel.value; render(); };
  bar.appendChild(pSel);
  const cur=state[keys.month]||'2026-06'; const yr=Number(cur.slice(0,4));
  if(period==='month'){
    const mInput=document.createElement('input'); mInput.type='month'; mInput.value=cur;
    mInput.onchange=(e)=>{ state[keys.month]=e.target.value; render(); };
    bar.appendChild(mInput);
  } else {
    const years=distinctYears();
    const ySel=document.createElement('select');
    ySel.innerHTML=years.map(y=>`<option value="${y}" ${yr===y?'selected':''}>${y}</option>`).join('');
    ySel.onchange=(e)=>{ state[keys.month]=e.target.value+'-'+cur.slice(5,7); render(); };
    bar.appendChild(ySel);
    if(period==='quarter'){
      const q=state[keys.quarter] || QUARTERS[Number(cur.slice(5,7))] || 'Q1';
      const qSel=document.createElement('select');
      qSel.innerHTML=['Q1','Q2','Q3','Q4'].map(x=>`<option value="${x}" ${q===x?'selected':''}>${x}</option>`).join('');
      qSel.onchange=()=>{ state[keys.quarter]=qSel.value; render(); };
      bar.appendChild(qSel);
    }
  }
  host.appendChild(bar);
}

// Monthly Actual vs Target table (numbers summary) — used in Overview + Branch perf.
function monthlyActualVsTargetTable(host, yr, branch, endM){
  endM = endM || 12;
  const minT=minTargetSeries(yr, branch);
  const rows=[];
  let prev=null, totA=0, totMin=0;
  for(let m=1;m<=endM;m++){
    const actual=salesInPeriod(branch,yr,[m]).reduce((a,b)=>a+b.amount,0);
    const min=minT[m-1]||0;
    if(actual===0 && min===0) continue;
    const ou=actual-min;
    const attain=min?(actual/min*100):0;
    const mom = (prev!==null && prev>0) ? ((actual-prev)/prev*100) : null;
    rows.push([MONTH_NAMES[m-1], money(actual), money(min),
      (ou>=0?'+':'')+money(Math.abs(ou)),
      min?attain.toFixed(0)+'%':'—',
      mom===null?'—':(mom>=0?'+':'')+mom.toFixed(1)+'%']);
    totA+=actual; totMin+=min; prev=actual;
  }
  const card=sectionCard(host, `Actual vs target by month${branch!=='All'?' · '+branch:''}`);
  tableFrom(card, ['Month','Actual','Min target','Over/Under','Attainment','MoM Δ'], rows,
    rows.map((r,i)=>{ const a=parseFloat(r[1].replace(/,/g,'')), mn=parseFloat(r[2].replace(/,/g,'')); return mn?a>=mn:true; }));
  // summary row
  const ou=totA-totMin;
  const sum=document.createElement('div'); sum.className='notice';
  sum.innerHTML=`<strong>Total:</strong> Actual ${fmtMoney(totA)} vs min target ${fmtMoney(totMin)} — `
    +`${totMin?(totA/totMin*100).toFixed(1):'—'}% attainment, ${ou>=0?'over':'under'} by ${fmtMoney(Math.abs(ou))}.`;
  card.appendChild(sum);
  return {totA, totMin};
}

// Actual vs Target per quarter, side by side (instruction: overview).
// Quarters with no loaded sales are skipped (2026 still in progress).
function quarterlyActualVsTarget(host, yr, branch){
  const quarters=[{q:'Q1',months:[1,2,3]},{q:'Q2',months:[4,5,6]},{q:'Q3',months:[7,8,9]},{q:'Q4',months:[10,11,12]}];
  const rows=quarters.map(qq=>{
    const actual=salesInPeriod(branch,yr,qq.months).reduce((a,b)=>a+b.amount,0);
    const t=targetFor(yr,branch,qq.months);
    return {q:qq.q, actual, min:t.min, med:t.med, max:t.max};
  }).filter(r=>r.actual>0);
  if(!rows.length) return;
  const card=sectionCard(host, `Actual vs Target by quarter${branch!=='All'?' · '+branch:''}`);
  const cv=document.createElement('canvas'); cv.style.maxHeight='300px'; card.appendChild(cv);
  setTimeout(()=>{ if(typeof Chart==='undefined')return; if(cv._c)cv._c.destroy();
    cv._c=new Chart(cv,{type:'bar',data:{labels:rows.map(r=>r.q),datasets:[
      {label:'Actual',data:rows.map(r=>r.actual),backgroundColor:rows.map(r=>r.min&&r.actual>=r.min?'#7fae82':'#c96b6b'),borderRadius:4},
      {label:'Min target',data:rows.map(r=>r.min),backgroundColor:'#d1a56b',borderRadius:4}
    ]},options:barOpts()});},30);
  tableFrom(card, ['Quarter','Actual','Min target','Over/Under','Attainment'],
    rows.map(r=>{ const d=r.actual-r.min; return [r.q, money(r.actual), money(r.min), (d>=0?'+':'')+money(Math.abs(d)), r.min?(r.actual/r.min*100).toFixed(0)+'%':'—']; }),
    rows.map(r=>r.min?r.actual>=r.min:true));
  const only=document.createElement('div'); only.className='hint'; only.style.marginTop='6px';
  only.textContent='Only quarters with loaded sales are shown — 2026 is still in progress.';
  card.appendChild(only);
}

// Data-driven performance summary + improvement steps (instruction 4).
function renderPerfNarrative(host, yr, branch, endM){
  endM = endM || 12;
  const minT=minTargetSeries(yr, branch);
  const mrows=[];
  for(let m=1;m<=endM;m++){
    const actual=salesInPeriod(branch,yr,[m]).reduce((a,b)=>a+b.amount,0);
    const min=minT[m-1]||0;
    if(actual===0 && min===0) continue;
    mrows.push({m, actual, min, attain:min?actual/min*100:0});
  }
  if(!mrows.length) return;
  const totA=mrows.reduce((a,b)=>a+b.actual,0), totMin=mrows.reduce((a,b)=>a+b.min,0);
  const attain=totMin?totA/totMin*100:0;
  const hit=mrows.filter(r=>r.min&&r.actual>=r.min).length;
  const withMin=mrows.filter(r=>r.min>0);
  const best=withMin.slice().sort((a,b)=>b.attain-a.attain)[0];
  const worst=withMin.slice().sort((a,b)=>a.attain-b.attain)[0];
  const first=mrows[0], last=mrows[mrows.length-1];
  const trendPct=first.actual?((last.actual-first.actual)/first.actual*100):0;
  // top / weakest category over the window
  const wSales=salesInPeriod(branch,yr,mrows.map(r=>r.m));
  const byCat={}; wSales.forEach(s=>{ const c=s.category||'OTHERS'; byCat[c]=(byCat[c]||0)+s.amount; });
  const catPairs=Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  const topCat=catPairs[0], lowCat=catPairs[catPairs.length-1];

  const card=sectionCard(host,'Summary & recommendations');
  const p=document.createElement('div'); p.style.cssText='color:var(--ink-1);line-height:1.6;font-size:13px;';
  const gap=totMin-totA;
  p.innerHTML =
    `Through this period, ${branch==='All'?'both branches':branch} booked <strong>${fmtMoney(totA)}</strong> against a minimum target of <strong>${fmtMoney(totMin)}</strong> — `
    +`<strong>${attain.toFixed(1)}%</strong> attainment, ${gap<=0?'ahead of':'short of'} minimum by ${fmtMoney(Math.abs(gap))}. `
    +`${hit} of ${mrows.length} month${mrows.length===1?'':'s'} cleared the minimum. `
    +(best?`Strongest month was <strong>${MONTH_NAMES[best.m-1]}</strong> (${best.attain.toFixed(0)}% of target); weakest was <strong>${MONTH_NAMES[worst.m-1]}</strong> (${worst.attain.toFixed(0)}%). `:'')
    +`Sales ${trendPct>=0?'rose':'fell'} ${Math.abs(trendPct).toFixed(0)}% from ${MONTH_NAMES[first.m-1]} to ${MONTH_NAMES[last.m-1]}. `
    +(topCat?`<strong>${topCat[0]}</strong> is the biggest driver (${(topCat[1]/totA*100).toFixed(0)}% of sales)`:'')
    +(lowCat&&catPairs.length>1?`, while <strong>${lowCat[0]}</strong> trails at ${(lowCat[1]/totA*100).toFixed(0)}%.`:'.');
  card.appendChild(p);

  const steps=[];
  if(gap>0){
    steps.push(`Close the ${fmtMoney(gap)} gap to minimum: at recent run-rate that's roughly ${fmtMoney(gap/Math.max(mrows.length,1))} more per month.`);
  } else {
    steps.push(`You're above minimum — push toward the medial/max tier by protecting the months that already over-perform.`);
  }
  if(worst && best && worst.attain < best.attain*0.8){
    steps.push(`Investigate ${MONTH_NAMES[worst.m-1]} (only ${worst.attain.toFixed(0)}% of target) — check staffing, promos, or seasonality versus ${MONTH_NAMES[best.m-1]}.`);
  }
  if(topCat) steps.push(`Lean into ${topCat[0]} (your top earner) with renewals/upsells, and build a small campaign to lift ${lowCat&&catPairs.length>1?lowCat[0]:'the lagging services'}.`);
  if(branch==='All'){
    const mnlT=salesInPeriod('Manila',yr,mrows.map(r=>r.m)).reduce((a,b)=>a+b.amount,0);
    const mbnT=salesInPeriod('Malabon',yr,mrows.map(r=>r.m)).reduce((a,b)=>a+b.amount,0);
    const lag = mnlT<mbnT?'Manila':'Malabon';
    steps.push(`${lag} is the smaller contributor this period — replicate the stronger branch's winning mix there.`);
  }
  const ul=document.createElement('ul'); ul.style.cssText='margin:12px 0 0 18px;color:var(--ink-1);line-height:1.6;font-size:13px;';
  steps.forEach(s=>{ const li=document.createElement('li'); li.innerHTML=s; ul.appendChild(li); });
  card.appendChild(ul);
  const dis=document.createElement('div'); dis.className='hint'; dis.style.marginTop='8px';
  dis.textContent='Auto-generated from the loaded figures — a starting point for discussion, not financial advice.';
  card.appendChild(dis);
}

// ---- Sub-tab 1: Performance per Branch (Month vs Month + Sales vs Target) ----
function renderBranchPerf(host){
  periodFilterBar(host, RKEYS, {branch:true});
  if(!state.sales.length){ reportEmpty(host); return; }
  const yr=Number(state.reportMonth.slice(0,4)), branch=state.reportBranch;
  const months=[]; for(let m=1;m<=12;m++) months.push(`${yr}-${String(m).padStart(2,'0')}`);
  const mnl=months.map(ym=>salesInScope('Manila',ym).reduce((a,b)=>a+b.amount,0));
  const mbn=months.map(ym=>salesInScope('Malabon',ym).reduce((a,b)=>a+b.amount,0));
  const both=months.map((_,i)=>mnl[i]+mbn[i]);
  const scope = branch==='Manila'?mnl : branch==='Malabon'?mbn : both;
  const scopeTotal=scope.reduce((a,b)=>a+b,0);
  titleCard(host, `Total Sales Month vs Month — ${yr}${branch!=='All'?' · '+branch:''}`, scopeTotal);

  const minT=minTargetSeries(yr, branch);
  const card=sectionCard(host,'Monthly totals by branch');
  const cv=document.createElement('canvas'); cv.style.maxHeight='320px'; card.appendChild(cv);
  const datasets=[];
  if(branch==='All'){
    datasets.push({label:'Manila',data:mnl,backgroundColor:'#7f9dc4',borderRadius:4});
    datasets.push({label:'Malabon',data:mbn,backgroundColor:'#c96b6b',borderRadius:4});
  } else {
    datasets.push({label:branch,data:scope,backgroundColor:branch==='Manila'?'#7f9dc4':'#c96b6b',borderRadius:4});
  }
  // Minimum-target line replaces the old "Combined" line.
  datasets.push({type:'line',label:'Min target',data:minT,borderColor:'#d1a56b',borderWidth:2,tension:.2,pointRadius:2});
  setTimeout(()=>{ if(typeof Chart==='undefined')return; if(cv._c)cv._c.destroy();
    cv._c=new Chart(cv,{type:'bar',data:{labels:MONTH_NAMES,datasets},options:barOpts()});},30);

  const rows=months.map((ym,i)=>{
    const prev=i>0?scope[i-1]:0;
    const g=prev?((scope[i]-prev)/prev*100):0;
    return {name:MONTH_NAMES[i], mnl:mnl[i], mbn:mbn[i], val:scope[i], growth:(i>0&&prev)?(g>=0?'+':'')+g.toFixed(1)+'%':'—'};
  }).filter(r=>r.val>0);
  const tcard=sectionCard(host,'Month-on-month growth'+(branch!=='All'?` — ${branch}`:''));
  if(branch==='All'){
    tableFrom(tcard,['Month','Manila','Malabon','Combined','MoM growth'],
      rows.map(r=>[r.name, money(r.mnl), money(r.mbn), money(r.val), r.growth]));
  } else {
    tableFrom(tcard,['Month',branch,'MoM growth'], rows.map(r=>[r.name, money(r.val), r.growth]));
  }

  const div=document.createElement('div'); div.style.cssText='height:1px;background:var(--line);margin:22px 0;'; host.appendChild(div);
  // Actual performance vs targets as a numbers report (replaces the old bar chart),
  // then the Detail table and main sales drivers.
  monthlyActualVsTargetTable(host, yr, branch, 12);
  reportVsTarget(host, {chart:false, title:false});
}

// ---- Sub-tab 2: Sales by Category ----
function renderCategoryReport(host){
  periodFilterBar(host, RKEYS, {branch:true});
  if(!state.sales.length){ reportEmpty(host); return; }
  const P=resolvePeriod(state.reportPeriod, state.reportMonth, state.reportQuarter);
  const yr=P.yr, branch=state.reportBranch, mArr=P.months, plabel=P.label;
  const sales=salesInPeriod(branch, yr, mArr);
  const by={}; sales.forEach(s=>{ const c=s.category||'OTHERS'; by[c]=(by[c]||0)+s.amount; });
  const total=Object.values(by).reduce((a,b)=>a+b,0);
  titleCard(host, `Sales by Category — ${plabel}${branch!=='All'?' · '+branch:''}`, total);
  const pairs=Object.entries(by).sort((a,b)=>b[1]-a[1]);
  twoCol(host, (c)=>pieCanvas(c, pairs.map(p=>p[0]), pairs.map(p=>p[1])), (c)=>breakdownTable(c, pairs, total||1));

  // --- Per-category branch comparison, month by month (instruction 6) ---
  const cats=pairs.map(p=>p[0]);
  const catOptions = cats.length?cats:['GYM'];
  if(!state.reportCategory || !catOptions.includes(state.reportCategory)) state.reportCategory = catOptions[0];
  const selCat = state.reportCategory;
  const mcard=sectionCard(host, `${selCat} performance by month${branch!=='All'?' · '+branch:' · branch comparison'}`);
  const cs=document.createElement('select'); cs.style.marginBottom='12px';
  cs.innerHTML=catOptions.map(c=>`<option value="${escapeHtml(c)}" ${c===selCat?'selected':''}>${escapeHtml(c)}</option>`).join('');
  cs.onchange=()=>{ state.reportCategory=cs.value; render(); };
  mcard.appendChild(cs);
  const cv=document.createElement('canvas'); cv.style.maxHeight='320px'; mcard.appendChild(cv);
  const MI=[1,2,3,4,5,6,7,8,9,10,11,12];
  const catMnl=MI.map(m=>salesInPeriod('Manila',yr,[m]).filter(x=>(x.category||'OTHERS')===selCat).reduce((a,b)=>a+b.amount,0));
  const catMbn=MI.map(m=>salesInPeriod('Malabon',yr,[m]).filter(x=>(x.category||'OTHERS')===selCat).reduce((a,b)=>a+b.amount,0));
  const dsets=[];
  if(branch!=='Malabon') dsets.push({label:'Manila',data:catMnl,backgroundColor:'#7f9dc4',borderRadius:4});
  if(branch!=='Manila') dsets.push({label:'Malabon',data:catMbn,backgroundColor:'#c96b6b',borderRadius:4});
  setTimeout(()=>{ if(typeof Chart==='undefined')return; if(cv._c)cv._c.destroy();
    cv._c=new Chart(cv,{type:'bar',data:{labels:MONTH_NAMES,datasets:dsets},options:barOpts()});},30);
  // numbers at the bottom of the report
  const nrows=[];
  MI.forEach((m,i)=>{
    const a=catMnl[i], b=catMbn[i], t=a+b;
    if((branch==='Manila'&&a===0)||(branch==='Malabon'&&b===0)||(branch==='All'&&t===0)) return;
    if(branch==='All') nrows.push([MONTH_NAMES[i], money(a), money(b), money(t)]);
    else nrows.push([MONTH_NAMES[i], money(branch==='Manila'?a:b)]);
  });
  const totMnl=catMnl.reduce((x,y)=>x+y,0), totMbn=catMbn.reduce((x,y)=>x+y,0);
  if(branch==='All'){
    nrows.push(['TOTAL', money(totMnl), money(totMbn), money(totMnl+totMbn)]);
    tableFrom(mcard, [`${selCat} — Month`,'Manila','Malabon','Total'], nrows);
  } else {
    nrows.push(['TOTAL', money(branch==='Manila'?totMnl:totMbn)]);
    tableFrom(mcard, [`${selCat} — Month`, branch], nrows);
  }
}

// ---- Sub-tab 3: Sales by Item (service breakdown + qty + detailed total) ----
function renderItemReport(host){
  periodFilterBar(host, RKEYS, {branch:true});
  if(!state.sales.length){ reportEmpty(host); return; }
  const P=resolvePeriod(state.reportPeriod, state.reportMonth, state.reportQuarter);
  const yr=P.yr, branch=state.reportBranch, mArr=P.months, plabel=P.label;
  const sales=salesInPeriod(branch, yr, mArr);
  const by={}, qty={}; SERVICES_ORDER.forEach(s=>{by[s]=0;qty[s]=0;});
  sales.forEach(s=>{ const c=SERVICES_ORDER.includes(s.category)?s.category:'OTHERS'; by[c]=(by[c]||0)+s.amount; qty[c]=(qty[c]||0)+(s.qty||0); });
  const total=Object.values(by).reduce((a,b)=>a+b,0);
  titleCard(host, `Sales by Item — ${plabel}${branch!=='All'?' · '+branch:''}`, total);
  const pairs=SERVICES_ORDER.map(s=>[s,by[s]]).filter(p=>p[1]>0);

  const wrap=document.createElement('div'); wrap.className='card';
  wrap.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start;';
  const L=document.createElement('div'), R=document.createElement('div'); wrap.appendChild(L); wrap.appendChild(R); host.appendChild(wrap);
  pieCanvas(L, pairs.map(p=>p[0]), pairs.map(p=>p[1]));
  const st=document.createElement('table'); st.className='simple'; st.style.width='100%';
  st.innerHTML='<thead><tr><th>Service</th><th style="text-align:right">Qty</th><th style="text-align:right">Sales</th><th style="text-align:right">Share</th></tr></thead>';
  const stb=document.createElement('tbody');
  pairs.forEach(([k,v])=>{ const tr=document.createElement('tr');
    tr.innerHTML=`<td>${escapeHtml(k)}</td><td style="text-align:right">${(qty[k]||0).toLocaleString()}</td><td style="text-align:right;font-family:var(--font-m)">${money(v)}</td><td style="text-align:right">${(v/(total||1)*100).toFixed(1)}%</td>`;
    stb.appendChild(tr); });
  const totQty=Object.values(qty).reduce((a,b)=>a+b,0);
  const stot=document.createElement('tr'); stot.style.cssText='font-weight:700;border-top:2px solid var(--line)';
  stot.innerHTML=`<td>Total</td><td style="text-align:right">${totQty.toLocaleString()}</td><td style="text-align:right;font-family:var(--font-m)">${money(total)}</td><td style="text-align:right">100%</td>`;
  stb.appendChild(stot); st.appendChild(stb); R.appendChild(st);
  if(window.innerWidth<720) wrap.style.gridTemplateColumns='1fr';

  if(branch==='All'){
    const card=sectionCard(host,'Service by branch — '+plabel);
    const cv=document.createElement('canvas'); cv.style.maxHeight='300px'; card.appendChild(cv);
    const mnl=SERVICES_ORDER.map(s=>salesInPeriod('Manila',yr,mArr).filter(x=>x.category===s).reduce((a,b)=>a+b.amount,0));
    const mbn=SERVICES_ORDER.map(s=>salesInPeriod('Malabon',yr,mArr).filter(x=>x.category===s).reduce((a,b)=>a+b.amount,0));
    setTimeout(()=>{ if(typeof Chart==='undefined')return; if(cv._c)cv._c.destroy();
      cv._c=new Chart(cv,{type:'bar',data:{labels:SERVICES_ORDER,datasets:[
        {label:'Manila',data:mnl,backgroundColor:'#7f9dc4',borderRadius:4},
        {label:'Malabon',data:mbn,backgroundColor:'#c96b6b',borderRadius:4}]},options:barOpts()});},30);
  }

  const detCard=sectionCard(host,'Sales per category (detailed)');
  const byDet={}, qtyDet={};
  sales.forEach(s=>{ const d=(s.description||s.item||s.category||'—'); byDet[d]=(byDet[d]||0)+s.amount; qtyDet[d]=(qtyDet[d]||0)+(s.qty||0); });
  const detPairs=Object.entries(byDet).sort((a,b)=>b[1]-a[1]);
  const dt=document.createElement('table'); dt.className='simple'; dt.style.width='100%';
  dt.innerHTML='<thead><tr><th>Category</th><th style="text-align:right">Qty</th><th style="text-align:right">Sales</th><th style="text-align:right">Share</th></tr></thead>';
  const dtb=document.createElement('tbody');
  let detTotal=0, detQty=0;
  detPairs.forEach(([k,v])=>{ detTotal+=v; detQty+=(qtyDet[k]||0);
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${escapeHtml(k)}</td><td style="text-align:right">${(qtyDet[k]||0).toLocaleString()}</td><td style="text-align:right;font-family:var(--font-m)">${money(v)}</td><td style="text-align:right">${(v/(total||1)*100).toFixed(1)}%</td>`;
    dtb.appendChild(tr); });
  const dtot=document.createElement('tr'); dtot.style.cssText='font-weight:700;border-top:2px solid var(--line)';
  dtot.innerHTML=`<td>TOTAL</td><td style="text-align:right">${detQty.toLocaleString()}</td><td style="text-align:right;font-family:var(--font-m)">${money(detTotal)}</td><td style="text-align:right">100%</td>`;
  dtb.appendChild(dtot); dt.appendChild(dtb); detCard.appendChild(dt);
  const tie=document.createElement('div'); tie.className='notice';
  tie.innerHTML = Math.round(detTotal)===Math.round(total)
    ? `✓ Detailed total ${fmtMoney(detTotal)} matches the Sales-by-Item total above.`
    : `⚠ Detailed total ${fmtMoney(detTotal)} vs by-item total ${fmtMoney(total)} — difference ${fmtMoney(Math.abs(detTotal-total))}.`;
  detCard.appendChild(tie);
}

// ---- Sub-tab 4: Sales by Admin (from the Admin Sales Tracker xlsx) ----
function renderAdminReport(host){
  periodFilterBar(host, RKEYS, {branch:true});
  const P=resolvePeriod(state.reportPeriod, state.reportMonth, state.reportQuarter);
  const yr=P.yr; const perf=ADMIN_PERF_2026; const branch=state.reportBranch||'All';
  const adminIn=(name)=> branch==='All' || (perf.admins[name] && perf.admins[name].branch===branch);
  const effMonths=effectiveAdminMonths();
  const mnames=effMonths.map(m=>MONTH_NAMES[m-1]);
  const mArr=P.months.filter(m=>effMonths.includes(m));
  const plabel=P.label;
  if(yr!==perf.year || !mArr.length){
    const note=document.createElement('div'); note.className='notice';
    note.textContent='No admin performance data for this period. Jan\u2013Jul come from the tracker; Aug onward come from uploaded per-admin POS reports.';
    host.appendChild(note); return;
  }
  const allNames=Object.keys(perf.admins);
  const rows=allNames.filter(name=>adminIn(name)).map(name=>{
    const sales=mArr.reduce((a,m)=>a+adminSalesForMonth(name,m),0);
    const target=mArr.reduce((a,m)=>a+adminTargetFor(name,m),0);
    return {name, sales, target};
  }).filter(r=>r.sales>0 || r.target>0).sort((a,b)=>b.sales-a.sales);
  const teamSales=rows.reduce((a,b)=>a+b.sales,0), teamTarget=rows.reduce((a,b)=>a+b.target,0);
  if(!rows.length){ const n=document.createElement('div'); n.className='notice'; n.textContent='No admin data for this branch and period.'; host.appendChild(n); return; }
  titleCard(host, `Sales by Admin \u2014 ${plabel}${branch!=='All'?' \u00b7 '+branch:''}`, teamSales,
    teamTarget?`team at ${(teamSales/teamTarget*100).toFixed(1)}% of quota (${fmtMoney(teamTarget)})`:'');

  twoCol(host,
    (c)=>barhCanvas(c, rows.map(r=>r.name), rows.map(r=>r.sales)),
    (c)=>pieCanvas(c, rows.map(r=>r.name), rows.map(r=>r.sales)));

  // Per-admin vs quota. When a single month is selected, the Quota cell is editable.
  const tcard=sectionCard(host,'Per-admin vs quota \u2014 '+plabel);
  const editable = (P.kind==='month') && canEditSales();
  const t=document.createElement('table'); t.className='simple'; t.style.width='100%';
  t.innerHTML='<thead><tr><th>Admin</th><th style="text-align:right">Sales</th><th style="text-align:right">Quota</th><th style="text-align:right">Attainment</th><th style="text-align:right">Over/Under</th><th style="text-align:right">Share</th></tr></thead>';
  const tb=document.createElement('tbody');
  rows.forEach(r=>{
    const diff=r.sales-r.target;
    const col = (r.target? (r.sales>=r.target?'var(--lime)':'var(--red-ink)') : 'var(--lime)');
    let quotaCell;
    if(editable){
      const m=mArr[0];
      quotaCell='<input type="number" min="0" step="5000" value="'+(adminTargetFor(r.name,m)||'')+'" data-admin="'+escapeHtml(r.name)+'" data-month="'+m+'" class="quota-inp" style="width:104px;text-align:right;background:transparent;border:1px solid var(--line);border-radius:4px;color:#ffffff;padding:3px 6px;font-family:var(--font-m);">';
    } else {
      quotaCell = r.target?money(r.target):'\u2014';
    }
    const tr=document.createElement('tr');
    tr.innerHTML='<td>'+escapeHtml(r.name)+'</td>'
      +'<td style="text-align:right;font-family:var(--font-m);color:'+col+'">'+money(r.sales)+'</td>'
      +'<td style="text-align:right">'+quotaCell+'</td>'
      +'<td style="text-align:right;color:'+col+'">'+(r.target?(r.sales/r.target*100).toFixed(0)+'%':'\u2014')+'</td>'
      +'<td style="text-align:right;color:'+col+'">'+(diff>=0?'+':'')+money(Math.abs(diff))+'</td>'
      +'<td style="text-align:right">'+(teamSales?(r.sales/teamSales*100).toFixed(1)+'%':'\u2014')+'</td>';
    tb.appendChild(tr);
  });
  t.appendChild(tb); tcard.appendChild(t);
  if(editable){
    const hint=document.createElement('div'); hint.className='hint'; hint.style.marginTop='6px';
    hint.textContent='Quota is editable \u2014 type a value to set this admin\u2019s quota for '+plabel+' (saved in this browser). Use Quarterly/YTD to view totals.';
    tcard.appendChild(hint);
    tcard.querySelectorAll('.quota-inp').forEach(inp=>{
      inp.onchange=()=>{ saveAdminQuotaOverride(inp.dataset.admin, Number(inp.dataset.month), inp.value===''?null:inp.value); render(); };
    });
  }

  if(teamTarget){
    const scard=sectionCard(host,'Team total vs quota');
    const cv=document.createElement('canvas'); cv.style.maxHeight='150px'; scard.appendChild(cv);
    setTimeout(()=>{ if(typeof Chart==='undefined')return; if(cv._c)cv._c.destroy();
      cv._c=new Chart(cv,{type:'bar',data:{labels:['Team'],datasets:[
        {label:'Actual',data:[teamSales],backgroundColor:teamSales>=teamTarget?'#7fae82':'#c96b6b',borderRadius:4},
        {label:'Quota',data:[teamTarget],backgroundColor:'rgba(255,255,255,.15)',borderRadius:4}]},
      options:{...barOpts(), indexAxis:'y'}});},30);
  }

  // --- Monthly sales performance per admin (+ per-admin sales vs target) ---
  const mcard=sectionCard(host,'Monthly sales per admin');
  const adminNames=allNames.filter(n=>adminIn(n) && effMonths.some(m=>adminSalesForMonth(n,m)>0));
  if(!state.adminLinePick || (state.adminLinePick!=='All' && !adminNames.includes(state.adminLinePick))) state.adminLinePick='All';
  const pick=state.adminLinePick;
  const sel=document.createElement('select'); sel.style.marginBottom='12px';
  sel.innerHTML=['All',...adminNames].map(n=>`<option value="${escapeHtml(n)}" ${n===pick?'selected':''}>${n==='All'?'All admins':escapeHtml(n)+' \u2014 sales vs target'}</option>`).join('');
  sel.onchange=()=>{ state.adminLinePick=sel.value; render(); };
  mcard.appendChild(sel);
  const cv=document.createElement('canvas'); cv.style.maxHeight='320px'; mcard.appendChild(cv);
  if(pick==='All'){
    const palette=chartPalette(adminNames.length);
    const lineDs=adminNames.map((n,i)=>({label:n, data:effMonths.map(m=>adminSalesForMonth(n,m)),
      borderColor:palette[i], backgroundColor:palette[i], borderWidth:2, tension:.25, pointRadius:2, fill:false}));
    setTimeout(()=>{ if(typeof Chart==='undefined')return; if(cv._c)cv._c.destroy();
      cv._c=new Chart(cv,{type:'line',data:{labels:mnames,datasets:lineDs},options:barOpts()});},30);
  } else {
    const sData=effMonths.map(m=>adminSalesForMonth(pick,m));
    const tData=effMonths.map(m=>adminTargetFor(pick,m));
    setTimeout(()=>{ if(typeof Chart==='undefined')return; if(cv._c)cv._c.destroy();
      cv._c=new Chart(cv,{type:'line',data:{labels:mnames,datasets:[
        {label:pick+' sales', data:sData, borderColor:'#7fae82', backgroundColor:'#7fae82', borderWidth:2, tension:.25, pointRadius:3, fill:false},
        {label:'Target', data:tData, borderColor:'#d1a56b', borderWidth:2, borderDash:[5,4], pointRadius:0, tension:.2, fill:false}
      ]},options:barOpts()});},30);
    const sTot=sData.reduce((a,b)=>a+b,0), tTot=tData.reduce((a,b)=>a+b,0);
    const info=document.createElement('div'); info.className='notice';
    info.innerHTML=`<strong>${escapeHtml(pick)}</strong> (${perf.admins[pick].branch}) \u2014 sales ${fmtMoney(sTot)} vs quota ${fmtMoney(tTot)}${tTot?` \u00b7 ${(sTot/tTot*100).toFixed(0)}% attainment`:' \u00b7 no quota set'}.`;
    mcard.appendChild(info);
  }
  const mrows=adminNames.map(n=>{
    const vals=effMonths.map(m=>adminSalesForMonth(n,m));
    const tot=vals.reduce((a,b)=>a+b,0);
    return [n, ...vals.map(v=>money(v)), money(tot)];
  }).sort((a,b)=>parseFloat(b[b.length-1].replace(/,/g,''))-parseFloat(a[a.length-1].replace(/,/g,'')));
  const colTot=effMonths.map(m=>adminNames.reduce((a,n)=>a+adminSalesForMonth(n,m),0));
  mrows.push(['Team', ...colTot.map(v=>money(v)), money(colTot.reduce((a,b)=>a+b,0))]);
  tableFrom(mcard, ['Admin', ...mnames, 'Total'], mrows);

  // --- Editable quota grid (all admins x months) — editors only ---
  if(canEditSales()){
  const qcard=sectionCard(host,'Set monthly quota per admin');
  const qhint=document.createElement('div'); qhint.className='hint'; qhint.style.marginBottom='10px';
  qhint.textContent='Type a quota for any admin and month. Saved in this browser and applied to attainment above. Blank = tracker default.';
  qcard.appendChild(qhint);
  const qtbl=document.createElement('table'); qtbl.className='simple'; qtbl.style.width='100%';
  qtbl.innerHTML='<thead><tr><th>Admin</th>'+effMonths.map(m=>`<th style="text-align:right">${MONTH_NAMES[m-1]}</th>`).join('')+'</tr></thead>';
  const qtb=document.createElement('tbody');
  allNames.filter(n=>adminIn(n)).forEach(name=>{
    const tr=document.createElement('tr');
    const nameTd=document.createElement('td'); nameTd.textContent=name; tr.appendChild(nameTd);
    effMonths.forEach(m=>{
      const td=document.createElement('td'); td.style.textAlign='right';
      const inp=document.createElement('input'); inp.type='number'; inp.min='0'; inp.step='5000';
      inp.value=adminTargetFor(name,m)||'';
      inp.style.cssText='width:88px;text-align:right;background:transparent;border:1px solid var(--line);border-radius:4px;color:#ffffff;padding:3px 5px;';
      inp.onchange=()=>{ saveAdminQuotaOverride(name, m, inp.value===''?null:inp.value); render(); };
      td.appendChild(inp); tr.appendChild(td);
    });
    qtb.appendChild(tr);
  });
  qtbl.appendChild(qtb); qcard.appendChild(qtbl);
  const rstBtn=document.createElement('button'); rstBtn.className='btn'; rstBtn.textContent='Reset to tracker defaults'; rstBtn.style.marginTop='10px';
  rstBtn.onclick=()=>{ if(typeof confirm==='undefined' || confirm('Clear all manual quota edits saved in this browser?')){ try{ if(typeof localStorage!=='undefined') localStorage.removeItem(ADMIN_QUOTA_LS_KEY); }catch(e){} state.adminQuotaOverrides=null; render(); } };
  qcard.appendChild(rstBtn);
  } // end editors-only quota grid

  const note=document.createElement('div'); note.className='notice';
  note.textContent='Sales by Admin: Jan\u2013Jun from the tracker xlsx, July from the July POS files, and August onward from uploaded per-admin POS reports (matched by staff name). Branch reflects each admin\u2019s home branch.';
  host.appendChild(note);
}

// =================== end Sales Dashboard sub-tab reports ===================

// ---- Export all dashboards (data + charts) to a single .xlsx (instruction: backup) ----
function loadScriptOnce(src){
  return new Promise((res,rej)=>{
    if([...document.scripts].some(s=>s.src===src)) return res();
    const el=document.createElement('script'); el.src=src;
    el.onload=()=>res(); el.onerror=()=>rej(new Error('Could not load '+src));
    document.head.appendChild(el);
  });
}
async function exportDashboardsToExcel(btn){
  const orig = btn ? btn.textContent : '';
  if(btn){ btn.disabled=true; btn.textContent='Preparing…'; }
  try{
    await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js');
    const ExcelJS = window.ExcelJS;
    if(!ExcelJS) throw new Error('ExcelJS unavailable');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Roshan Gym Ops'; wb.created = new Date();

    // Snapshot filters, then render each dashboard at a full backup scope (All / YTD).
    const snap = { rb:state.reportBranch, rp:state.reportPeriod, sb:state.salesBranch, sp:state.salesPeriod, alp:state.adminLinePick };
    state.reportBranch='All'; state.reportPeriod='ytd';
    state.salesBranch='All'; state.salesPeriod='ytd'; state.adminLinePick='All';

    const reports = [
      ['Overview', renderSalesOverview],
      ['Performance per Branch', renderBranchPerf],
      ['Sales by Category', renderCategoryReport],
      ['Sales by Item', renderItemReport],
      ['Sales by Admin', renderAdminReport],
    ];
    const holder=document.createElement('div');
    holder.style.cssText='position:fixed;left:-99999px;top:0;width:920px;';
    document.body.appendChild(holder);

    for(const [name, fn] of reports){
      const box=document.createElement('div'); box.style.width='900px'; holder.appendChild(box);
      try{ fn(box); }catch(e){ /* keep going */ }
      await new Promise(r=>setTimeout(r, 550)); // let Chart.js finish drawing
      const ws=wb.addWorksheet(name.slice(0,31));
      ws.columns=[{width:34},{width:16},{width:16},{width:16},{width:16},{width:16},{width:16},{width:16}];
      let row=1;
      const title=ws.getCell('A'+row); title.value=name; title.font={bold:true,size:14}; row+=2;
      // section headers + tables
      box.querySelectorAll('.card').forEach(card=>{
        const h=card.querySelector('h2'); 
        if(h){ const c=ws.getCell('A'+row); c.value=h.textContent.trim(); c.font={bold:true,size:11}; row++; }
        card.querySelectorAll('table').forEach(tbl=>{
          tbl.querySelectorAll('tr').forEach(tr=>{
            const cells=[...tr.querySelectorAll('th,td')].map(td=>{
              const t=td.textContent.trim();
              const num=t.replace(/,/g,'').replace(/%$/,'');
              return (t!=='' && /^-?\d+(\.\d+)?$/.test(num)) ? Number(num) : t;
            });
            const r=ws.addRow(cells);
            if(tr.querySelector('th')) r.font={bold:true};
            row++;
          });
          ws.addRow([]); row++;
        });
      });
      // charts as images
      const canvases=[...box.querySelectorAll('canvas')];
      for(const cv of canvases){
        let dataUrl=null; try{ dataUrl=cv.toDataURL('image/png'); }catch(e){}
        if(!dataUrl || dataUrl.length<200) continue;
        const imgId=wb.addImage({ base64:dataUrl, extension:'png' });
        const w=Math.min(cv.width||700,700), h=Math.min(cv.height||300,320);
        ws.addImage(imgId, { tl:{col:0.2, row:row}, ext:{width:w, height:h} });
        row += Math.ceil(h/18)+2;
      }
      holder.removeChild(box);
    }
    document.body.removeChild(holder);
    Object.assign(state, {reportBranch:snap.rb, reportPeriod:snap.rp, salesBranch:snap.sb, salesPeriod:snap.sp, adminLinePick:snap.alp});

    const buf=await wb.xlsx.writeBuffer();
    const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download=`Roshan_Sales_Dashboard_${new Date().toISOString().slice(0,10)}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
    if(btn) btn.textContent='✓ Exported';
  }catch(err){
    console.error('Excel export failed:', err);
    alert('Export failed: '+err.message+'\nIf this persists, the CDN for the Excel library may be blocked by your network.');
    if(btn) btn.textContent=orig||'⬇ Export to Excel';
  }finally{
    if(btn){ btn.disabled=false; setTimeout(()=>{ if(btn.textContent==='✓ Exported') btn.textContent=orig||'⬇ Export to Excel'; }, 2500); render(); }
  }
}

function monthLabel(ym){ const [y,m]=ym.split('-'); return `${MONTH_NAMES[Number(m)-1]} ${y}`; }
function titleCard(host,title,total,subtitle){
  const c=document.createElement('div'); c.className='card';
  c.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;">
    <h2 style="font-size:15px;color:var(--ink-0);">${escapeHtml(title)}</h2>
    <div style="text-align:right;"><div style="font-size:20px;font-weight:700;color:var(--lime);">${fmtMoney(total)}</div>${subtitle?`<div class="hint">${escapeHtml(subtitle)}</div>`:''}</div>
  </div>`;
  host.appendChild(c);
}
function sectionCard(host,title){
  const c=document.createElement('div'); c.className='card';
  if(title) c.innerHTML=`<h2 style="font-size:13px;color:#ffffff;margin-bottom:12px;">${escapeHtml(title)}</h2>`;
  host.appendChild(c); return c;
}
function twoCol(host,leftFn,rightFn){
  const wrap=document.createElement('div'); wrap.className='card';
  wrap.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start;';
  const l=document.createElement('div'), r=document.createElement('div');
  wrap.appendChild(l); wrap.appendChild(r); host.appendChild(wrap);
  leftFn(l); rightFn(r);
  // responsive: stack on narrow
  if(window.innerWidth<720) wrap.style.gridTemplateColumns='1fr';
}
function pieCanvas(host,labels,data){
  const cv=document.createElement('canvas'); cv.style.maxHeight='280px'; host.appendChild(cv);
  const total=data.reduce((a,b)=>a+b,0)||1;
  setTimeout(()=>{ if(typeof Chart==='undefined')return; if(cv._c)cv._c.destroy();
    cv._c=new Chart(cv,{type:'doughnut',plugins:[pieLabelPlugin],data:{labels,datasets:[{data,backgroundColor:chartPalette(labels.length),borderColor:'#0d0d0f',borderWidth:2}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:'#ffffff',font:{size:11},padding:8,
        generateLabels:(ch)=>ch.data.labels.map((lab,i)=>({text:`${lab} ${(data[i]/total*100).toFixed(1)}%`,fillStyle:ch.data.datasets[0].backgroundColor[i],fontColor:'#ffffff',index:i}))}},
        tooltip:{callbacks:{label:(c)=>` ${fmtMoney(c.parsed)} (${(c.parsed/total*100).toFixed(1)}%)`}}}}});},30);
}
function barhCanvas(host,labels,data){
  const cv=document.createElement('canvas'); cv.style.maxHeight='280px'; host.appendChild(cv);
  setTimeout(()=>{ if(typeof Chart==='undefined')return; if(cv._c)cv._c.destroy();
    cv._c=new Chart(cv,{type:'bar',data:{labels,datasets:[{data,backgroundColor:chartPalette(labels.length),borderRadius:4}]},
      options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:(c)=>' '+fmtMoney(c.parsed.x)}}},
        scales:{x:{ticks:{color:'#c9d1d9',font:{size:10},callback:v=>moneyK(v)},grid:{color:'rgba(255,255,255,.05)'}},y:{type:'category',ticks:{color:'#ffffff',font:{size:12}},grid:{display:false}}}}});},30);
}
function breakdownTable(host,pairs,total){
  const t=document.createElement('table'); t.className='simple'; t.style.width='100%';
  t.innerHTML='<thead><tr><th>Category</th><th style="text-align:right">Sales</th><th style="text-align:right">Share</th></tr></thead>';
  const tb=document.createElement('tbody');
  pairs.forEach(([k,v])=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${escapeHtml(k)}</td><td style="text-align:right;font-family:var(--font-m)">${fmtMoney(v).replace('PHP ','')}</td><td style="text-align:right">${(v/total*100).toFixed(1)}%</td>`;
    tb.appendChild(tr);
  });
  const tot=document.createElement('tr'); tot.style.fontWeight='700'; tot.style.borderTop='2px solid var(--line)';
  tot.innerHTML=`<td>Total</td><td style="text-align:right;font-family:var(--font-m)">${fmtMoney(total).replace('PHP ','')}</td><td style="text-align:right">100%</td>`;
  tb.appendChild(tot);
  t.appendChild(tb); host.appendChild(t);
}
function tableFrom(host,headers,rows,goodFlags){
  const t=document.createElement('table'); t.className='simple'; t.style.width='100%';
  t.innerHTML='<thead><tr>'+headers.map((h,i)=>`<th${i>0?' style="text-align:right"':''}>${escapeHtml(h)}</th>`).join('')+'</tr></thead>';
  const tb=document.createElement('tbody');
  rows.forEach((r,ri)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=r.map((c,i)=>`<td${i>0?' style="text-align:right'+(i>0&&goodFlags?';color:'+(goodFlags[ri]?'var(--lime)':'var(--red-ink)'):'')+'"':''}>${escapeHtml(String(c))}</td>`).join('');
    tb.appendChild(tr);
  });
  t.appendChild(tb); host.appendChild(t);
}
function barOpts(){
  return {responsive:true,maintainAspectRatio:false,
    plugins:{legend:{labels:{color:'#ffffff',font:{size:11}}},tooltip:{callbacks:{label:(c)=>` ${c.dataset.label}: ${fmtMoney(c.parsed.y)}`}}},
    scales:{x:{ticks:{color:'#c9d1d9',font:{size:10}},grid:{color:'rgba(255,255,255,.05)'}},
      y:{ticks:{color:'#c9d1d9',font:{size:10},callback:v=>moneyK(v)},grid:{color:'rgba(255,255,255,.05)'}}}};
}

// ---------- MANAGE IMPORTS (batch cleanup) ----------
async function renderSalesBatches(el){
  const intro = document.createElement('div'); intro.className='notice';
  intro.textContent = 'Every POS upload is a batch. Remove a batch to delete all its sales at once — useful for clearing sample or test data.';
  el.appendChild(intro);

  const host = document.createElement('div');
  host.innerHTML = '<div class="hint">Loading imports…</div>';
  el.appendChild(host);

  try{
    const {batches} = await apiGet('/api/sales/batches');
    host.innerHTML = '';
    if(!batches.length){ host.innerHTML = '<div class="empty">No POS imports yet.</div>'; return; }
    const table = document.createElement('table'); table.className='simple';
    table.innerHTML = '<thead><tr><th>Date</th><th>Staff</th><th>Branch</th><th>Lines</th><th style="text-align:right">Total</th><th></th></tr></thead>';
    const tbody = document.createElement('tbody');
    batches.forEach(b=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${fmtDate(b.date)}</td><td>${escapeHtml(b.staff||'—')}</td><td>${escapeHtml(b.branch||'—')}</td><td>${b.count}</td><td style="text-align:right;font-family:var(--font-m)">${fmtMoney(b.total)}</td>`;
      const td = document.createElement('td');
      const del = document.createElement('button'); del.className='btn sm ghost'; del.textContent='Remove';
      del.onclick = async ()=>{
        if(!confirm(`Remove this import?\n\n${b.staff} · ${b.date} · ${b.count} lines · ${fmtMoney(b.total)}\n\nThis deletes those sales permanently.`)) return;
        try{
          await apiDelete('/api/sales/import?batch=' + encodeURIComponent(b.batch));
          const fresh = await apiGet('/api/sales');
          state.sales = (fresh.sales||[]).map(mapSale);
          render();
        }catch(e){ alert(e.message); }
      };
      td.appendChild(del); tr.appendChild(td);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    const card = document.createElement('div'); card.className='card'; card.appendChild(table);
    host.appendChild(card);
  }catch(e){ host.innerHTML = `<div class="notice err">${escapeHtml(e.message)}</div>`; }
}

function renderNewSaleModal(modal){
  const head=document.createElement('div'); head.className='modal-head'; head.innerHTML='<h2 style="font-size:16px;">Log sale</h2>'; head.appendChild(closeBtn()); modal.appendChild(head);
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="form-grid">
      <div class="field"><label>Date</label><input id="s-date" type="date" value="${todayStr()}"></div>
      <div class="field"><label>Category</label><select id="s-cat">${SALE_CATEGORIES.map(c=>`<option value="${c}">${c}</option>`).join('')}</select></div>
      <div class="field"><label>Amount (PHP)</label><input id="s-amount" type="number" min="0" step="0.01" placeholder="0.00"></div>
      <div class="field"><label>Payment method</label><select id="s-method">${SALE_METHODS.map(m=>`<option value="${m}">${m}</option>`).join('')}</select></div>
      <div class="field full"><label>Description (optional)</label><input id="s-desc" placeholder="e.g. 3-month membership, walk-in"></div>
    </div>
    <div id="s-error"></div>
  `;
  modal.appendChild(wrap);
  const row=document.createElement('div'); row.className='action-row';
  const b=document.createElement('button'); b.className='btn primary'; b.textContent='Add entry';
  b.onclick=async ()=>{
    const date=document.getElementById('s-date').value || todayStr();
    const category=document.getElementById('s-cat').value;
    const amount=parseFloat(document.getElementById('s-amount').value);
    const method=document.getElementById('s-method').value;
    const description=document.getElementById('s-desc').value.trim();
    const errEl=document.getElementById('s-error'); errEl.innerHTML='';
    if(!amount || amount<=0){ errEl.innerHTML='<div class="notice err">Enter a valid amount.</div>'; return; }
    b.disabled=true; b.textContent='Saving…';
    try{
      const {sale} = await apiPost('/api/sales', {date, category, amount, method, description});
      state.sales.unshift(mapSale(sale));
      state.modal=null; render();
    }catch(e){ errEl.innerHTML = `<div class="notice err">${escapeHtml(e.message)}</div>`; b.disabled=false; b.textContent='Add entry'; }
  };
  row.appendChild(b); modal.appendChild(row);
}

// ============ MEMBERSHIP TRACKER ============
const PLAN_MONTHS = {'Monthly':1, 'Quarterly':3, 'Annual':12, 'Class pack':0};

function memberStatus(m){
  const days = daysBetween(todayStr(), m.expiryDate);
  if(days < 0) return 'Expired';
  if(days <= 7) return 'Expiring soon';
  return 'Active';
}

function renderMembership(el){
  const withStatus = state.members.map(m=>({...m, computed: memberStatus(m)}));
  const active = withStatus.filter(m=>m.computed==='Active').length;
  const expiringSoon = withStatus.filter(m=>m.computed==='Expiring soon').length;
  const expired = withStatus.filter(m=>m.computed==='Expired').length;
  const monthRevenue = state.members.reduce((sum,m)=>{
    const hist = (m.history||[]).filter(h=>h.date.slice(0,7)===monthStr(new Date()));
    return sum + hist.reduce((s,h)=>s+Number(h.amount||0),0);
  },0);

  const missingForm = state.members.filter(m=>!m.formPath).length;
  const metrics = document.createElement('div'); metrics.className='metrics';
  metrics.innerHTML = `
    <div class="metric good"><div class="num">${active}</div><div class="lbl">Active members</div></div>
    <div class="metric ${expiringSoon>0?'flag':''}"><div class="num">${expiringSoon}</div><div class="lbl">Expiring within 7 days</div></div>
    <div class="metric"><div class="num">${expired}</div><div class="lbl">Expired</div></div>
    <div class="metric ${missingForm>0?'flag':''}"><div class="num">${missingForm}</div><div class="lbl">Missing membership form</div></div>
    <div class="metric"><div class="num">${fmtMoney(monthRevenue).replace('PHP ','')}</div><div class="lbl">Revenue this month (PHP)</div></div>
  `;
  el.appendChild(metrics);

  const head = document.createElement('div'); head.className='section-head';
  head.innerHTML = '<h2>Members</h2>';
  const toolbar = document.createElement('div'); toolbar.className='toolbar';
  toolbar.innerHTML = `<select id="member-filter">
    <option value="All" ${state.memberFilter==='All'?'selected':''}>All</option>
    <option value="Active" ${state.memberFilter==='Active'?'selected':''}>Active</option>
    <option value="Expiring soon" ${state.memberFilter==='Expiring soon'?'selected':''}>Expiring soon</option>
    <option value="Expired" ${state.memberFilter==='Expired'?'selected':''}>Expired</option>
  </select>`;
  head.appendChild(toolbar);
  const exportBtn=document.createElement('button'); exportBtn.className='btn'; exportBtn.textContent='Export to Excel';
  exportBtn.onclick=()=>{
    if(typeof XLSX==='undefined'){ alert('The Excel library did not load. Refresh the page.'); return; }
    if(!withStatus.length){ alert('No members to export yet.'); return; }
    const data = withStatus.map(m=>({
      'Member #': m.id,
      'Name': m.name,
      'Branch': m.branch||'',
      'Contact': m.contact||'',
      'Status (New/Renew)': m.status||'',
      'Plan': m.plan,
      'Start date': m.startDate,
      'Expiry date': m.expiryDate,
      'Membership status': m.computed,
      'Amount (PHP)': m.amount,
      'T-shirt size': m.tshirtSize||'',
      'Source': m.source||'',
      'Remarks': m.remarks||'',
      'Form on file': m.formPath?'Yes':'NO',
      'Form uploaded by': m.formUploadedBy||'',
      'Added by': m.createdBy||'',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = Object.keys(data[0]).map(k=>({wch: Math.max(k.length+2, 14)}));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Members');
    XLSX.writeFile(wb, 'roshan-members-' + todayStr() + '.xlsx');
  };
  toolbar.appendChild(exportBtn);
  if(curRole()==='Admin' || accessTier(curRole())==='SuperAdmin'){
    const b=document.createElement('button'); b.className='btn primary'; b.textContent='+ New member';
    b.onclick=()=>{ state.modal={type:'newMember'}; render(); };
    toolbar.appendChild(b);
  }
  el.appendChild(head);
  toolbar.querySelector('#member-filter').onchange=(e)=>{ state.memberFilter=e.target.value; renderContent(); };

  let list = withStatus;
  if(state.memberFilter!=='All') list = list.filter(m=>m.computed===state.memberFilter);
  list.sort((a,b)=> a.expiryDate.localeCompare(b.expiryDate));

  if(list.length===0){
    const e=document.createElement('div'); e.className='empty'; e.textContent='No members match this filter.'; el.appendChild(e); return;
  }

  list.forEach(m=>{
    const card = document.createElement('div'); card.className='card';
    const badgeClass = m.computed==='Active' ? 'ok' : m.computed==='Expiring soon' ? 'warn' : 'flag';
    const subBits = [m.contact||'—', m.branch||null, m.plan, 'expires '+fmtDate(m.expiryDate), m.tshirtSize?('shirt '+m.tshirtSize):null, m.source||null].filter(Boolean).map(escapeHtml);
    card.innerHTML = `
      <div class="req-top">
        <div>
          <div class="req-title">${escapeHtml(m.name)} ${m.formPath?'':'<span class="badge flag">no form on file</span>'}</div>
          <div class="req-sub">${subBits.join(' &middot; ')}</div>
        </div>
        <span class="badge ${badgeClass}">${m.computed}</span>
      </div>
    `;
    const row = document.createElement('div'); row.className='action-row';
    if(m.formPath){
      const vf = document.createElement('button'); vf.className='btn sm'; vf.textContent='📄 View form';
      vf.onclick = ()=>window.open(`/api/members/${m.id}/form`, '_blank');
      row.appendChild(vf);
    }
    if(curRole()==='Admin' || accessTier(curRole())==='SuperAdmin'){
      const b = document.createElement('button'); b.className='btn primary sm'; b.textContent='Renew';
      b.onclick=()=>{ state.modal={type:'renewMember', id:m.id}; render(); };
      row.appendChild(b);
      // Upload (or replace) the scanned form
      const fileInput = document.createElement('input');
      fileInput.type='file'; fileInput.accept='image/png,image/jpeg,application/pdf'; fileInput.style.display='none';
      const upBtn = document.createElement('button'); upBtn.className='btn sm' + (m.formPath?' ghost':''); upBtn.textContent = m.formPath ? 'Replace form' : '⬆ Upload form';
      fileInput.onchange = async ()=>{
        const picked = fileInput.files[0];
        if(!picked) return;
        upBtn.disabled=true; upBtn.textContent='Uploading…';
        const file = await compressImageFile(picked);
        if(file.size > UPLOAD_LIMIT_BYTES){
          alert('That file is ' + (file.size/1024/1024).toFixed(1) + 'MB, over the 4MB upload limit. Re-scan it as a JPG/PNG photo or at a lower resolution.');
          upBtn.disabled=false; upBtn.textContent = m.formPath ? 'Replace form' : '⬆ Upload form';
          return;
        }
        try{
          const {member} = await apiUpload(`/api/members/${m.id}/form`, file, 'Membership form');
          const i = state.members.findIndex(x=>x.id===m.id);
          if(i>=0) state.members[i] = mapMember(member);
          render();
        }catch(e){ alert(e.message); upBtn.disabled=false; upBtn.textContent = m.formPath ? 'Replace form' : '⬆ Upload form'; }
      };
      upBtn.onclick = ()=>fileInput.click();
      row.appendChild(upBtn); row.appendChild(fileInput);
    }
    if(row.children.length) card.appendChild(row);
    el.appendChild(card);
  });
}

// Vercel rejects request bodies over ~4.5MB, so shrink large photos in the
// browser before uploading. Scans/photos compress dramatically with no
// meaningful loss of legibility for reading a form.
const UPLOAD_LIMIT_BYTES = 4 * 1024 * 1024;

async function compressImageFile(file, maxDim = 2000, quality = 0.82){
  if(!file.type.startsWith('image/')) return file; // PDFs pass through
  if(file.size <= 900 * 1024) return file;         // already small enough
  try{
    const bitmap = await createImageBitmap(file);
    let {width, height} = bitmap;
    const scale = Math.min(1, maxDim / Math.max(width, height));
    width = Math.round(width * scale); height = Math.round(height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise(res=>canvas.toBlob(res, 'image/jpeg', quality));
    if(!blob || blob.size >= file.size) return file;
    const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], newName, {type:'image/jpeg'});
  }catch(e){
    return file; // if anything goes wrong, fall back to the original
  }
}

function renderNewMemberModal(modal){
  const head=document.createElement('div'); head.className='modal-head'; head.innerHTML='<h2 style="font-size:16px;">New member</h2>'; head.appendChild(closeBtn()); modal.appendChild(head);
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="notice">Step 1: attach the scanned membership form (PNG, JPG, or PDF) — <strong>required</strong>. The system will read it and fill in what it can; review and correct the details, then save.</div>
    <div class="field full"><label>Membership form (scan or photo) — required</label><input id="m-form-file" type="file" accept="image/png,image/jpeg,application/pdf"></div>
    <div id="m-form-preview" style="display:none;margin:0 0 12px;"></div>
    <div class="action-row" style="margin:2px 0 14px;">
      <button class="btn sm" id="m-scan-btn" type="button">🔍 Re-scan form</button>
      <span class="hint" id="m-scan-status"></span>
    </div>
    <div class="form-grid">
      <div class="field full"><label>Name</label><input id="m-name" placeholder="Full name"></div>
      <div class="field"><label>Contact</label><input id="m-contact" placeholder="Phone or email"></div>
      <div class="field"><label>Branch</label><select id="m-branch"><option>Manila</option><option>Malabon</option></select></div>
      <div class="field"><label>Status</label><select id="m-status"><option>New</option><option>Renew</option></select></div>
      <div class="field"><label>Plan</label><select id="m-plan">${Object.keys(PLAN_MONTHS).map(p=>`<option value="${p}" ${p==='Annual'?'selected':''}>${p}</option>`).join('')}</select></div>
      <div class="field"><label>Start date</label><input id="m-start" type="date" value="${todayStr()}"></div>
      <div class="field"><label>Amount paid (PHP)</label><input id="m-amount" type="number" min="0" step="0.01" value="600" placeholder="0.00"></div>
      <div class="field"><label>T-shirt size</label><select id="m-tshirt"><option value="">—</option><option>Small</option><option>Medium</option><option>Large</option><option>XL</option><option>XXL</option></select></div>
      <div class="field"><label>Source</label><select id="m-source"><option value="">—</option><option>Walk-in</option><option>Online Inquiries</option><option>Referral</option><option>Old Client</option><option>Facebook</option><option>Other</option></select></div>
      <div class="field full"><label>Remarks (optional)</label><input id="m-remarks" placeholder="e.g. with pic, done text"></div>
    </div>
    <div id="m-error"></div>
  `;
  modal.appendChild(wrap);

  // --- OCR auto-fill: runs automatically when a file is chosen ---
  // (Printed text reads well; handwriting is best-effort — always review.)
  const scanBtn = wrap.querySelector('#m-scan-btn');
  const scanStatus = wrap.querySelector('#m-scan-status');
  // Holds the (possibly compressed) file that will actually be saved.
  let memberFormFile = null;
  const setVal = (id, v)=>{
    if(v!=null && String(v).trim()!==''){
      const el=document.getElementById(id);
      if(el){
        el.value = v;
        // Mark as machine-filled so the admin knows to verify it against the
        // scan. The highlight clears the moment they edit the field.
        el.classList.add('ai-filled');
        el.addEventListener('input', ()=>el.classList.remove('ai-filled'), {once:true});
        el.addEventListener('change', ()=>el.classList.remove('ai-filled'), {once:true});
        return 1;
      }
    }
    return 0;
  };

  const showPreview = (file)=>{
    const pv = wrap.querySelector('#m-form-preview');
    pv.innerHTML = ''; pv.style.display = '';
    if(file.type === 'application/pdf'){
      pv.innerHTML = '<div class="hint">PDF attached: ' + escapeHtml(file.name) + ' — open it beside this window to compare while reviewing.</div>';
      return;
    }
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.style.cssText = 'max-width:100%;max-height:340px;border:1px solid var(--line);border-radius:8px;display:block;';
    img.title = 'Compare the handwriting here against the highlighted fields below';
    const cap = document.createElement('div'); cap.className='hint'; cap.style.marginTop='6px';
    cap.textContent = 'Compare the form against the highlighted fields below — highlights clear as you confirm/edit each one.';
    pv.appendChild(img); pv.appendChild(cap);
  };

  const aiScan = async (file)=>{
    // Try the server-side AI reader first (reads handwriting well).
    if(file.size > UPLOAD_LIMIT_BYTES){
      throw new Error('This file is ' + (file.size/1024/1024).toFixed(1) + 'MB — too large to read (limit 4MB).');
    }
    scanStatus.textContent = 'Reading the form with AI\u2026 usually 5\u201315 seconds.';
    const fd = new FormData(); fd.append('file', file);
    const res = await fetch('/api/members/scan', {method:'POST', body:fd});
    if(res.status === 413){
      throw new Error('The file is too large for the reader (limit about 4MB).');
    }
    const data = await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error || 'AI reading failed.');
    if(!data.available) return null; // no API key configured \u2014 caller falls back
    const f = data.fields || {};
    let filled = 0;
    const nameV = [f.firstName, f.lastName].filter(Boolean).join(' ');
    filled += setVal('m-name', nameV || null);
    const contactV = [f.contactNumber, f.email].filter(Boolean).join(' / ');
    filled += setVal('m-contact', contactV || null);
    filled += setVal('m-start', f.startDate || null);
    if(f.branch === 'Manila' || f.branch === 'Malabon'){ document.getElementById('m-branch').value = f.branch; document.getElementById('m-branch').classList.add('ai-filled'); filled++; }
    if(f.source){ const sel = document.getElementById('m-source'); if([...sel.options].some(o=>o.value===f.source)){ sel.value = f.source; sel.classList.add('ai-filled'); filled++; } }
    if(f.tshirtSize){ const ts = document.getElementById('m-tshirt'); if([...ts.options].some(o=>o.value===f.tshirtSize)){ ts.value = f.tshirtSize; ts.classList.add('ai-filled'); filled++; } }
    // Address and gender aren't dedicated fields — keep them in remarks so the
    // detail from the form isn't lost.
    const extras = [];
    if(f.address) extras.push('Address: ' + f.address);
    if(f.gender) extras.push('Gender: ' + f.gender);
    if(f.staffRep) extras.push('Processed by: ' + f.staffRep);
    if(extras.length){ const rEl = document.getElementById('m-remarks'); if(rEl && !rEl.value) { rEl.value = extras.join(' · '); rEl.classList.add('ai-filled'); } }
    return filled;
  };

  const basicScan = async (file)=>{
    // Fallback: on-device OCR (printed labels read fine; handwriting is best-effort).
    if(file.type === 'application/pdf'){ scanStatus.textContent = 'The basic reader works on images only \u2014 the PDF will still be saved as the form copy. Fill the fields manually, or configure the AI reader for PDFs.'; return null; }
    if(typeof Tesseract === 'undefined'){
      await new Promise((res, rej)=>{
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.0/tesseract.min.js';
        s.onload = res; s.onerror = ()=>rej(new Error('Could not load the text reader. Check your internet connection.'));
        document.head.appendChild(s);
      });
    }
    scanStatus.textContent = 'Reading the form\u2026 this can take ~20 seconds.';
    const result = await Tesseract.recognize(file, 'eng');
    const text = (result && result.data && result.data.text) || '';
    const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);
    let filled = 0;
    const grab = (labels)=>{
      for(const line of lines){
        for(const lab of labels){
          const rx = new RegExp('^\\s*' + lab + '\\s*[:\\-]?\\s*(.+)$', 'i');
          const m = line.match(rx);
          if(m && m[1] && m[1].trim().length > 1) return m[1].trim();
        }
      }
      return null;
    };
    const lastName = grab(['last name']);
    const firstName = grab(['first name']);
    let nameV = (firstName || lastName) ? [firstName, lastName].filter(Boolean).join(' ') : grab(['full name','member name','name']);
    filled += setVal('m-name', nameV);
    const phoneV = grab(['contact number','contact no','contact','mobile','phone','cellphone','cp no']) ||
      (text.match(/09\d{9}|\+639\d{9}/) || [null])[0];
    const emailV = grab(['email address','email']) ||
      (text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/) || [null])[0];
    filled += setVal('m-contact', [phoneV, emailV].filter(Boolean).join(' / ') || null);
    return filled;
  };

  const runScan = async ()=>{
    const fileInput = wrap.querySelector('#m-form-file');
    const original = fileInput.files[0];
    if(!original){ scanStatus.textContent = 'Choose the form file first.'; return; }
    scanBtn.disabled = true;
    showPreview(original);

    // Shrink large photos so both the reader and the save request stay under
    // the upload limit. The compressed copy is what gets stored.
    let file = original;
    if(original.type.startsWith('image/') && original.size > UPLOAD_LIMIT_BYTES/2){
      scanStatus.textContent = 'Optimising the image\u2026';
      file = await compressImageFile(original);
    }
    memberFormFile = file;

    if(file.size > UPLOAD_LIMIT_BYTES){
      scanStatus.textContent = 'This file is ' + (file.size/1024/1024).toFixed(1) + 'MB, over the 4MB limit. ' +
        (file.type === 'application/pdf'
          ? 'Re-scan the form as a JPG/PNG photo, or export the PDF at a lower resolution.'
          : 'Try a lower-resolution scan.');
      scanBtn.disabled = false;
      return;
    }

    try{
      let filled = null;
      try{
        filled = await aiScan(file);
      }catch(aiErr){
        scanStatus.textContent = aiErr.message + ' Falling back to the basic reader\u2026';
        filled = null;
      }
      if(filled === null){
        filled = await basicScan(file);
      }
      if(filled !== null){
        scanStatus.textContent = filled
          ? 'Filled ' + filled + ' field' + (filled===1?'':'s') + ' from the form \u2014 glance over them, then save.'
          : 'Could not confidently read the details. Fill the fields manually \u2014 the form file will still be saved.';
      }
    }catch(e){
      scanStatus.textContent = e.message || 'Reading failed \u2014 fill the fields manually.';
    }
    scanBtn.disabled = false;
  };
  scanBtn.onclick = runScan;
  wrap.querySelector('#m-form-file').onchange = runScan; // auto-fill starts the moment a file is attached

  const row=document.createElement('div'); row.className='action-row';
  const b=document.createElement('button'); b.className='btn primary'; b.textContent='Add member';
  b.onclick=async ()=>{
    const name=document.getElementById('m-name').value.trim();
    const contact=document.getElementById('m-contact').value.trim();
    const plan=document.getElementById('m-plan').value;
    const start=document.getElementById('m-start').value || todayStr();
    const amount=parseFloat(document.getElementById('m-amount').value)||0;
    const branch=document.getElementById('m-branch').value;
    const status=document.getElementById('m-status').value;
    const tshirtSize=document.getElementById('m-tshirt').value;
    const source=document.getElementById('m-source').value;
    const remarks=document.getElementById('m-remarks').value.trim();
    const picked = wrap.querySelector('#m-form-file').files[0] || null;
    const errEl=document.getElementById('m-error'); errEl.innerHTML='';
    if(!picked){ errEl.innerHTML='<div class="notice err">The scanned membership form is required. Attach the PNG, JPG, or PDF before saving — a member cannot be added without their form on file.</div>'; return; }
    if(!name){ errEl.innerHTML='<div class="notice err">Enter a name for this member.</div>'; return; }
    b.disabled=true; b.textContent='Saving…';
    // Use the compressed copy if we made one; otherwise compress now.
    let formFile = memberFormFile || picked;
    if(formFile === picked && picked.type.startsWith('image/') && picked.size > UPLOAD_LIMIT_BYTES/2){
      formFile = await compressImageFile(picked);
    }
    if(formFile.size > UPLOAD_LIMIT_BYTES){
      errEl.innerHTML = `<div class="notice err">This form file is ${(formFile.size/1024/1024).toFixed(1)}MB, over the 4MB upload limit. Re-scan it as a JPG/PNG photo or at a lower resolution, then try again.</div>`;
      b.disabled=false; b.textContent='Add member'; return;
    }
    try{
      const fd = new FormData();
      fd.append('file', formFile);
      fd.append('name', name);
      fd.append('contact', contact);
      fd.append('plan', plan);
      fd.append('startDate', start);
      fd.append('amount', String(amount));
      fd.append('branch', branch);
      fd.append('status', status);
      fd.append('tshirtSize', tshirtSize);
      fd.append('source', source);
      fd.append('remarks', remarks);
      const res = await fetch('/api/members', {method:'POST', body:fd});
      if(res.status === 413) throw new Error('The form file is too large to upload (limit about 4MB). Re-scan it smaller and try again.');
      const data = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error || 'Something went wrong.');
      state.members.push(mapMember(data.member));
      state.modal=null; render();
    }catch(e){ errEl.innerHTML = `<div class="notice err">${escapeHtml(e.message)}</div>`; b.disabled=false; b.textContent='Add member'; }
  };
  row.appendChild(b); modal.appendChild(row);
}

function renderRenewMemberModal(modal){
  const m = state.members.find(x=>x.id===state.modal.id);
  const head=document.createElement('div'); head.className='modal-head'; head.innerHTML = `<h2 style="font-size:16px;">Renew — ${escapeHtml(m.name)}</h2>`; head.appendChild(closeBtn()); modal.appendChild(head);
  const info=document.createElement('div'); info.className='notice';
  info.textContent = 'Current plan: ' + m.plan + '. Expires ' + fmtDate(m.expiryDate) + '.';
  modal.appendChild(info);
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="form-grid">
      <div class="field"><label>Plan</label><select id="r-plan">${Object.keys(PLAN_MONTHS).map(p=>`<option value="${p}" ${p===m.plan?'selected':''}>${p}</option>`).join('')}</select></div>
      <div class="field"><label>Renewal date</label><input id="r-date" type="date" value="${todayStr()}"></div>
      <div class="field"><label>Amount paid (PHP)</label><input id="r-amount" type="number" min="0" step="0.01" placeholder="0.00"></div>
      <div class="field" id="r-custom-wrap" style="display:none"><label>New expiry date</label><input id="r-custom-expiry" type="date"></div>
    </div>
    <div id="r-error"></div>
  `;
  modal.appendChild(wrap);
  const planSel = wrap.querySelector('#r-plan');
  const customWrap = wrap.querySelector('#r-custom-wrap');
  function syncCustom(){ customWrap.style.display = planSel.value==='Class pack' ? '' : 'none'; }
  planSel.onchange = syncCustom; syncCustom();

  const row=document.createElement('div'); row.className='action-row';
  const b=document.createElement('button'); b.className='btn primary'; b.textContent='Confirm renewal';
  b.onclick=async ()=>{
    const plan=planSel.value;
    const date=document.getElementById('r-date').value || todayStr();
    const amount=parseFloat(document.getElementById('r-amount').value)||0;
    const customExpiry=document.getElementById('r-custom-expiry').value;
    const errEl=document.getElementById('r-error'); errEl.innerHTML='';
    if(plan==='Class pack' && !customExpiry){ errEl.innerHTML='<div class="notice err">Set the new expiry date for this class pack.</div>'; return; }
    b.disabled=true; b.textContent='Saving…';
    try{
      const {member} = await apiPost(`/api/members/${m.id}`, {plan, date, amount, customExpiry});
      const mapped = mapMember(member);
      Object.assign(m, mapped);
      state.modal=null; render();
    }catch(e){ errEl.innerHTML = `<div class="notice err">${escapeHtml(e.message)}</div>`; b.disabled=false; b.textContent='Confirm renewal'; }
  };
  row.appendChild(b); modal.appendChild(row);
}

// ============ PO TRACKER (reconciliation: PO + check payment + delivery receipt) ============
function requestToExportRow(r){
  const checkAmt = (r.check && r.check.amount!=null) ? Number(r.check.amount) : Number(r.amount||0);
  return {
    'Reference #': r.id,
    'Type': r.type==='PO' ? 'Purchase order' : 'Petty cash',
    'Branch': r.branch || '',
    'Supplier / payee': r.supplier || r.payee || '',
    'Check payable to': r.payee || '',
    'Description': r.title || '',
    'Requested by': r.requestor || r.createdBy || '',
    'Date requested': r.createdAt ? r.createdAt.slice(0,10) : '',
    'Status': r.status,
    'Approved by': (r.approval && r.approval.approvedBy) || '',
    'PO amount (PHP)': Number(r.amount||0),
    'Payment method': r.paymentMethod || '',
    'Check / payment ref': (r.check && r.check.number) || '',
    'Payment date': (r.check && r.check.date) || '',
    'Delivery date': (r.delivery && r.delivery.confirmedAt) ? r.delivery.confirmedAt.slice(0,10) : '',
    'Reconciled': r.reconciledAt ? 'Yes' : '',
    'Check amount (PHP)': (r.check && r.check.number) ? checkAmt : '',
    'Delivery amount (PHP)': (r.delivery && r.delivery.deliveredAmount!=null) ? Number(r.delivery.deliveredAmount) : '',
    'Variance (PHP)': (r.delivery && r.delivery.variance) ? Number(r.delivery.variance) : '',
    'Variance status': (r.delivery && r.delivery.varianceStatus) || '',
    'POS reference': (r.pos && r.pos.reference) || '',
    'POS screenshot on file': (r.pos && r.pos.hasScreenshot) ? 'Yes' : '',
    'Files attached': (r.attachments||[]).length,
    'Notes': r.notes || '',
  };
}

function exportRowsToExcel(rows, sheetName, filePrefix){
  if(typeof XLSX === 'undefined'){ alert('The Excel library did not load. Check your internet connection and refresh the page.'); return; }
  if(!rows.length){ alert('Nothing to export yet.'); return; }
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Object.keys(rows[0]).map(k=>({wch: Math.max(k.length+2, 14)}));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0,31));
  XLSX.writeFile(wb, `${filePrefix}-${todayStr()}.xlsx`);
}

function exportRequestsToExcel(rows, sheetName, filePrefix){
  if(typeof XLSX === 'undefined'){ alert('The Excel library did not load. Check your internet connection and refresh the page.'); return; }
  if(!rows.length){ alert('Nothing to export yet.'); return; }
  const data = rows.map(requestToExportRow);
  const ws = XLSX.utils.json_to_sheet(data);
  // reasonable column widths
  ws['!cols'] = Object.keys(data[0]).map(k=>({wch: Math.max(k.length+2, 14)}));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0,31));
  const today = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `${filePrefix}-${today}.xlsx`);
}

// ---- Payment schedule: every recorded payment, grouped by week, with bank
// reconciliation ticks so the week's outgoings can be matched to the statement.
function mondayOf(dateStr){
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (day===0 ? 6 : day-1));
  return d.toISOString().slice(0,10);
}

function renderPaymentSchedule(el){
  const isSuper = accessTier(curRole())==='SuperAdmin';
  if(!state.payFilter) state.payFilter = 'All';

  // Only requests with a recorded payment belong on a payment schedule.
  const paid = activeRequests()
    .filter(r=>r.check && r.check.number && r.check.date)
    .filter(r=>state.trackerType==='All' || r.type===state.trackerType)
    .filter(r=>inDateRange(r.check.date, state.payFrom, state.payTo))
    .sort((a,b)=> (b.check.date||'').localeCompare(a.check.date||''));

  const shown = state.payFilter==='All' ? paid
    : state.payFilter==='Unreconciled' ? paid.filter(r=>!r.reconciledAt)
    : paid.filter(r=>r.reconciledAt);

  const totalOut = paid.reduce((s,r)=>s+Number((r.check&&r.check.amount)||r.amount||0),0);
  const unrec = paid.filter(r=>!r.reconciledAt);
  const unrecTotal = unrec.reduce((s,r)=>s+Number((r.check&&r.check.amount)||r.amount||0),0);
  const thisWeek = mondayOf(todayStr());
  const weekPayments = paid.filter(r=>mondayOf(r.check.date)===thisWeek);
  const weekTotal = weekPayments.reduce((s,r)=>s+Number((r.check&&r.check.amount)||r.amount||0),0);

  const metrics = document.createElement('div'); metrics.className='metrics';
  metrics.innerHTML = `
    <div class="metric"><div class="num">${fmtMoney(weekTotal).replace('PHP ','')}</div><div class="lbl">This week's payments (${weekPayments.length})</div></div>
    <div class="metric ${unrec.length?'flag':'good'}"><div class="num">${unrec.length}</div><div class="lbl">Not yet reconciled</div></div>
    <div class="metric ${unrecTotal?'flag':''}"><div class="num">${fmtMoney(unrecTotal).replace('PHP ','')}</div><div class="lbl">Unreconciled value (PHP)</div></div>
    <div class="metric"><div class="num">${fmtMoney(totalOut).replace('PHP ','')}</div><div class="lbl">Total recorded payments</div></div>
  `;
  el.appendChild(metrics);

  const head = document.createElement('div'); head.className='section-head';
  head.innerHTML = '<h2>Payment schedule</h2>';
  const bar = document.createElement('div'); bar.className='toolbar';
  const typeSel = document.createElement('select');
  typeSel.innerHTML = `
    <option value="All" ${state.trackerType==='All'?'selected':''}>All types</option>
    <option value="PO" ${state.trackerType==='PO'?'selected':''}>Purchase orders</option>
    <option value="PettyCash" ${state.trackerType==='PettyCash'?'selected':''}>Petty cash</option>`;
  typeSel.onchange = ()=>{ state.trackerType = typeSel.value; render(); };
  bar.appendChild(typeSel);
  const recSel = document.createElement('select');
  recSel.innerHTML = `
    <option value="All" ${state.payFilter==='All'?'selected':''}>All payments (${paid.length})</option>
    <option value="Unreconciled" ${state.payFilter==='Unreconciled'?'selected':''}>Not reconciled (${unrec.length})</option>
    <option value="Reconciled" ${state.payFilter==='Reconciled'?'selected':''}>Reconciled (${paid.length-unrec.length})</option>`;
  recSel.onchange = ()=>{ state.payFilter = recSel.value; render(); };
  bar.appendChild(recSel);
  const payRange = dateRangeControl(()=>state.payFrom, ()=>state.payTo, (f,t)=>{ state.payFrom=f; state.payTo=t; render(); });
  bar.appendChild(payRange);
  const exBtn = document.createElement('button'); exBtn.className='btn'; exBtn.textContent='Export to Excel';
  exBtn.onclick = ()=>{
    const rows = shown.map(r=>({
      'Payment date': r.check.date,
      'Week of': mondayOf(r.check.date),
      'Reference #': r.id,
      'Type': r.type==='PO'?'Purchase order':'Petty cash',
      'Payment method': r.paymentMethod||'',
      'Check / payment ref': r.check.number||'',
      'Payee': r.payee||r.supplier||'',
      'Branch': r.branch||'',
      'Amount (PHP)': Number(r.check.amount||r.amount||0),
      'Description': r.title||'',
      'Delivery date': (r.delivery&&r.delivery.confirmedAt)?r.delivery.confirmedAt.slice(0,10):'',
      'Status': r.status,
      'Reconciled': r.reconciledAt ? 'Yes' : 'NO',
      'Reconciled by': r.reconciledBy||'',
      'Reconciled on': r.reconciledAt?r.reconciledAt.slice(0,10):'',
    }));
    exportRowsToExcel(rows, 'Payment schedule', 'roshan-payment-schedule');
  };
  bar.appendChild(exBtn);
  head.appendChild(bar);
  el.appendChild(head);

  if(!shown.length){
    const e=document.createElement('div'); e.className='empty';
    e.textContent = paid.length ? 'No payments match this filter.' : 'No payments recorded yet. Payments appear here once an Owner prepares the check or cash release.';
    el.appendChild(e); return;
  }

  const note = document.createElement('div'); note.className='notice';
  note.textContent = isSuper
    ? 'Payments are grouped by week (Monday start). Tick each one off as you match it against the bank statement — the tick records who reconciled it and when.'
    : 'Payments are grouped by week (Monday start). Only Owners and Supervisors can tick items off against the bank statement.';
  el.appendChild(note);

  // Group by week
  const byWeek = {};
  shown.forEach(r=>{ const w = mondayOf(r.check.date); (byWeek[w] = byWeek[w] || []).push(r); });
  Object.keys(byWeek).sort((a,b)=>b.localeCompare(a)).forEach(week=>{
    const list = byWeek[week].sort((a,b)=> (a.check.date||'').localeCompare(b.check.date||''));
    const wTotal = list.reduce((s,r)=>s+Number((r.check&&r.check.amount)||r.amount||0),0);
    const wUnrec = list.filter(r=>!r.reconciledAt).length;
    const wHead = document.createElement('div'); wHead.className='section-head'; wHead.style.marginTop='22px';
    wHead.innerHTML = `<h2 style="font-size:13px;">Week of ${fmtDate(week)} <span class="hint" style="text-transform:none;letter-spacing:0;">· ${list.length} payment${list.length===1?'':'s'} · ${fmtMoney(wTotal)}${wUnrec?` · <span style="color:var(--red-ink)">${wUnrec} unreconciled</span>`:' · all reconciled'}</span></h2>`;
    el.appendChild(wHead);

    const card = document.createElement('div'); card.className='card';
    const scroll = document.createElement('div'); scroll.style.cssText='overflow-x:auto;';
    const table = document.createElement('table'); table.className='simple'; table.style.minWidth='860px';
    table.innerHTML = '<thead><tr><th>Payment date</th><th>Ref #</th><th>Type</th><th>Payee</th><th>Payment ref</th><th style="text-align:right">Amount</th><th>Delivery</th><th>Reconciled</th><th></th></tr></thead>';
    const tbody = document.createElement('tbody');
    list.forEach(r=>{
      const amt = Number((r.check&&r.check.amount)||r.amount||0);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fmtDate(r.check.date)}</td>
        <td>${r.id}</td>
        <td>${r.type==='PO'?'<span class="badge ok">PO</span>':'<span class="badge neutral">Petty cash</span>'}</td>
        <td>${escapeHtml(r.payee||r.supplier||'—')}</td>
        <td style="font-family:var(--font-m)">${escapeHtml(r.check.number||'—')}</td>
        <td style="text-align:right;font-family:var(--font-m)">${fmtMoney(amt).replace('PHP ','')}</td>
        <td>${(r.delivery&&r.delivery.confirmedAt)?fmtDate(r.delivery.confirmedAt.slice(0,10)):'<span class="hint">pending</span>'}</td>
        <td>${r.reconciledAt?`<span class="badge ok">${fmtDate(r.reconciledAt.slice(0,10))}</span><div class="hint">${escapeHtml(r.reconciledBy||'')}</div>`:'<span class="badge flag">Not yet</span>'}</td>
      `;
      const td = document.createElement('td');
      if(isSuper){
        const b = document.createElement('button');
        b.className = 'btn sm' + (r.reconciledAt ? ' ghost' : ' primary');
        b.textContent = r.reconciledAt ? 'Undo' : '✓ Reconcile';
        b.onclick = async ()=>{
          b.disabled = true;
          try{
            const {request} = await apiPost(`/api/requests/${r.id}/action`, {action: r.reconciledAt ? 'unreconcile' : 'reconcile'});
            upsertRequest(mapRequest(request));
            render();
          }catch(e){ alert(e.message); b.disabled=false; }
        };
        td.appendChild(b);
      }
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    scroll.appendChild(table);
    card.appendChild(scroll);
    el.appendChild(card);
  });
}

function renderPoTracker(el){
  if(!state.trackerType) state.trackerType = 'All';
  if(!state.trackerView) state.trackerView = 'tracker';

  const viewBar = document.createElement('div'); viewBar.className='toolbar'; viewBar.style.marginBottom='16px';
  [{k:'tracker', l:'Request tracker'}, {k:'payments', l:'Payment schedule'}].forEach(v=>{
    const b = document.createElement('button');
    b.className = 'btn' + (state.trackerView===v.k ? ' primary' : '');
    b.textContent = v.l;
    b.onclick = ()=>{ state.trackerView = v.k; render(); };
    viewBar.appendChild(b);
  });
  el.appendChild(viewBar);

  if(state.trackerView==='payments') return renderPaymentSchedule(el);

  const allRows = activeRequests().filter(r=>r.type==='PO' || r.type==='PettyCash').sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt));
  const inTrackerRange = (r)=> inDateRange(r.createdAt, state.trackerFrom, state.trackerTo);
  const rowsByType = state.trackerType==='All' ? allRows : allRows.filter(r=>r.type===state.trackerType);
  const rows = rowsByType.filter(inTrackerRange);

  const totalPOs = rows.length;
  const matched = rows.filter(r=>r.check && r.check.number && r.delivery && r.delivery.confirmedAt).length;
  const missingCheck = rows.filter(r=>!( r.check && r.check.number) && r.status!=='Pending Approval' && r.status!=='Rejected').length;
  const missingReceipt = rows.filter(r=>r.check && r.check.number && !(r.delivery && r.delivery.confirmedAt) && r.status!=='Rejected').length;
  const openVariance = rows.filter(r=>r.delivery && r.delivery.varianceStatus==='Needs resolution').length;

  const metrics = document.createElement('div'); metrics.className='metrics';
  metrics.innerHTML = `
    <div class="metric good"><div class="num">${matched}</div><div class="lbl">Fully matched (PO + payment + receipt)</div></div>
    <div class="metric ${missingCheck>0?'flag':''}"><div class="num">${missingCheck}</div><div class="lbl">Missing payment reference</div></div>
    <div class="metric ${missingReceipt>0?'flag':''}"><div class="num">${missingReceipt}</div><div class="lbl">Paid, no receipt filed yet</div></div>
    <div class="metric ${openVariance>0?'flag':''}"><div class="num">${openVariance}</div><div class="lbl">Payment variances unresolved</div></div>
  `;
  el.appendChild(metrics);

  const note = document.createElement('div'); note.className='notice';
  note.textContent = 'This replaces the manual PO Tracker and Transmittal sheets — every row here is one request, and its payment reference, delivery receipt, and any amount variance are pulled straight from that request, so they can never drift out of sync.';
  el.appendChild(note);

  const trackerHead = document.createElement('div'); trackerHead.className='section-head';
  const headTitle = state.trackerType==='PO' ? 'Purchase orders' : state.trackerType==='PettyCash' ? 'Petty cash' : 'All requests';
  trackerHead.innerHTML = `<h2>${headTitle}</h2>`;
  const tbar = document.createElement('div'); tbar.className='toolbar';
  if(state.trackerSearch==null) state.trackerSearch='';
  const tSearch = document.createElement('input');
  tSearch.type='search'; tSearch.placeholder='Search requests\u2026'; tSearch.value=state.trackerSearch; tSearch.style.minWidth='220px';
  tbar.appendChild(tSearch);
  const poCount = allRows.filter(r=>r.type==='PO').length;
  const pcCount = allRows.filter(r=>r.type==='PettyCash').length;
  const typeSel = document.createElement('select');
  typeSel.innerHTML = `
    <option value="All" ${state.trackerType==='All'?'selected':''}>All requests (${allRows.length})</option>
    <option value="PO" ${state.trackerType==='PO'?'selected':''}>Purchase orders only (${poCount})</option>
    <option value="PettyCash" ${state.trackerType==='PettyCash'?'selected':''}>Petty cash only (${pcCount})</option>
  `;
  typeSel.onchange = ()=>{ state.trackerType = typeSel.value; render(); };
  tbar.appendChild(typeSel);
  const trackerRange = dateRangeControl(()=>state.trackerFrom, ()=>state.trackerTo, (f,t)=>{ state.trackerFrom=f; state.trackerTo=t; render(); });
  tbar.appendChild(trackerRange);
  const exportBtn = document.createElement('button'); exportBtn.className='btn'; exportBtn.textContent='Export to Excel';
  const exportName = state.trackerType==='PO' ? 'roshan-po-tracker-purchase-orders'
    : state.trackerType==='PettyCash' ? 'roshan-po-tracker-petty-cash' : 'roshan-po-tracker';
  exportBtn.onclick = ()=>exportRequestsToExcel(rows, 'PO Tracker', exportName);
  tbar.appendChild(exportBtn);
  trackerHead.appendChild(tbar);
  el.appendChild(trackerHead);

  if(rows.length===0){
    const e=document.createElement('div'); e.className='empty';
    e.textContent = state.trackerType==='All' ? 'No requests yet.' : 'No ' + (state.trackerType==='PO'?'purchase orders':'petty cash requests') + ' yet.';
    el.appendChild(e); return;
  }

  const table = document.createElement('table'); table.className='simple';
  table.innerHTML = `<thead><tr><th>Ref #</th><th>Type</th><th>Branch</th><th>Requestor</th><th>Supplier / payee</th><th style="text-align:right">Check amount</th><th>Payment ref</th><th>Payment date</th><th>Delivery date</th><th>Receipt filed</th><th>Variance</th><th>POS</th></tr></thead>`;
  const tbody = document.createElement('tbody');
  rows.forEach(r=>{
    const tr = document.createElement('tr');
    tr.dataset.search = requestSearchText(r);
    tr.style.cursor = 'pointer';
    tr.onclick = ()=>{ state.modal={type:'detail', id:r.id}; render(); };
    const paymentRef = r.check && r.check.number ? '#'+escapeHtml(r.check.number) : '—';
    const checkAmt = (r.check && r.check.amount!=null) ? r.check.amount : r.amount;
    const receiptOk = !!(r.delivery && r.delivery.confirmedAt);
    const posOk = r.status==='Recorded in POS';
    const posProof = posOk ? (r.pos && (r.pos.reference || r.pos.hasScreenshot)) : true;
    let varianceCell = '<span class="badge neutral">—</span>';
    if(r.delivery && r.delivery.varianceStatus==='Needs resolution') varianceCell = `<span class="badge flag">${fmtMoney(Math.abs(r.delivery.variance)).replace('PHP ','')} open</span>`;
    else if(r.delivery && r.delivery.varianceStatus==='Resolved') varianceCell = '<span class="badge ok">Resolved</span>';
    else if(r.delivery && r.delivery.varianceStatus==='Matched') varianceCell = '<span class="badge ok">Matched</span>';
    const typeBadge = r.type==='PO'
      ? '<span class="badge ok">Purchase order</span>'
      : '<span class="badge neutral">Petty cash</span>';
    tr.innerHTML = `
      <td>${r.id}</td>
      <td>${typeBadge}</td>
      <td>${escapeHtml(r.branch||'—')}</td>
      <td>${escapeHtml(r.requestor||r.createdBy||'—')}</td>
      <td>${escapeHtml(r.supplier||r.payee)}</td>
      <td style="text-align:right;font-family:var(--font-m)">${fmtMoney(checkAmt).replace('PHP ','')}</td>
      <td>${paymentRef}</td>
      <td>${r.check && r.check.date ? fmtDate(r.check.date) : '<span class="hint">—</span>'}</td>
      <td>${r.delivery && r.delivery.confirmedAt ? fmtDate(r.delivery.confirmedAt.slice(0,10)) : '<span class="hint">—</span>'}</td>
      <td><span class="badge ${receiptOk?'ok':'neutral'}">${receiptOk?'Yes':'Pending'}</span></td>
      <td>${varianceCell}</td>
      <td><span class="badge ${posOk?'ok':'neutral'}">${posOk?(posProof?'Recorded':'No proof'):'Pending'}</span></td>
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  const applyTrackerSearch = ()=>{ const q=tSearch.value||'';
    [...tbody.children].forEach(tr=>{ tr.style.display = requestMatchesQuery(tr.dataset.search||'', q) ? '' : 'none'; }); };
  tSearch.oninput = ()=>{ state.trackerSearch=tSearch.value; applyTrackerSearch(); };
  applyTrackerSearch();
  const tableCard = document.createElement('div'); tableCard.className='card';
  const scrollWrap = document.createElement('div'); scrollWrap.style.cssText='overflow-x:auto;';
  scrollWrap.appendChild(table);
  tableCard.appendChild(scrollWrap);
  el.appendChild(tableCard);

  // ---- Deleted items (Super Admin only) ----
  if(accessTier(curRole())==='SuperAdmin'){
    const deleted = deletedRequests().sort((a,b)=> new Date(b.deletedAt)-new Date(a.deletedAt));
    const dHead = document.createElement('div'); dHead.className='section-head'; dHead.style.marginTop='26px';
    dHead.innerHTML = `<h2>Deleted items (${deleted.length})</h2>`;
    el.appendChild(dHead);
    if(deleted.length===0){
      const e=document.createElement('div'); e.className='hint'; e.textContent='Nothing deleted. When a request is deleted, it appears here with who deleted it and when, and can be restored or permanently removed.';
      el.appendChild(e);
    } else {
      const dCard = document.createElement('div'); dCard.className='card';
      const dScroll = document.createElement('div'); dScroll.style.cssText='overflow-x:auto;';
      const dTable = document.createElement('table'); dTable.className='simple';
      dTable.innerHTML = '<thead><tr><th>Reference #</th><th>Type</th><th>Requestor</th><th>Description</th><th>Supplier / payee</th><th style="text-align:right">Amount</th><th>Deleted by</th><th>Deleted on</th><th></th></tr></thead>';
      const dBody = document.createElement('tbody');
      deleted.forEach(r=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${r.id}</td>
          <td>${r.type==='PO' ? '<span class="badge ok">Purchase order</span>' : '<span class="badge neutral">Petty cash</span>'}</td>
          <td>${escapeHtml(r.requestor||r.createdBy||'—')}</td>
          <td>${escapeHtml(r.title)}</td>
          <td>${escapeHtml(r.supplier||r.payee)}</td>
          <td style="text-align:right;font-family:var(--font-m)">${fmtMoney(r.amount).replace('PHP ','')}</td>
          <td>${escapeHtml(r.deletedBy||'—')}</td>
          <td>${fmtDateTime(r.deletedAt)}</td>
        `;
        const td = document.createElement('td');
        td.style.cssText='display:flex;gap:6px;flex-wrap:wrap;';
        const viewBtn = document.createElement('button'); viewBtn.className='btn sm ghost'; viewBtn.textContent='View';
        viewBtn.onclick = ()=>{ state.modal={type:'detail', id:r.id}; render(); };
        const restoreBtn = document.createElement('button'); restoreBtn.className='btn sm primary'; restoreBtn.textContent='Restore';
        restoreBtn.onclick = ()=>restoreReq(r);
        const purgeBtn = document.createElement('button'); purgeBtn.className='btn sm danger'; purgeBtn.textContent='Delete permanently';
        purgeBtn.onclick = ()=>purgeReq(r);
        td.appendChild(viewBtn); td.appendChild(restoreBtn); td.appendChild(purgeBtn);
        tr.appendChild(td);
        dBody.appendChild(tr);
      });
      dTable.appendChild(dBody);
      dScroll.appendChild(dTable);
      dCard.appendChild(dScroll);
      el.appendChild(dCard);
    }
  }
}

function renderStaffModal(modal){
  const head=document.createElement('div'); head.className='modal-head';
  head.innerHTML = '<h2 style="font-size:16px;">Staff directory</h2>';
  head.appendChild(closeBtn()); modal.appendChild(head);

  const scroll = document.createElement('div'); scroll.style.cssText='overflow-x:auto;margin-bottom:16px;';
  const table = document.createElement('table'); table.className='simple'; table.style.minWidth='640px';
  table.innerHTML = '<thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Shift end</th><th>Status</th><th></th></tr></thead>';
  const tbody = document.createElement('tbody');
  const SHIFT_OPTS = [{v:15,l:'3:00 PM (AM shift)'},{v:20,l:'8:00 PM (supervisor)'},{v:23,l:'11:00 PM (PM / straight)'},{v:0,l:'Rest day (no alerts)'}];
  state.staff.forEach(p=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(p.name)}</td><td style="font-family:var(--font-m)">${escapeHtml(p.username||'—')}</td><td>${p.role}</td>`;
    // Shift-end dropdown cell
    const shiftCell = document.createElement('td');
    const cur = (p.shift_end_hour != null) ? p.shift_end_hour : 15;
    const sel = document.createElement('select'); sel.style.cssText='font-size:12px;padding:4px 6px;';
    sel.innerHTML = SHIFT_OPTS.map(o=>`<option value="${o.v}" ${o.v===cur?'selected':''}>${o.l}</option>`).join('');
    sel.onchange = async ()=>{
      try{
        const {shiftEndHour} = await apiPatch(`/api/staff/${p.id}`, {action:'set-shift', shiftEndHour:Number(sel.value)});
        p.shift_end_hour = shiftEndHour;
      }catch(e){ alert(e.message); sel.value = String(cur); }
    };
    shiftCell.appendChild(sel);
    tr.appendChild(shiftCell);
    // Status cell
    const statusCell = document.createElement('td');
    statusCell.innerHTML = `<span class="badge ${p.active!==false?'ok':'neutral'}">${p.active!==false?'Active':'Deactivated'}</span>`;
    tr.appendChild(statusCell);
    const td = document.createElement('td');
    td.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
    const resetBtn = document.createElement('button'); resetBtn.className='btn sm'; resetBtn.textContent='Reset password';
    resetBtn.onclick = ()=>{ state.modal = {type:'resetPassword', id:p.id}; render(); };
    const btn = document.createElement('button'); btn.className='btn sm'; btn.textContent = p.active!==false ? 'Deactivate' : 'Reactivate';
    btn.onclick = async ()=>{
      try{ const {active} = await apiPatch(`/api/staff/${p.id}`, {action:'toggle-active'}); p.active = active; state.modal={type:'staff'}; render(); }
      catch(e){ alert(e.message); }
    };
    td.appendChild(resetBtn); td.appendChild(btn);
    tr.appendChild(td);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  scroll.appendChild(table);
  modal.appendChild(scroll);
  modal.appendChild(divider());

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <h3 style="font-size:12px;color:var(--ink-2);margin-bottom:10px;letter-spacing:.03em;">Add new staff member</h3>
    <div class="form-grid">
      <div class="field full"><label>Full name</label><input id="staff-name" placeholder="e.g. Juan Dela Cruz"></div>
      <div class="field"><label>Username</label><input id="staff-username" placeholder="e.g. juan"></div>
      <div class="field"><label>Temporary password</label><input id="staff-password" type="text" placeholder="e.g. roshan123"></div>
      <div class="field full"><label>Role</label><select id="staff-role">
        <option value="Admin">Admin — admin dashboard only</option>
        <option value="Supervisor">Supervisor — super admin (approvals)</option>
        <option value="Owner">Owner — super admin (payments)</option>
        <option value="Coach">Coach — coach dashboard only</option>
      </select></div>
    </div>
    <div id="staff-error"></div>
  `;
  modal.appendChild(wrap);
  const row = document.createElement('div'); row.className='action-row';
  const b = document.createElement('button'); b.className='btn primary'; b.textContent='Add staff member';
  b.onclick = async ()=>{
    const name = document.getElementById('staff-name').value.trim();
    const username = document.getElementById('staff-username').value.trim().toLowerCase();
    const password = document.getElementById('staff-password').value;
    const role = document.getElementById('staff-role').value;
    const errEl = document.getElementById('staff-error'); errEl.innerHTML='';
    if(!name){ errEl.innerHTML='<div class="notice err">Enter a name.</div>'; return; }
    if(!username){ errEl.innerHTML='<div class="notice err">Enter a username.</div>'; return; }
    if(!password || password.length<4){ errEl.innerHTML='<div class="notice err">Set a temporary password of at least 4 characters.</div>'; return; }
    b.disabled=true; b.textContent='Saving…';
    try{
      const {staff} = await apiPost('/api/staff', {name, username, password, role});
      state.staff.push(staff);
      state.modal = {type:'staff'}; render();
    }catch(e){ errEl.innerHTML = `<div class="notice err">${escapeHtml(e.message)}</div>`; b.disabled=false; b.textContent='Add staff member'; }
  };
  row.appendChild(b); modal.appendChild(row);
}

function renderResetPasswordModal(modal){
  const p = state.staff.find(s=>s.id===state.modal.id);
  const head=document.createElement('div'); head.className='modal-head';
  head.innerHTML = `<h2 style="font-size:16px;">Reset password — ${escapeHtml(p.name)}</h2>`;
  head.appendChild(closeBtn()); modal.appendChild(head);
  const field = document.createElement('div'); field.className='field';
  field.innerHTML = '<label>New temporary password</label><input id="reset-pw" type="text" placeholder="e.g. roshan123">';
  modal.appendChild(field);
  const errWrap = document.createElement('div'); errWrap.id='reset-error'; modal.appendChild(errWrap);
  const row = document.createElement('div'); row.className='action-row';
  const b = document.createElement('button'); b.className='btn primary'; b.textContent='Set new password';
  b.onclick = async ()=>{
    const pw = document.getElementById('reset-pw').value;
    const errEl = document.getElementById('reset-error');
    if(!pw || pw.length<4){ errEl.innerHTML='<div class="notice err">Password must be at least 4 characters.</div>'; return; }
    b.disabled=true; b.textContent='Saving…';
    try{
      await apiPatch(`/api/staff/${p.id}`, {action:'reset-password', password:pw});
      state.modal = {type:'staff'}; render();
    }catch(e){ errEl.innerHTML = `<div class="notice err">${escapeHtml(e.message)}</div>`; b.disabled=false; b.textContent='Set new password'; }
  };
  row.appendChild(b); modal.appendChild(row);
}

function renderChangePasswordModal(modal){
  const head=document.createElement('div'); head.className='modal-head';
  head.innerHTML = '<h2 style="font-size:16px;">Change password</h2>';
  head.appendChild(closeBtn()); modal.appendChild(head);
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="field"><label>Current password</label><input id="cp-current" type="password"></div>
    <div class="field"><label>New password</label><input id="cp-new" type="password"></div>
    <div class="field"><label>Confirm new password</label><input id="cp-confirm" type="password"></div>
    <div id="cp-error"></div>
  `;
  modal.appendChild(wrap);
  const row = document.createElement('div'); row.className='action-row';
  const b = document.createElement('button'); b.className='btn primary'; b.textContent='Update password';
  b.onclick = async ()=>{
    const currentPassword = document.getElementById('cp-current').value;
    const newPassword = document.getElementById('cp-new').value;
    const confirm = document.getElementById('cp-confirm').value;
    const errEl = document.getElementById('cp-error'); errEl.innerHTML='';
    if(!newPassword || newPassword.length<4){ errEl.innerHTML='<div class="notice err">New password must be at least 4 characters.</div>'; return; }
    if(newPassword !== confirm){ errEl.innerHTML='<div class="notice err">New passwords do not match.</div>'; return; }
    b.disabled=true; b.textContent='Saving…';
    try{
      await apiPost('/api/me/password', {currentPassword, newPassword});
      state.modal = null; render();
    }catch(e){ errEl.innerHTML = `<div class="notice err">${escapeHtml(e.message)}</div>`; b.disabled=false; b.textContent='Update password'; }
  };
  row.appendChild(b); modal.appendChild(row);
}

function renderPricelistModal(modal){
  const head=document.createElement('div'); head.className='modal-head';
  head.innerHTML = '<h2 style="font-size:16px;">Manage pricelist</h2>';
  head.appendChild(closeBtn()); modal.appendChild(head);

  const note = document.createElement('div'); note.className='hint'; note.style.marginBottom='14px';
  note.textContent = 'Edit a price and it saves automatically. These prices auto-fill new purchase orders, but can always be overridden per order.';
  modal.appendChild(note);

  const scroll = document.createElement('div'); scroll.style.cssText='overflow-x:auto;margin-bottom:16px;max-height:360px;overflow-y:auto;';
  const table = document.createElement('table'); table.className='simple'; table.style.minWidth='480px';
  table.innerHTML = '<thead><tr><th>Item</th><th>Supplier</th><th>Unit cost</th><th></th></tr></thead>';
  const tbody = document.createElement('tbody');
  const activeProducts = state.products.filter(p=>p.active!==false).sort((a,b)=>a.item.localeCompare(b.item));
  activeProducts.forEach(p=>{
    const supNames = (p.supplierKeys||[]).map(k=>{ const s=SUPPLIERS.find(x=>x.key===k); return s?s.name:k; }).join(', ') || 'Any supplier';
    const tr = document.createElement('tr');
    const costCell = document.createElement('td');
    const costInput = document.createElement('input');
    costInput.type='number'; costInput.min='0'; costInput.step='0.01'; costInput.value=p.cost;
    costInput.style.cssText = 'background:var(--bg-2);border:1px solid var(--line);border-radius:6px;color:var(--ink-0);padding:6px 8px;font-size:12.5px;width:90px;';
    costInput.onchange = async ()=>{ const cost = parseFloat(costInput.value)||0; try{ const {product}=await apiPatch(`/api/products/${p.id}`, {cost}); Object.assign(p, mapProduct(product)); }catch(e){ alert(e.message); } };
    costCell.appendChild(costInput);
    tr.innerHTML = `<td>${escapeHtml(p.item)}</td><td style="font-size:12px;color:var(--ink-2);">${escapeHtml(supNames)}</td>`;
    tr.appendChild(costCell);
    const actCell = document.createElement('td');
    const rmBtn = document.createElement('button'); rmBtn.className='btn sm'; rmBtn.textContent='Remove';
    rmBtn.onclick = async ()=>{ try{ await apiPatch(`/api/products/${p.id}`, {active:false}); p.active=false; state.modal={type:'pricelist'}; render(); }catch(e){ alert(e.message); } };
    actCell.appendChild(rmBtn);
    tr.appendChild(actCell);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  scroll.appendChild(table);
  modal.appendChild(scroll);
  modal.appendChild(divider());

  const addWrap = document.createElement('div');
  addWrap.innerHTML = `
    <h3 style="font-size:12px;color:var(--ink-2);margin-bottom:10px;letter-spacing:.03em;">Add new product</h3>
    <div class="form-grid">
      <div class="field full"><label>Item name</label><input id="np-item" placeholder="e.g. Vitamilk 1L"></div>
      <div class="field"><label>Unit cost (PHP)</label><input id="np-cost" type="number" min="0" step="0.01" placeholder="0.00"></div>
      <div class="field"><label>Supplier</label><select id="np-supplier"><option value="">Any supplier</option>${SUPPLIERS.map(s=>`<option value="${s.key}">${escapeHtml(s.name)}</option>`).join('')}</select></div>
    </div>
    <div id="np-error"></div>
  `;
  modal.appendChild(addWrap);
  const row = document.createElement('div'); row.className='action-row';
  const b = document.createElement('button'); b.className='btn primary'; b.textContent='Add product';
  b.onclick = async ()=>{
    const item = document.getElementById('np-item').value.trim();
    const cost = parseFloat(document.getElementById('np-cost').value);
    const supKey = document.getElementById('np-supplier').value;
    const errEl = document.getElementById('np-error'); errEl.innerHTML='';
    if(!item || !cost || cost<=0){ errEl.innerHTML='<div class="notice err">Enter an item name and a valid cost.</div>'; return; }
    b.disabled=true; b.textContent='Saving…';
    try{
      const {product} = await apiPost('/api/products', {item, cost, supplierKeys: supKey ? [supKey] : []});
      state.products.push(mapProduct(product));
      state.modal = {type:'pricelist'}; render();
    }catch(e){ errEl.innerHTML = `<div class="notice err">${escapeHtml(e.message)}</div>`; b.disabled=false; b.textContent='Add product'; }
  };
  row.appendChild(b); modal.appendChild(row);
}

function renderSuppliersModal(modal){
  const head=document.createElement('div'); head.className='modal-head'; head.innerHTML='<h2 style="font-size:16px;">Suppliers directory</h2>'; head.appendChild(closeBtn()); modal.appendChild(head);
  const scroll = document.createElement('div'); scroll.style.cssText='overflow-x:auto;';
  const table = document.createElement('table'); table.className='simple'; table.style.minWidth='560px';
  table.innerHTML = `<thead><tr><th>Supplier</th><th>Contact</th><th>Phone</th><th>Check payable to</th><th>Usually orders</th></tr></thead>` +
    '<tbody>' + SUPPLIERS.map(s=>`<tr><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.contact||'—')}</td><td>${escapeHtml(s.phone||'—')}</td><td>${escapeHtml(s.payTo)}</td><td>${escapeHtml(s.items)}</td></tr>`).join('') + '</tbody>';
  scroll.appendChild(table);
  modal.appendChild(scroll);
}

// ============ REPOSITORY ============
function renderRepository(el){
  const search = document.createElement('div');
  search.style.marginBottom = '16px';
  search.innerHTML = `<input id="repo-search" placeholder="Search by request ID, title, or payee" style="width:100%;background:var(--bg-2);border:1px solid var(--line);border-radius:7px;color:var(--ink-0);padding:10px 12px;font-size:13.5px;">`;
  el.appendChild(search);
  search.querySelector('#repo-search').value = state.search;
  search.querySelector('#repo-search').oninput = (e)=>{ state.search = e.target.value; renderRepoGrid(); };
  const grid = document.createElement('div'); grid.className='repo-grid'; grid.id='repo-grid';
  el.appendChild(grid);
  renderRepoGrid();
}

function renderRepoGrid(){
  const grid = document.getElementById('repo-grid'); if(!grid) return;
  grid.innerHTML = '';
  const q = state.search.toLowerCase();
  const filtered = activeRequests().filter(r=> !q || r.id.toLowerCase().includes(q) || r.title.toLowerCase().includes(q) || r.payee.toLowerCase().includes(q));
  if(filtered.length===0){ grid.innerHTML='<div class="empty">No requests match that search.</div>'; return; }
  filtered.forEach(r=>{
    const totalFiles = (r.attachments||[]).length;
    const c=document.createElement('div'); c.className='repo-card';
    c.innerHTML = `
      <span class="badge ${r.type==='PO'?'po':'pc'}">${r.type==='PO'?'PO':'Petty cash'}</span>
      <div class="req-title" style="font-size:13.5px;margin-top:6px;">${escapeHtml(r.title)}</div>
      <div class="req-sub">${escapeHtml(r.payee)} &middot; ${fmtMoney(r.amount)}</div>
      <div class="hint" style="margin-top:8px;">${totalFiles} file${totalFiles===1?'':'s'} attached</div>
    `;
    const btn=document.createElement('button'); btn.className='btn ghost'; btn.style.cssText='padding:6px 0;margin-top:6px;'; btn.textContent='Open request →';
    btn.onclick=()=>{ state.modal={type:'detail', id:r.id}; render(); };
    c.appendChild(btn); grid.appendChild(c);
  });
}

// ============ MODAL ROUTER ============
function renderModal(){
  const root = document.getElementById('modalRoot');
  root.innerHTML = '';
  if(!state.modal) return;
  const overlay = document.createElement('div'); overlay.className='overlay';
  overlay.onclick = (e)=>{ if(e.target===overlay){ state.modal=null; render(); } };
  const modal = document.createElement('div'); modal.className='modal';
  overlay.appendChild(modal); root.appendChild(overlay);

  if(state.modal.type==='detail') return renderDetailModal(modal);
  if(state.modal.type==='reject') return renderRejectModal(modal);
  if(state.modal.type==='check') return renderCheckModal(modal);
  if(state.modal.type==='delivery') return renderDeliveryModal(modal);
  if(state.modal.type==='pos') return renderPosModal(modal);
  if(state.modal.type==='variance') return renderVarianceModal(modal);
  if(state.modal.type==='newRequest') return renderNewRequestModal(modal, state.modal.reqType);
  if(state.modal.type==='suppliers') return renderSuppliersModal(modal);
  if(state.modal.type==='pricelist') return renderPricelistModal(modal);
  if(state.modal.type==='staff') return renderStaffModal(modal);
  if(state.modal.type==='resetPassword') return renderResetPasswordModal(modal);
  if(state.modal.type==='changePassword') return renderChangePasswordModal(modal);
  if(state.modal.type==='unfinishedPrompt') return renderUnfinishedPromptModal(modal);
  if(state.modal.type==='addChecklistTask') return renderAddChecklistTaskModal(modal);
  if(state.modal.type==='newTask') return renderNewTaskModal(modal);
  if(state.modal.type==='editTask') return renderEditTaskModal(modal);
  if(state.modal.type==='newSale') return renderNewSaleModal(modal);
  if(state.modal.type==='newMember') return renderNewMemberModal(modal);
  if(state.modal.type==='renewMember') return renderRenewMemberModal(modal);
}

loadAll();
