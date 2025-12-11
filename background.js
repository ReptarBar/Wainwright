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
let runHistory = [];

async function getBrowserInfoSafe(){
  try {
    return await (browser.runtime.getBrowserInfo ? browser.runtime.getBrowserInfo() : Promise.resolve({name:"Thunderbird", version:"unknown"}));
  } catch(e){
    return {name:"Thunderbird", version:"unknown"};
  }
}

async function getPlatformSafe(){
  try {
    return await (browser.runtime.getPlatformInfo ? browser.runtime.getPlatformInfo() : Promise.resolve({os:"unknown", arch:"unknown"}));
  } catch(e){
    return {os:"unknown", arch:"unknown"};
  }
}

async function listAccountsSafe(){
  try {
    return await (browser.accounts && browser.accounts.list ? browser.accounts.list(true) : Promise.resolve([]));
  } catch(e){
    return [];
  }
}

browser.runtime.onMessage.addListener(async (msg, sender) => {
  if (!msg || !msg.cmd) return;
  if (msg.cmd === "compactSequential") {
    try {
      if (browser.experiments && browser.experiments.waynewright) {
        const res = await browser.experiments.waynewright.compactAllFolders({ maxRuntimeSeconds: 150 });
        runHistory.push({ t: Date.now(), event: "compactRun", count: res?.compacted });
        return true;
      }
    } catch (e) {
      runHistory.push({ t: Date.now(), event: "compactError" });
      return false;
    }
    runHistory.push({ t: Date.now(), event: "compactAttemptNoAPI" });
    return false;
  }
  if (msg.cmd === "logAddonsChecked") { runHistory.push({t:Date.now(), event:"addonsChecked", count: msg.count}); return true; }
  if (msg.cmd === "resetFolderPane") {
    try {
      const ok = browser.experiments && browser.experiments.waynewright && await browser.experiments.waynewright.resetFolderPane();
      runHistory.push({ t: Date.now(), event: "resetFolderPane", count: ok ? 1 : 0 });
      return !!ok;
    } catch (e) {
      runHistory.push({ t: Date.now(), event: "resetFolderPaneError" });
      return false;
    }
  }
  if (msg.cmd === "refreshAddressBooks") {
    try {
      const res = browser.experiments && browser.experiments.waynewright && await browser.experiments.waynewright.refreshAddressBooks();
      runHistory.push({ t: Date.now(), event: "refreshAddress", count: res?.refreshed });
      return !!res;
    } catch (e) {
      runHistory.push({ t: Date.now(), event: "refreshAddressError" });
      return false;
    }
  }
  if (msg.cmd === "repairFolderIndexes") {
    try {
      const res = browser.experiments && browser.experiments.waynewright && await browser.experiments.waynewright.repairFolderIndexes();
      runHistory.push({ t: Date.now(), event: "repairIndexes", count: res?.repaired });
      return !!res;
    } catch (e) {
      runHistory.push({ t: Date.now(), event: "repairIndexesError" });
      return false;
    }
  }
  if (msg.cmd === "rebuildGlobalSearch") {
    try {
      const ok = browser.experiments && browser.experiments.waynewright && await browser.experiments.waynewright.rebuildGlobalSearch();
      runHistory.push({ t: Date.now(), event: "rebuildSearch", count: ok ? 1 : 0 });
      return !!ok;
    } catch (e) {
      runHistory.push({ t: Date.now(), event: "rebuildSearchError" });
      return false;
    }
  }
  if (msg.cmd === "makeDiagnosticsText") {
    const browserInfo = await getBrowserInfoSafe();
    const platform = await getPlatformSafe();
    const addons = await (browser.management ? browser.management.getAll() : Promise.resolve([]));
    const accounts = await listAccountsSafe();
    const manifest = browser.runtime.getManifest ? browser.runtime.getManifest() : {};
    const selections = Array.isArray(msg.selections) ? msg.selections : [];
    const lines = [];
    lines.push("WayneWright Diagnostics");
    lines.push("--------------------");
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`App: ${browserInfo.name} ${browserInfo.version}`);
    lines.push(`Platform: ${platform.os} ${platform.arch}`);
    lines.push(`Extension: ${manifest.name || "WayneWright"} ${manifest.version || ""}`);
    lines.push("");
    lines.push("Routines selected this run:");
    if (selections.length) {
      selections.forEach(s => lines.push(`- ${s}`));
    } else {
      lines.push("- (not provided)");
    }
    lines.push("");
    lines.push("Add-ons:");
    addons.forEach(a => lines.push(`- ${a.name} ${a.version} [${a.enabled ? "enabled":"disabled"}]`));
    lines.push("");
    if (accounts.length) {
      lines.push("Accounts and folders:");
      for (const acc of accounts) {
        lines.push(`- Account: ${acc.name || acc.id}`);
        const stack = [...(acc.folders || [])];
        while (stack.length) {
          const f = stack.shift();
          const indent = "  ".repeat((f.path || "").split("/").length);
          const total = (typeof f.totalMessageCount === "number") ? f.totalMessageCount : "?";
          const unread = (typeof f.unreadMessageCount === "number") ? f.unreadMessageCount : "?";
          lines.push(`${indent}- ${f.name || f.path || "Folder"}: ${total} messages, ${unread} unread`);
          if (f.subFolders && f.subFolders.length) stack.push(...f.subFolders);
        }
      }
      lines.push("");
    }
    lines.push("Recent WayneWright events:");
    runHistory.slice(-50).forEach(ev => lines.push(`- ${new Date(ev.t).toISOString()} ${ev.event} ${ev.count || ""}`));
    return lines.join("\n");
  }
});
