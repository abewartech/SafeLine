/* ============================================================
   DNS Manager — App Logic
   ============================================================ */

// ── State ────────────────────────────────────────────────────
let records = [];
let editingId = null;
let settings = { defaultDomain: '', defaultTTL: 3600, autoSave: true };

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  loadSettings();
  renderAll();
  // seed demo data when empty
  if (records.length === 0) seedDemoData();
});

// ── Seed Demo Data ───────────────────────────────────────────
function seedDemoData() {
  const demos = [
    { type: 'A',     name: '@',          value: '203.0.113.10',       ttl: 3600,  priority: null },
    { type: 'A',     name: 'www',        value: '203.0.113.10',       ttl: 3600,  priority: null },
    { type: 'CNAME', name: 'mail',       value: 'ghs.googlehosted.com', ttl: 900, priority: null },
    { type: 'MX',    name: '@',          value: 'mail.example.com',   ttl: 3600,  priority: 10 },
    { type: 'MX',    name: '@',          value: 'mail2.example.com',  ttl: 3600,  priority: 20 },
  ];
  demos.forEach(d => {
    records.push({ ...d, id: uid(), createdAt: new Date().toISOString() });
  });
  saveToStorage();
  renderAll();
  logActivity('add', 'A', '@', 'Demo data loaded');
}

// ── Navigation ───────────────────────────────────────────────
const sectionMeta = {
  'dashboard':     { title: 'Dashboard',     crumb: 'Home / Dashboard' },
  'records':       { title: 'DNS Records',   crumb: 'Home / DNS Records' },
  'a-records':     { title: 'A Records',     crumb: 'Home / A Records' },
  'cname-records': { title: 'CNAME Records', crumb: 'Home / CNAME Records' },
  'mx-records':    { title: 'MX Records',    crumb: 'Home / MX Records' },
  'settings':      { title: 'Settings',      crumb: 'Home / Settings' },
};

function navigate(section, el) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('section-' + section).classList.add('active');
  if (el) el.classList.add('active');
  const meta = sectionMeta[section] || {};
  document.getElementById('pageTitle').textContent = meta.title || section;
  document.getElementById('breadcrumb').textContent = meta.crumb || '';
}

// ── Modal ─────────────────────────────────────────────────────
function openModal(preType) {
  editingId = null;
  document.getElementById('modalTitle').textContent = 'Add DNS Record';
  document.getElementById('saveBtn').textContent = 'Save Record';
  document.getElementById('recordName').value = '';
  document.getElementById('recordValue').value = '';
  document.getElementById('recordPriority').value = '10';
  document.getElementById('recordTTL').value = '3600';
  document.getElementById('customTTL').style.display = 'none';
  if (preType) document.getElementById('recordType').value = preType;
  updateFormFields();
  document.getElementById('modalOverlay').classList.add('show');
  setTimeout(() => document.getElementById('recordName').focus(), 120);
}

function openEditModal(id) {
  const r = records.find(x => x.id === id);
  if (!r) return;
  editingId = id;
  document.getElementById('modalTitle').textContent = 'Edit DNS Record';
  document.getElementById('saveBtn').textContent = 'Update Record';
  document.getElementById('recordType').value = r.type;
  document.getElementById('recordName').value = r.name;
  document.getElementById('recordValue').value = r.value;
  document.getElementById('recordPriority').value = r.priority ?? 10;
  const std = ['300','900','3600','86400'];
  if (std.includes(String(r.ttl))) {
    document.getElementById('recordTTL').value = r.ttl;
    document.getElementById('customTTL').style.display = 'none';
  } else {
    document.getElementById('recordTTL').value = 'custom';
    document.getElementById('customTTL').style.display = 'block';
    document.getElementById('customTTL').value = r.ttl;
  }
  updateFormFields();
  document.getElementById('modalOverlay').classList.add('show');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
}

function updateFormFields() {
  const type = document.getElementById('recordType').value;
  const nameLabel = document.getElementById('nameLabel');
  const valueLabel = document.getElementById('valueLabel');
  const valueInput = document.getElementById('recordValue');
  const priorityGroup = document.getElementById('priorityGroup');

  if (type === 'A') {
    nameLabel.textContent = 'Name / Host';
    valueLabel.textContent = 'IPv4 Address';
    valueInput.placeholder = 'e.g. 203.0.113.1';
    priorityGroup.style.display = 'none';
  } else if (type === 'CNAME') {
    nameLabel.textContent = 'Host Name';
    valueLabel.textContent = 'Alias / Points to';
    valueInput.placeholder = 'e.g. ghs.googlehosted.com';
    priorityGroup.style.display = 'none';
  } else if (type === 'MX') {
    nameLabel.textContent = 'Name / Host';
    valueLabel.textContent = 'Mail Server';
    valueInput.placeholder = 'e.g. mail.example.com';
    priorityGroup.style.display = 'block';
  }
}

document.getElementById('recordTTL').addEventListener('change', function () {
  document.getElementById('customTTL').style.display = this.value === 'custom' ? 'block' : 'none';
});

// ── Save Record ───────────────────────────────────────────────
function saveRecord() {
  const type = document.getElementById('recordType').value;
  const name = document.getElementById('recordName').value.trim();
  const value = document.getElementById('recordValue').value.trim();
  const priority = type === 'MX' ? parseInt(document.getElementById('recordPriority').value) || 10 : null;
  const ttlSel = document.getElementById('recordTTL').value;
  const ttl = ttlSel === 'custom'
    ? parseInt(document.getElementById('customTTL').value) || 3600
    : parseInt(ttlSel);

  if (!name) return shake('recordName'), toast('Name is required', 'error');
  if (!value) return shake('recordValue'), toast('Value is required', 'error');
  if (type === 'A' && !isValidIP(value)) return shake('recordValue'), toast('Invalid IPv4 address', 'error');

  if (editingId) {
    const r = records.find(x => x.id === editingId);
    if (r) { Object.assign(r, { type, name, value, priority, ttl, updatedAt: new Date().toISOString() }); }
    logActivity('edit', type, name);
    toast('Record updated!', 'success');
  } else {
    records.push({ id: uid(), type, name, value, priority, ttl, createdAt: new Date().toISOString() });
    logActivity('add', type, name);
    toast('Record added!', 'success');
  }

  saveToStorage();
  renderAll();
  closeModal();
}

// ── Delete Record ─────────────────────────────────────────────
function deleteRecord(id) {
  const r = records.find(x => x.id === id);
  if (!r) return;
  if (!confirm(`Delete ${r.type} record "${r.name}"?`)) return;
  records = records.filter(x => x.id !== id);
  logActivity('delete', r.type, r.name);
  saveToStorage();
  renderAll();
  toast('Record deleted', 'info');
}

// ── Render ────────────────────────────────────────────────────
function renderAll() {
  const aRecs     = records.filter(r => r.type === 'A');
  const cnameRecs = records.filter(r => r.type === 'CNAME');
  const mxRecs    = records.filter(r => r.type === 'MX');

  // stats
  document.getElementById('stat-a').textContent     = aRecs.length;
  document.getElementById('stat-cname').textContent  = cnameRecs.length;
  document.getElementById('stat-mx').textContent     = mxRecs.length;
  document.getElementById('stat-total').textContent  = records.length;
  document.getElementById('totalBadge').textContent  = records.length;

  // tables
  renderTable('aTbody',    aRecs,     rowA);
  renderTable('cnameTbody',cnameRecs, rowCNAME);
  renderTable('mxTbody',   mxRecs,    rowMX);
  renderTable('allRecordsTbody', filterByUI(), rowAll);

  // empty states
  toggleEmpty('emptyA',     aRecs.length === 0);
  toggleEmpty('emptyCNAME', cnameRecs.length === 0);
  toggleEmpty('emptyMX',    mxRecs.length === 0);
  toggleEmpty('emptyAll',   filterByUI().length === 0);

  updateDonut(aRecs.length, cnameRecs.length, mxRecs.length);
}

function renderTable(tbodyId, data, rowFn) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = data.map(rowFn).join('');
}

function toggleEmpty(id, show) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = show ? 'block' : 'none';
}

// ── Row Templates ─────────────────────────────────────────────
function rowA(r) {
  return `<tr>
    <td><span class="mono">${esc(r.name)}</span></td>
    <td><span class="mono">${esc(r.value)}</span></td>
    <td>${r.ttl}s</td>
    <td><div class="actions">
      <button class="btn-icon" onclick="openEditModal('${r.id}')" title="Edit">&#9998;</button>
      <button class="btn-icon danger" onclick="deleteRecord('${r.id}')" title="Delete">&#128465;</button>
    </div></td>
  </tr>`;
}

function rowCNAME(r) {
  return `<tr>
    <td><span class="mono">${esc(r.name)}</span></td>
    <td><span class="mono">${esc(r.value)}</span></td>
    <td>${r.ttl}s</td>
    <td><div class="actions">
      <button class="btn-icon" onclick="openEditModal('${r.id}')" title="Edit">&#9998;</button>
      <button class="btn-icon danger" onclick="deleteRecord('${r.id}')" title="Delete">&#128465;</button>
    </div></td>
  </tr>`;
}

function rowMX(r) {
  return `<tr>
    <td><span class="mono">${esc(r.name)}</span></td>
    <td><span class="mono">${esc(r.value)}</span></td>
    <td><span class="type-badge type-mx">${r.priority ?? '—'}</span></td>
    <td>${r.ttl}s</td>
    <td><div class="actions">
      <button class="btn-icon" onclick="openEditModal('${r.id}')" title="Edit">&#9998;</button>
      <button class="btn-icon danger" onclick="deleteRecord('${r.id}')" title="Delete">&#128465;</button>
    </div></td>
  </tr>`;
}

function rowAll(r) {
  const colors = { A: 'type-a', CNAME: 'type-cname', MX: 'type-mx' };
  return `<tr>
    <td><span class="type-badge ${colors[r.type]}">${r.type}</span></td>
    <td><span class="mono">${esc(r.name)}</span></td>
    <td><span class="mono">${esc(r.value)}</span></td>
    <td>${r.ttl}s</td>
    <td>${r.priority !== null ? r.priority : '—'}</td>
    <td><div class="actions">
      <button class="btn-icon" onclick="openEditModal('${r.id}')" title="Edit">&#9998;</button>
      <button class="btn-icon danger" onclick="deleteRecord('${r.id}')" title="Delete">&#128465;</button>
    </div></td>
  </tr>`;
}

// ── Filter ────────────────────────────────────────────────────
function filterByUI() {
  const typeVal = document.getElementById('typeFilter')?.value || '';
  const searchVal = document.getElementById('globalSearch')?.value.toLowerCase() || '';
  return records.filter(r => {
    const matchType = !typeVal || r.type === typeVal;
    const matchSearch = !searchVal || r.name.toLowerCase().includes(searchVal) || r.value.toLowerCase().includes(searchVal);
    return matchType && matchSearch;
  });
}

function filterRecords() { renderAll(); }

function globalSearchRecords(val) { renderAll(); }

// ── Donut Chart ───────────────────────────────────────────────
function updateDonut(a, cname, mx) {
  const total = a + cname + mx;
  const circ = 2 * Math.PI * 45; // 283

  function computeSlice(count) {
    return total > 0 ? (count / total) * circ : 0;
  }

  let offset = 0;
  function setArc(id, count) {
    const el = document.getElementById(id);
    if (!el) return;
    const dash = computeSlice(count);
    el.setAttribute('stroke-dasharray', `${dash} ${circ}`);
    el.setAttribute('stroke-dashoffset', -offset);
    offset += dash;
  }

  // reset offsets
  offset = 0;
  setArc('donut-a', a);
  setArc('donut-cname', cname);
  setArc('donut-mx', mx);
}

// ── Activity Log ──────────────────────────────────────────────
const activities = [];

function logActivity(action, type, name, msg) {
  const icons = { add: '&#43;', edit: '&#9998;', delete: '&#128465;' };
  const colors = { A: 'var(--accent-a)', CNAME: 'var(--accent-cname)', MX: 'var(--accent-mx)' };
  const actionLabels = { add: 'Added', edit: 'Edited', delete: 'Deleted' };
  activities.unshift({
    action, type, name,
    msg: msg || `${actionLabels[action] || action} ${type} record <strong>${name}</strong>`,
    time: new Date(),
    color: colors[type] || 'var(--text-muted)',
  });
  if (activities.length > 20) activities.pop();
  renderActivity();
}

function renderActivity() {
  const list = document.getElementById('activityList');
  if (!list) return;
  if (activities.length === 0) {
    list.innerHTML = '<div class="empty-state" style="display:block">No activity yet</div>';
    return;
  }
  list.innerHTML = activities.slice(0, 8).map(a => `
    <div class="activity-item">
      <div class="activity-dot" style="background:${a.color}"></div>
      <div class="activity-content">${a.msg}</div>
      <div class="activity-time">${timeAgo(a.time)}</div>
    </div>
  `).join('');
}

// ── Settings ──────────────────────────────────────────────────
function saveSettings() {
  settings.defaultDomain = document.getElementById('defaultDomain').value.trim();
  settings.defaultTTL    = parseInt(document.getElementById('defaultTTL').value) || 3600;
  settings.autoSave      = document.getElementById('autoSave').checked;
  localStorage.setItem('dns_settings', JSON.stringify(settings));
  toast('Settings saved!', 'success');
}

function loadSettings() {
  const s = localStorage.getItem('dns_settings');
  if (s) settings = { ...settings, ...JSON.parse(s) };
  document.getElementById('defaultDomain').value = settings.defaultDomain || '';
  document.getElementById('defaultTTL').value    = settings.defaultTTL || 3600;
  document.getElementById('autoSave').checked    = settings.autoSave !== false;
}

function clearAllRecords() {
  if (!confirm('Clear ALL DNS records? This cannot be undone.')) return;
  records = [];
  activities.length = 0;
  saveToStorage();
  renderAll();
  renderActivity();
  toast('All records cleared', 'info');
}

// ── Storage ───────────────────────────────────────────────────
function saveToStorage() {
  if (settings.autoSave !== false) {
    localStorage.setItem('dns_records', JSON.stringify(records));
  }
}

function loadFromStorage() {
  const d = localStorage.getItem('dns_records');
  if (d) records = JSON.parse(d);
}

// ── Helpers ───────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function isValidIP(ip) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) && ip.split('.').every(n => +n <= 255);
}

function timeAgo(date) {
  const s = Math.floor((new Date() - new Date(date)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
}

// ── Toast ─────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const icons = { success: '✔', error: '✖', info: 'ℹ' };
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ'}</span><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(40px)';
    el.style.transition = 'all 0.3s ease';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ── Shake animation ───────────────────────────────────────────
function shake(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.animation = 'none';
  el.style.borderColor = 'var(--danger)';
  el.style.boxShadow = '0 0 0 3px rgba(248,113,113,0.2)';
  setTimeout(() => {
    el.style.borderColor = '';
    el.style.boxShadow = '';
  }, 1500);
}

// Keyboard shortcut: Escape to close modal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') saveRecord();
});
