/* global browser */
let runHistory = [];
async function getBrowserInfoSafe(){ try { return await (browser.runtime.getBrowserInfo ? browser.runtime.getBrowserInfo() : Promise.resolve({name:"Thunderbird", version:"unknown"})); } catch(e){ return {name:"Thunderbird", version:"unknown"}; } }
async function getPlatformSafe(){ try { return await (browser.runtime.getPlatformInfo ? browser.runtime.getPlatformInfo() : Promise.resolve({os:"unknown", arch:"unknown"})); } catch(e){ return {os:"unknown", arch:"unknown"}; } }
async function listAccountsSafe(){ try { return await (browser.accounts && browser.accounts.list ? browser.accounts.list(true) : Promise.resolve([])); } catch(e){ return []; } }
browser.runtime.onMessage.addListener(async (msg, sender) => {
  if (!msg || !msg.cmd) return;
  if (msg.cmd === "compactSequential") {
    const accounts = await listAccountsSafe();
    if (!accounts.length) { runHistory.push({t:Date.now(), event:"compactAttemptNoAPI"}); return true; }
    let count = 0;
    for (const acc of accounts) {
      const stack = [...(acc.folders || [])];
      while (stack.length) {
        const f = stack.shift();
        if (f && f.subFolders && f.subFolders.length) stack.push(...f.subFolders);
        count++;
      }
    }
    runHistory.push({t:Date.now(), event:"compactWalk", count});
    return true;
  }
  if (msg.cmd === "logAddonsChecked") { runHistory.push({t:Date.now(), event:"addonsChecked", count: msg.count}); return true; }
  if (msg.cmd === "resetFolderPane") { runHistory.push({t:Date.now(), event:"resetFolderPaneAttempt"}); return false; }
  if (msg.cmd === "refreshAddressBooks") { runHistory.push({t:Date.now(), event:"refreshAddressAttempt"}); return false; }
  if (msg.cmd === "makeDiagnosticsText") {
    const browserInfo = await getBrowserInfoSafe();
    const platform = await getPlatformSafe();
    const addons = await (browser.management ? browser.management.getAll() : Promise.resolve([]));
    const accounts = await listAccountsSafe();
    const lines = [];
    lines.push("StormWall Diagnostics"); lines.push("--------------------");
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`App: ${browserInfo.name} ${browserInfo.version}`);
    lines.push(`Platform: ${platform.os} ${platform.arch}`); lines.push("");
    lines.push("Add-ons:"); addons.forEach(a => lines.push(`- ${a.name} ${a.version} [${a.enabled ? "enabled":"disabled"}]`)); lines.push("");
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
    lines.push("Recent StormWall events:");
    runHistory.slice(-50).forEach(ev => lines.push(`- ${new Date(ev.t).toISOString()} ${ev.event} ${ev.count || ""}`));
    return lines.join("\\n");
  }
});