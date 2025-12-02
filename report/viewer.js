/*
 * WayneWright is an auto-fix tool for common Thunderbird issues.
 * It helps users quickly resolve problems without digging into configs.
 *
 * Copyright (C) 2025  Michael H. Ellis, Commit Confidential
 * Contact: https://github.com/ReptarBar/
 *          ReptarBar [at] commitconfidential [dot] com
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/* global browser */
async function loadReport(){
  try{
    const data = await browser.storage.local.get({ waynewright_lastReport: null, stormwall_lastReport: null });
    const txt = data.waynewright_lastReport || data.stormwall_lastReport || "No report found. Run Diagnostics from WayneWright.";
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
  await browser.downloads.download({ url, filename: `waynewright-report-${new Date().toISOString().slice(0,10)}.txt`, saveAs: true });
}
document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('copyBtn').addEventListener('click', copyReport);
  document.getElementById('printBtn').addEventListener('click', printReport);
  document.getElementById('saveBtn').addEventListener('click', saveReport);
  loadReport();
});