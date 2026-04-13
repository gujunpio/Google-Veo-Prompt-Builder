// Hàm tạo cửa sổ Popup riêng biệt
function createPromptWindow() {
  chrome.windows.create({
    url: "popup.html",
    type: "popup",
    width: 440,
    height: 850 // <--- Sửa dòng này
  });
}

// 1. Lắng nghe khi nhấn vào menu chuột phải
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "openPromptPopup",
    title: "Open Prompt Builder",
    contexts: ["all"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "openPromptPopup") {
    createPromptWindow();
  }
});

// 2. Lắng nghe phím tắt (Alt + Shift + P)
chrome.commands.onCommand.addListener((command) => {
  if (command === "open_builder_window") {
    createPromptWindow();
  }
});