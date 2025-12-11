var { ExtensionCommon } = ChromeUtils.importESModule("resource://gre/modules/ExtensionCommon.sys.mjs");
var { Services } = ChromeUtils.importESModule("resource://gre/modules/Services.sys.mjs");
var { MailServices } = ChromeUtils.importESModule("resource:///modules/MailServices.sys.mjs");
var { GlodaIndexer } = ChromeUtils.importESModule("resource:///modules/gloda/Indexer.sys.mjs");

const { Ci, Cu } = Components;

function collectFolders() {
  const folders = [];
  for (const account of MailServices.accounts.accounts) {
    const root = account?.incomingServer?.rootFolder;
    if (!root) {
      continue;
    }
    const queue = [root];
    while (queue.length) {
      const f = queue.shift();
      folders.push(f);
      if (f.hasSubFolders) {
        const subEnum = f.subFolders;
        while (subEnum?.hasMoreElements?.()) {
          const next = subEnum.getNext().QueryInterface(Ci.nsIMsgFolder);
          queue.push(next);
        }
      }
    }
  }
  return folders;
}

function promiseFolderOperation(fn) {
  return new Promise(resolve => {
    const listener = {
      OnStartRunningUrl() {},
      OnStopRunningUrl() {
        resolve(true);
      },
    };
    try {
      fn(listener, resolve);
    } catch (e) {
      Cu.reportError(e);
      resolve(false);
    }
  });
}

async function compactAllFolders(maxRuntimeSeconds = 120) {
  const folders = collectFolders();
  let compacted = 0;
  const deadline = Date.now() + maxRuntimeSeconds * 1000;
  for (const folder of folders) {
    if (Date.now() > deadline) {
      break;
    }
    if (!folder?.canCompact) {
      continue;
    }
    const ok = await promiseFolderOperation((listener, resolve) => {
      if (typeof folder.compactAll === "function") {
        folder.compactAll(null, listener, null);
      } else if (typeof folder.compact === "function") {
        folder.compact(null, listener, null);
      } else {
        resolve(false);
      }
    });
    if (ok) {
      compacted += 1;
    }
  }
  return { total: folders.length, compacted };
}

async function resetFolderPane() {
  try {
    Services.prefs.clearUserPref("mail.ui.folderpane.version");
  } catch (e) {}
  try {
    Services.prefs.clearUserPref("mail.ui.folderpane.collapse_state");
  } catch (e) {}
  Services.obs.notifyObservers(null, "mail-folder-tree-flush", "all");
  return true;
}

async function refreshAddressBooks() {
  let refreshed = 0;
  try {
    for (const dir of MailServices.ab.directories) {
      try {
        MailServices.ab.reloadAddressBook(dir.URI);
        refreshed += 1;
      } catch (e) {
        Cu.reportError(e);
      }
    }
  } catch (e) {
    Cu.reportError(e);
  }
  return { refreshed };
}

async function repairFolderIndexes() {
  const folders = collectFolders();
  let repaired = 0;
  for (const folder of folders) {
    const flags = Ci.nsMsgFolderFlags;
    if (folder.flags & flags.Virtual) {
      continue;
    }
    const ok = await promiseFolderOperation(listener => {
      try {
        if (folder.msgDatabase) {
          folder.msgDatabase.summaryValid = false;
        }
        folder.ForceDBClosed();
      } catch (e) {
        Cu.reportError(e);
      }
      try {
        folder.RepairFolder(listener);
      } catch (e) {
        Cu.reportError(e);
        listener.OnStopRunningUrl();
      }
    });
    if (ok) {
      repaired += 1;
    }
  }
  return { total: folders.length, repaired };
}

async function rebuildGlobalSearch() {
  try {
    if (GlodaIndexer?.isReindexing) {
      GlodaIndexer.reset();
    }
    if (typeof GlodaIndexer.resetSync === "function") {
      GlodaIndexer.resetSync();
    }
    if (typeof GlodaIndexer.rebuild === "function") {
      GlodaIndexer.rebuild();
    } else if (typeof GlodaIndexer.indexEverything === "function") {
      GlodaIndexer.indexEverything();
    }
    return true;
  } catch (e) {
    Cu.reportError(e);
    return false;
  }
}

this.waynewright = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    return {
      experiments: {
        waynewright: {
          compactAllFolders(options = {}) {
            return compactAllFolders(options.maxRuntimeSeconds || 120);
          },
          resetFolderPane() {
            return resetFolderPane();
          },
          refreshAddressBooks() {
            return refreshAddressBooks();
          },
          repairFolderIndexes() {
            return repairFolderIndexes();
          },
          rebuildGlobalSearch() {
            return rebuildGlobalSearch();
          },
        },
      },
    };
  }
};
