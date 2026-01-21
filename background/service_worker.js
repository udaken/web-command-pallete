console.log("Service Worker Loaded");

chrome.runtime.onInstalled.addListener(() => {
  console.log("Web Command Palette installed.");
});
