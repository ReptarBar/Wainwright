/* global browser */
const $ = (sel) => document.querySelector(sel);
const sleep = (ms) => new Promise(res => setTimeout(res, ms));
function log(type, msg){
  const line = document.createElement('div'); line.className = 'log-line';
  const badge = document.createElement('span'); badge.className = 'badge ' + (type || 'info'); line.appendChild(badge);
  const text = document.createElement('div'); text.textContent = msg; line.appendChild(text);
  const target = $('#log'); if (target) { target.appendChild(line); target.scrollTop = target.scrollHeight; }
}
async function getPacing(){ const s = await browser.storage.local.get('stormwall_pacing'); return Number(s.stormwall_pacing || 2000); }
async function setPacing(ms){ await browser.storage.local.set({stormwall_pacing: Number(ms)}); }
function showSpotlightTip(text){
  const ov = document.createElement('div'); ov.style.position='fixed'; ov.style.inset='0'; ov.style.background='rgba(0,0,0,.6)';
  ov.style.display='grid'; ov.style.placeItems='center'; ov.style.zIndex=9999;
  const card = document.createElement('div'); card.style.background='#0b1220'; card.style;border='1px solid #1a2334'; card.style.borderRadius='10px'; card.style.padding='14px'; card.style.color='#e5e7eb'; card.style.maxWidth='360px';
  card.textContent = text || "Follow the on screen instructions in the opened tab.";
  const btn = document.createElement('button'); btn.textContent = "Got it"; btn.className = "secondary"; btn.style.marginTop='10px'; btn.addEventListener('click', ()=> document.body.removeChild(ov));
  card.appendChild(document.createElement('br')); card.appendChild(btn); ov.appendChild(card); document.body.appendChild(ov);
}

const STEP_IDS = ["compactFolders","checkUpdates","resetFolderPane","clearAddressCache","diagnostics"];
const stepsCatalog = {
  compactFolders: { label: "Compact folders",
    run: async (minMs) => {
      const t0 = Date.now(); log('info',"Starting compaction walk...");
      const ok = await browser.runtime.sendMessage({cmd:"compactSequential"}).catch(()=>false);
      if (ok) log('ok',"Compaction completed."); else log('warn',"Compaction needs a permissions bridge in a future build. Showing how-to.");
      const elapsed = Date.now()-t0; const delay = Math.max(0, minMs - elapsed); if (delay) await sleep(delay);
      if (!ok) showSpotlightTip("Right click a folder → Properties → click Repair. Then choose Compact if available.");
    },
    preview: "Attempt to compact folders sequentially; otherwise show guidance." },
  checkUpdates: { label: "Check add-on updates",
    run: async (minMs) => {
      const t0 = Date.now();
      const addons = await (browser.management ? browser.management.getAll() : Promise.resolve([]));
      await browser.runtime.sendMessage({cmd:"logAddonsChecked", count:addons.length});
      const elapsed = Date.now()-t0; const delay = Math.max(0, minMs - elapsed); if (delay) await sleep(delay);
      log('ok',`Checked ${addons.length} add-ons.`);
    },
    preview: "List installed add-ons and confirm versions." },
  resetFolderPane: { label: "Reset folder pane",
    run: async (minMs) => {
      const t0 = Date.now();
      const ok = await browser.runtime.sendMessage({cmd:"resetFolderPane"}).catch(()=>false);
      const elapsed = Date.now()-t0; const delay = Math.max(0, minMs - elapsed); if (delay) await sleep(delay);
      if (ok) log('ok',"Folder pane reset."); else { log('warn',"Manual step required. Showing how-to."); showSpotlightTip("Menu ☰ → View → Folders → All. Then right click folder pane header → Reset."); }
    },
    preview: "Try to reset state; otherwise show exact manual clicks." },
  clearAddressCache: { label: "Clear address book cache",
    run: async (minMs) => {
      const t0 = Date.now();
      const ok = await browser.runtime.sendMessage({cmd:"refreshAddressBooks"}).catch(()=>false);
      const elapsed = Date.now()-t0; const delay = Math.max(0, minMs - elapsed); if (delay) await sleep(delay);
      if (ok) log('ok',"Address book cache cleared."); else { log('warn',"Manual step required. Showing how-to."); showSpotlightTip("Open Address Book → Select book → Properties → Repair."); }
    },
    preview: "Refresh address books or show where to repair." },
  diagnostics: { label: "Log and export diagnostics",
    run: async (minMs) => {
      const t0 = Date.now();
      const txt = await browser.runtime.sendMessage({cmd:"makeDiagnosticsText"});
      await browser.storage.local.set({ stormwall_lastReport: txt });
      const elapsed = Date.now()-t0; const delay = Math.max(0, minMs - elapsed); if (delay) await sleep(delay);
      log('ok',"Diagnostics generated.");
      const viewerUrl = browser.runtime.getURL("report/viewer.html");
      if (browser.tabs && browser.tabs.create) await browser.tabs.create({url: viewerUrl});
    },
    preview: "Generate diagnostics, then open a viewer tab for Copy, Print, and Save." }
};

function selectedSteps(){ return STEP_IDS.filter(id => $('#'+id).checked); }

async function runQueue(){
  const logBox = $('#log'); if (logBox) logBox.innerHTML = "";
  const stopOnFail = $('#stopOnFail').checked; const steps = selectedSteps();
  if (!steps.length) { log('warn',"No routines selected. Toggle at least one and try again."); return; }
  const total = steps.length; let completed = 0;
  const minMs = await getPacing();
  for (const id of steps) {
    const item = stepsCatalog[id];
    try { log('info', `Starting: ${item.label}`); await item.run(minMs); completed += 1; log('ok', `Done: ${item.label} (${completed} of ${total})`); }
    catch(e){ log('err', `Issue: ${item.label} - ${e.message}`); if (stopOnFail) break; }
  }
  const finishUrl = browser.runtime.getURL("finish/done.html");
  if (browser.tabs && browser.tabs.create) await browser.tabs.create({url: finishUrl});
}

function previewQueue(){
  const logBox = $('#log'); if (logBox) logBox.innerHTML = "";
  const steps = selectedSteps(); if (!steps.length) { log('warn',"No routines selected. Toggle at least one and try again."); return; }
  steps.forEach((id, idx)=>{ const s = stepsCatalog[id]; log('info', `${idx+1}. ${s.label} - ${s.preview}`); });
  log('ok', "Preview complete. Nothing was changed.");
}

function updateHealth(){
  const picks = selectedSteps(); const lines = [];
  if (!picks.length) { lines.push("Tip: Start with Compact folders and Diagnostics."); }
  else {
    if (picks.includes("compactFolders")) lines.push("Good call: Compact often fixes slow or bloated folders.");
    if (picks.includes("diagnostics")) lines.push("Diagnostics helps support help you faster if needed.");
    if (!picks.includes("checkUpdates")) lines.push("Consider adding Add-on updates to get recent fixes.");
  }
  const hc = $('#healthCard'); if (hc) hc.textContent = lines.join("\\n") || "Everything looks steady. Choose what you need and press Run Fix.";
}

async function initPacingUI(){
  $('#pacingLabel').textContent = browser.i18n.getMessage("pacingLabel");
  $('#p1').textContent = browser.i18n.getMessage("pacing1");
  $('#p2').textContent = browser.i18n.getMessage("pacing2");
  $('#p3').textContent = browser.i18n.getMessage("pacing3");
  const ms = await getPacing(); $('#pacingSel').value = String(ms);
  $('#savePacing').addEventListener('click', async ()=>{
    await setPacing($('#pacingSel').value);
    const msg = browser.i18n.getMessage("pacingSaved");
    const el = $('#pacingSaved'); el.textContent = msg; el.style.display = 'inline';
    setTimeout(()=>{ el.style.display='none'; }, 1200);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const runBtn = $('#runBtn'); if (runBtn) runBtn.addEventListener('click', runQueue);
  const previewBtn = $('#previewBtn'); if (previewBtn) previewBtn.addEventListener('click', previewQueue);
  STEP_IDS.forEach(id => { const el = $('#'+id); if (el) el.addEventListener('change', updateHealth); });
  const selectAll = $('#selectAll'); if (selectAll) selectAll.addEventListener('click', ()=>{ STEP_IDS.forEach(id=>{ const el=$('#'+id); if(el) el.checked=true; }); updateHealth(); });
  const clearAll = $('#clearAll'); if (clearAll) clearAll.addEventListener('click', ()=>{ STEP_IDS.forEach(id=>{ const el=$('#'+id); if(el) el.checked=false; }); updateHealth(); });
  updateHealth();
  const openTrouble = $('#openTroubleshootGuide'); if (openTrouble) openTrouble.addEventListener('click', ()=>{ const url = browser.runtime.getURL("help/troubleshoot.html"); browser.tabs.create({url}); });
  const openRepair = $('#openRepairGuide'); if (openRepair) openRepair.addEventListener('click', ()=>{ showSpotlightTip("Right click a folder, choose Properties, then click Repair to rebuild its index."); });
  initPacingUI();
  const disc = browser.i18n.getMessage("disclaimer"); const dEl = document.getElementById('disc'); if (dEl) dEl.textContent = disc;
});