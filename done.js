const url = browser.runtime.getURL("report/viewer.html");
document.getElementById("openViewer").href = url;

const line = browser.i18n.getMessage("donateLine") || "";
const link = browser.i18n.getMessage("donateUrl") || "https://www.paypal.com/paypalme/commitconfidential";
const btnText = browser.i18n.getMessage("donateBtn") || "Support the Developer";

document.getElementById("donateLine").textContent = line;
const btn = document.getElementById("donateBtn");
btn.textContent = btnText;
btn.href = link;

const header = document.getElementById("finishHeader");
header.textContent = browser.i18n.getMessage("finishBanner") || header.textContent;

document.getElementById("disc").textContent = browser.i18n.getMessage("disclaimer");
