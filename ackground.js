chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({ id: "openVeo", title: "Open Veo Prompt Builder", contexts: ["all"] });
});

function openApp() {
    chrome.windows.create({ url: "popup.html", type: "popup", width: 440, height: 750 });
}

chrome.contextMenus.onClicked.addListener((info) => { if (info.menuItemId === "openVeo") openApp(); });
chrome.commands.onCommand.addListener((cmd) => { if (cmd === "open_builder_window") openApp(); });