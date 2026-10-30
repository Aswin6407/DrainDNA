let drains = [];
let selectedId = null, uploadedByDrain = {};
const $ = id => document.getElementById(id);

function statusFor(n) {
  return n >= 75 ? 'High' : n >= 60 ? 'Watch' : 'Normal';
}

function showToast(msg) {
  const toast = $('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

function filtered() {
  const site = $('site').value;
  const term = $('search').value.toLowerCase();
  const st = $('statusFilter').value;
  return drains.filter(d => 
    (site === 'All sites' || d.site === site) &&
    (st === 'All' || d.status === st) &&
    (`${d.id} ${d.site} ${d.area}`).toLowerCase().includes(term)
  );
}

function render() {
  const list = filtered();
  
  if (list.length > 0) {
    $('drainRows').innerHTML = list.map(d => `
      <tr class="${d.id === selectedId ? 'selected' : ''}" onclick="selectDrain('${d.id}')">
        <td><strong>${d.id}</strong><span class="sub">${d.area}</span></td>
        <td>${d.site}</td>
        <td><strong>${d.level}%</strong></td>
        <td><span class="status ${d.status ? d.status.toLowerCase() : 'normal'}">${d.status || 'Normal'}</span></td>
        <td>${d.date || 'Recorded'}</td>
      </tr>
    `).join('');
  } else {
    $('drainRows').innerHTML = '<tr><td colspan="5" style="text-align:center;padding:25px">No drains match these filters.</td></tr>';
  }

  $('countChip').textContent = list.length + ' DRAINS';
  $('totalKpi').textContent = list.length;
  $('highKpi').textContent = list.filter(d => d.status === 'High').length;
  $('watchKpi').textContent = list.filter(d => d.status === 'Watch').length;
  $('imageKpi').textContent = list.reduce((a, d) => a + (d.images || 0), 0);

  $('chart').innerHTML = list.slice(0, 10).map(d => `
    <div class="chart-col">
      <div class="chart-bar" title="${d.id}: ${d.level}%" style="height:${d.level}%"></div>
      <span>${d.id.split('-').slice(1).join('')}</span>
    </div>
  `).join('');

  renderDetail();
}

function selectDrain(id) {
  selectedId = id;
  render();
  loadInspectionsForDrain(id);
  const detailSec = $('selected-drain');
  if (detailSec) {
    detailSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function renderDetail() {
  const d = drains.find(x => x.id === selectedId) || drains[0];
  if (!d) {
    $('detailId').textContent = '—';
    $('detailMeta').textContent = 'No drain selected';
    $('detailLevel').textContent = '0';
    $('levelFill').style.width = '0%';
    $('detailStatus').textContent = 'NONE';
    $('detailStatus').className = 'status normal';
    $('detailDate').textContent = '—';
    $('detailImages').textContent = '0 attached';
    $('detailAsset').textContent = 'Pending';
    $('history').innerHTML = '<div class="history-row"><span>No inspection records</span><span>none</span></div>';
    return;
  }

  selectedId = d.id;
  $('detailId').textContent = d.id;
  $('detailMeta').textContent = `${d.site} · ${d.area} · Chennai`;
  $('detailLevel').textContent = d.level;
  $('levelFill').style.width = d.level + '%';
  $('detailStatus').textContent = (d.status || 'Normal').toUpperCase();
  $('detailStatus').className = 'status ' + (d.status ? d.status.toLowerCase() : 'normal');
  $('detailDate').textContent = d.date || 'Recorded';
  $('detailImages').textContent = (d.images || 0) + ' attached';
  $('detailAsset').textContent = 'Registered';
}

// Fetch and render persistent inspection history from MongoDB for a selected drain
async function loadInspectionsForDrain(drainId) {
  if (!drainId) return;
  const historyEl = $('history');
  historyEl.innerHTML = '<div class="history-row"><span>Loading inspection records...</span><span>MongoDB</span></div>';

  try {
    const res = await fetch(`/api/drains/${encodeURIComponent(drainId)}/inspections`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    const list = Array.isArray(data.inspections) ? data.inspections : [];

    if (list.length === 0) {
      historyEl.innerHTML = '<div class="history-row"><span>No prior inspection records for this drain</span><span>NONE</span></div>';
      return;
    }

    historyEl.innerHTML = list.map(ins => {
      const imgCount = Array.isArray(ins.images) ? ins.images.length : 0;
      const firstImg = imgCount > 0 ? ins.images[0] : null;

      return `
        <div class="history-row" style="flex-direction:column;align-items:flex-start;gap:5px;padding:9px 0;border-bottom:1px solid #edf0eb;">
          <div style="display:flex;justify-content:space-between;width:100%;align-items:center;">
            <span><strong style="color:var(--ink);">${ins.inspectionId || 'INS'}</strong> · <span class="status ${(ins.status || 'normal').toLowerCase()}">${ins.status || 'Normal'} (${ins.level}%)</span></span>
            <span style="font-family:'DM Mono';color:#75877a;font-size:9px;">${ins.dateDisplay || 'Recorded'}</span>
          </div>
          <div style="font-size:9px;color:#53645a;line-height:1.5;">
            <span><b>Inspector:</b> ${ins.inspector || 'Admin Officer'}</span><br>
            <span><b>DD-C01:</b> ${ins.cartridgeDD_C01 || 'Normal'}</span><br>
            <span><b>DD-C02:</b> ${ins.cartridgeDD_C02 || 'Normal'}</span>
            ${ins.notes ? `<br><span><b>Notes:</b> ${ins.notes}</span>` : ''}
            ${imgCount > 0 ? `
              <div style="margin-top:4px;display:flex;gap:7px;align-items:center;">
                <span class="chip" style="font-size:8px;padding:3px 6px;">📷 ${imgCount} Photo(s)</span>
                ${firstImg && firstImg.url ? `<a href="${firstImg.url}" target="_blank" style="font-size:9px;color:#2e6b3f;text-decoration:underline;">View Evidence</a>` : `<span style="font-size:8px;color:#778877;">${firstImg.originalName || 'Image linked'}</span>`}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error fetching inspection history:', error);
    historyEl.innerHTML = '<div class="history-row"><span>Inspection history offline</span><span>sample</span></div>';
  }
}

// Fetch drains from MongoDB backend
async function fetchDrains() {
  try {
    const res = await fetch('/api/drains');
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    drains = Array.isArray(data) ? data : [];
    if (drains.length > 0 && (!selectedId || !drains.some(d => d.id === selectedId))) {
      selectedId = drains[0].id;
    }
    render();
    if (selectedId) {
      loadInspectionsForDrain(selectedId);
    }
  } catch (error) {
    console.error('Error fetching drains from database:', error);
    showToast('Failed to load registered drains from database.');
    render();
  }
}

['site', 'statusFilter', 'search'].forEach(id => {
  const el = $(id);
  if (el) el.addEventListener('input', render);
});

function openModal() {
  $('modal').classList.add('show');
}

function closeModal() {
  $('modal').classList.remove('show');
}

// Save drain to MongoDB backend
async function saveDrain() {
  const idInput = $('newId').value.trim().toUpperCase();
  const site = $('newSite').value;
  const area = $('newArea').value.trim();
  const levelRaw = $('newLevel').value;
  const level = Number(levelRaw);

  // Frontend validation
  if (!area) {
    showToast('Please enter an area or street label.');
    return;
  }
  if (!Number.isFinite(level) || level < 0 || level > 100) {
    showToast('Please enter a recorded level between 0 and 100.');
    return;
  }
  if (idInput && !/^[A-Z0-9-]{3,20}$/.test(idInput)) {
    showToast('Drain ID must be 3-20 characters (letters, numbers, hyphens).');
    return;
  }

  const payload = { site, area, level };
  if (idInput) {
    payload.id = idInput;
  }

  const saveBtn = document.querySelector('#modal .modal-actions button.btn:last-child');
  try {
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    }

    const res = await fetch('/api/drains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (!res.ok) {
      showToast(result.error || 'Failed to register drain.');
      return;
    }

    // Add newly registered drain from database response
    drains.unshift(result);
    selectedId = result.id;
    closeModal();

    // Reset inputs
    $('newId').value = '';
    $('newArea').value = '';
    $('newLevel').value = '30';
    $('site').value = 'All sites';
    $('statusFilter').value = 'All';
    $('search').value = '';

    render();
    loadInspectionsForDrain(selectedId);
    showToast(`Drain ${result.id} registered successfully in MongoDB.`);
  } catch (error) {
    console.error('Network error registering drain:', error);
    showToast('Network error while registering drain.');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save sample drain';
    }
  }
}

function openReading() {
  const d = drains.find(x => x.id === selectedId);
  if (d) {
    $('readingLevel').value = d.level;
  }
  $('readingModal').classList.add('show');
}

// Save persistent inspection record to MongoDB backend
async function saveReading() {
  const v = Number($('readingLevel').value);
  const inspector = $('readingInspector') ? $('readingInspector').value.trim() : 'Admin Officer (AO)';
  const cartridgeDD_C01 = $('readingC01') ? $('readingC01').value : 'Sediment & debris retention: Normal';
  const cartridgeDD_C02 = $('readingC02') ? $('readingC02').value : 'Hydraulic exposure indicator: Normal flow';
  const note = $('readingNote').value.trim();

  if (!Number.isFinite(v) || v < 0 || v > 100) {
    showToast('Enter a level between 0 and 100.');
    return;
  }

  const d = drains.find(x => x.id === selectedId);
  if (!d) return;

  const saveBtn = document.querySelector('#readingModal .modal-actions button.btn:last-child');
  try {
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Recording...';
    }

    const res = await fetch('/api/inspections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        drainId: selectedId,
        level: v,
        inspector,
        cartridgeDD_C01,
        cartridgeDD_C02,
        notes: note
      })
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Failed to record inspection.');
      return;
    }

    // Update parent drain record in memory
    d.level = data.updatedDrain.level;
    d.status = data.updatedDrain.status;
    d.date = data.updatedDrain.date;
    d.images = data.updatedDrain.images;

    $('readingModal').classList.remove('show');
    $('readingNote').value = '';
    render();
    loadInspectionsForDrain(selectedId);
    showToast(`Inspection ${data.inspection.inspectionId} saved to MongoDB.`);
  } catch (error) {
    console.error('Inspection save error:', error);
    showToast('Network error while saving inspection.');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save inspection';
    }
  }
}

// Attach persistent evidence image via POST /api/inspections
$('imageInput').addEventListener('change', async e => {
  const f = e.target.files[0];
  if (!f) return;

  const d = drains.find(x => x.id === selectedId);
  if (!d) {
    showToast('Select a drain before uploading evidence.');
    return;
  }

  // Local immediate preview
  const img = $('imagePreview');
  img.src = URL.createObjectURL(f);
  img.style.display = 'block';
  $('imageName').textContent = `Uploading ${f.name} for ${selectedId}...`;

  const formData = new FormData();
  formData.append('drainId', selectedId);
  formData.append('level', d.level);
  formData.append('inspector', 'Field Inspection Officer');
  formData.append('notes', `Evidence image attached: ${f.name}`);
  formData.append('evidenceImages', f);

  try {
    const res = await fetch('/api/inspections', {
      method: 'POST',
      body: formData
    });

    const result = await res.json();
    if (!res.ok) {
      showToast(result.error || 'Failed to upload evidence image.');
      $('imageName').textContent = 'Upload failed: ' + (result.error || 'Server error');
      return;
    }

    // Set preview to persistent server URL
    if (result.inspection.images && result.inspection.images.length > 0) {
      const serverUrl = result.inspection.images[0].url;
      if (serverUrl) {
        img.src = serverUrl;
      }
    }

    d.images = result.updatedDrain.images;
    $('imageName').textContent = `Persistent evidence attached to ${selectedId}: ${f.name}`;
    renderDetail();
    loadInspectionsForDrain(selectedId);
    showToast('Evidence photo saved to server & linked in MongoDB.');
  } catch (err) {
    console.error('Evidence upload error:', err);
    $('imageName').textContent = `Local preview only (Upload offline): ${f.name}`;
    showToast('Network error while uploading evidence.');
  }
});

function exportCSV() {
  const rows = [
    ['Drain ID', 'Site', 'Area', 'Level (%)', 'Status', 'Last observation'],
    ...filtered().map(d => [d.id, d.site, d.area, d.level, d.status, d.date])
  ];
  const csv = rows.map(r => r.map(x => '"' + String(x).replaceAll('"', '""') + '"').join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'DrainDNA_sample_drain_register.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Filtered sample register exported.');
}

function addDemoTask() {
  const drain = $('taskDrain').value.trim().toUpperCase(), action = $('taskAction').value.trim();
  if (!drain || !action) {
    showToast('Enter a drain ID and maintenance action.');
    return;
  }
  const row = document.createElement('div');
  row.className = 'task-row';
  const left = document.createElement('span');
  left.innerHTML = '<b></b><br><span class="sub"></span>';
  left.querySelector('b').textContent = drain;
  left.querySelector('.sub').textContent = action + ' · ' + $('taskPriority').value;
  const right = document.createElement('span');
  right.className = 'status watch';
  right.textContent = $('taskStatus').value;
  row.append(left, right);
  $('taskList').prepend(row);
  $('taskDrain').value = '';
  $('taskAction').value = '';
  showToast('sample maintenance task added to this session.');
}

function submitPublicReport() {
  const location = $('publicLocation').value.trim(), description = $('publicDescription').value.trim();
  if (!location || !description) {
    showToast('Enter a location and issue description.');
    return;
  }
  const ref = 'DD-REP-' + Math.floor(10000 + Math.random() * 90000);
  $('reportResult').textContent = 'sample report reference: ' + ref + ' · ' + $('publicCategory').value + ' · ' + location + '. This report has not been sent to an authority.';
  $('publicLocation').value = '';
  $('publicDescription').value = '';
  showToast('sample report reference generated.');
}

// Smooth sidebar navigation with an eased glide and active-section tracking
document.querySelectorAll('.side-link[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start'
    });
    history.replaceState(null, '', link.getAttribute('href'));
    document.querySelectorAll('.side-link').forEach(a => a.classList.remove('active'));
    link.classList.add('active');
  });
});

const revealTargets = document.querySelectorAll('main > .pagehead, main > .filters, main > .kpis, main > .content-grid, main > .detail-panel, main > .module-grid');
revealTargets.forEach(el => el.classList.add('reveal-ready'));

if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: .08, rootMargin: '0px 0px -35px 0px' });
  revealTargets.forEach(el => revealObserver.observe(el));
} else {
  revealTargets.forEach(el => el.classList.add('revealed'));
}

const sectionLinks = [...document.querySelectorAll('.side-link[href^="#"]')];
const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const active = sectionLinks.find(a => a.getAttribute('href') === '#' + entry.target.id);
      if (active) {
        sectionLinks.forEach(a => a.classList.remove('active'));
        active.classList.add('active');
      }
    }
  });
}, { rootMargin: '-18% 0px -68% 0px', threshold: 0 });

sectionLinks.forEach(a => {
  const section = document.querySelector(a.getAttribute('href'));
  if (section) sectionObserver.observe(section);
});

// Load registered drains and inspections on initial load
fetchDrains();
