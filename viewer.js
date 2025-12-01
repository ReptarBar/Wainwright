/* global browser */
async function loadReport(){
  try{
    const data = await browser.storage.local.get("stormwall_lastReport");
    const txt = data.stormwall_lastReport || "No report found. Run Diagnostics from StormWall.";
    document.getElementById('content').textContent = txt;
    const disc = browser.i18n.getMessage("disclaimer");
    const el = document.getElementById('disc'); if (el) el.textContent = disc || "";
  }catch(e){
    document.getElementById('content').textContent = "Unable to load report: " + e.message;
  }
}
async function copyReport(){
  const txt = document.getElementById('content').textContent;
  try { await navigator.clipboard.writeText(txt); } catch(e) { /* ignore */ }
}
function printReport(){ window.print(); }
async function saveReport(){
  const txt = document.getElementById('content').textContent;
  const blob = new Blob([txt], {type:"text/plain"});
  const url = URL.createObjectURL(blob);
  await browser.downloads.download({ url, filename: `stormwall-report-${new Date().toISOString().slice(0,10)}.txt`, saveAs: true });
}
document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('copyBtn').addEventListener('click', copyReport);
  document.getElementById('printBtn').addEventListener('click', printReport);
  document.getElementById('saveBtn').addEventListener('click', saveReport);
  loadReport();
});