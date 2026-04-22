// ============================================================
// VEO PROMPT STUDIO — popup.js
// Formula (Google official): [Cinematography] → [Subject] → [Context] → [Style & Ambiance]
// ============================================================

// Thứ tự xuất prompt theo Google Veo 3.1 formula
const allFields = [
    'shot',        // ① Cinematography: shot type
    'angle',       //    + angle
    'movement',    //    + camera movement
    'lens',        //    + lens & focus
    'content',     // ② Subject & Action  ← translate
    'environment', // ③ Environment & Context ← translate
    'style',       // ④ Style & Ambiance: art style
    'mood',        //    + mood & atmosphere
    'lighting',    //    + lighting & color
    'motion',      // ⑤ Motion & Pace
    'technical',   //    + technical details
    'audio',       // ⑥ Audio: dialogue/SFX
];

// Chỉ dịch Subject và Environment (ô viết tay tiếng Việt)
const translateFields = ['content', 'environment'];

// Default prompts
const DEFAULT_PROMPT_TRANSLATE = `Translate to simple, literal English. Use direct visual descriptions only. No poetic or flowery language. Context: Cinematic AI video prompt for Google Veo. Text: "{TEXT}". Output the translation only, no explanation.`;

const DEFAULT_PROMPT_MULTISHOT = `You are an expert film director writing a Google Veo 3.1 multishot video prompt in English.
Total video duration: 8 seconds. You must create exactly {NUM_SHOTS} scenes.
Use these exact timestamps: {TIMESTAMPS}.

Main Subject/Action: "{CONTENT}"
Environment: "{ENVIRONMENT}"
Cinematography hints: "{CINEMATOGRAPHY}"

Rules:
1. Format each scene exactly like this: [XX:XX-YY:YY] [Camera Shot] [Subject & Action Details].
2. Distribute the action logically across the timestamps to tell a continuous micro-story.
3. Camera angles and camera shots vary in each scene
4. Keep descriptions highly cinematic, visual, and concise.
5. Output ONLY the timestamped blocks separated by double newlines. No intro, no conversational text.`;

// ============================================================
// UI References
// ============================================================
const statusEl = document.getElementById('status');
const ui = {
    useAI:      document.getElementById('useAI'),
    apiKey:     document.getElementById('apiKey'),
    model:      document.getElementById('modelSelect'),
    sync:       document.getElementById('syncModels'),
    settingsBox:document.getElementById('aiSettingsBox'),
    toggleBtn:  document.getElementById('toggleSettings'),
    toggleDarkMode: document.getElementById('toggleDarkMode'),
    promptTranslate: document.getElementById('promptTranslate'),
    promptMultishot: document.getElementById('promptMultishot'),
    useNewline: document.getElementById('useNewline')
};

// ============================================================
// Storage Abstraction (Support both Extension & Web App)
// ============================================================
const storage = {
    get: function(keys, callback) {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.get(keys, callback);
        } else {
            let data = {};
            keys.forEach(key => {
                let val = localStorage.getItem(key);
                if (val !== null) {
                    try { data[key] = JSON.parse(val); } catch(e) { data[key] = val; }
                }
            });
            callback(data);
        }
    },
    set: function(data, callback) {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.set(data, callback);
        } else {
            Object.keys(data).forEach(key => {
                localStorage.setItem(key, JSON.stringify(data[key]));
            });
            if (callback) callback();
        }
    }
};

// ============================================================
// 1. Settings & UI Panel
// ============================================================
ui.toggleBtn.addEventListener('click', () => {
    const hidden = ui.settingsBox.style.display === '' || ui.settingsBox.style.display === 'none';
    ui.settingsBox.style.display = hidden ? 'block' : 'none';
});

ui.toggleDarkMode.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark-mode');
    saveSettings();
});

// Load saved settings
storage.get(['key', 'aiActive', 'selectedModel', 'promptTranslate', 'promptMultishot', 'darkMode', 'useNewline'], (data) => {
    if (data.darkMode) {
        document.documentElement.classList.add('dark-mode');
    }
    if (data.key)            ui.apiKey.value    = data.key;
    if (data.aiActive !== undefined) ui.useAI.checked  = data.aiActive;
    if (data.useNewline !== undefined) ui.useNewline.checked = data.useNewline;
    if (data.selectedModel) {
        const opt = document.createElement('option');
        opt.value = data.selectedModel;
        opt.innerText = data.selectedModel;
        ui.model.appendChild(opt);
        ui.model.value = data.selectedModel;
    }
    ui.promptTranslate.value = data.promptTranslate || DEFAULT_PROMPT_TRANSLATE;
    ui.promptMultishot.value = data.promptMultishot || DEFAULT_PROMPT_MULTISHOT;
    if (data.key) fetchModels();
});

// Save on change
const saveSettings = () => {
    storage.set({
        key: ui.apiKey.value,
        aiActive: ui.useAI.checked,
        selectedModel: ui.model.value,
        promptTranslate: ui.promptTranslate.value,
        promptMultishot: ui.promptMultishot.value,
        darkMode: document.documentElement.classList.contains('dark-mode'),
        useNewline: ui.useNewline.checked
    });
};
[ui.apiKey, ui.useAI, ui.model, ui.promptTranslate, ui.promptMultishot, ui.useNewline].forEach(el => el.addEventListener('change', saveSettings));

// ============================================================
// 2. Initial Setup
// ============================================================

// ============================================================
// 3. Status helper
// ============================================================
function showStatus(msg, isError = false) {
    statusEl.innerText = msg;
    statusEl.className = isError ? 'status error' : 'status';
    if (!isError) setTimeout(() => { statusEl.innerText = ''; }, 2500);
}

// ============================================================
// 4. Model sync (Gemini API)
// ============================================================
async function fetchModels() {
    const key = ui.apiKey.value;
    if (!key) return;
    try {
        const res  = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await res.json();
        if (data.models) {
            const current = ui.model.value;
            ui.model.innerHTML = '';
            data.models
                .filter(m => m.supportedGenerationMethods.includes('generateContent'))
                .forEach(m => {
                    const name = m.name.replace('models/', '');
                    const opt  = document.createElement('option');
                    opt.value = name;
                    opt.innerText = m.displayName;
                    ui.model.appendChild(opt);
                });
            ui.model.value = current || 'gemini-1.5-flash';
        }
    } catch (e) { console.error('fetchModels:', e); }
}
ui.sync.addEventListener('click', fetchModels);

// ============================================================
// 5. Translation engines
// ============================================================

// Google Translate (free, fallback)
async function googleTranslate(text) {
    if (!text || !/[^\x00-\x7F]/.test(text)) return text;
    const clean = text.replace(/\n/g, ' ').trim();
    try {
        const res  = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURI(clean)}`);
        const data = await res.json();
        return data[0].map(s => s[0]).join('').replace(/\s+/g, ' ').trim();
    } catch (e) { return text; }
}

// Gemini (precise, cinematic-aware translation)
async function geminiTranslate(text) {
    const key = ui.apiKey.value;
    if (!key) return googleTranslate(text);
    const clean = text.replace(/\n/g, ' ').trim();
    
    let promptTemplate = ui.promptTranslate.value || DEFAULT_PROMPT_TRANSLATE;
    const prompt = promptTemplate.replace(/{TEXT}/g, clean);
    try {
        const res  = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${ui.model.value}:generateContent?key=${key}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
        );
        const data = await res.json();
        return data.candidates[0].content.parts[0].text.trim().replace(/\n/g, ' ');
    } catch (e) {
        return googleTranslate(text);
    }
}

// ============================================================
// 6. Translate button — only fields ② and ③
// ============================================================
document.getElementById('btnTranslate').addEventListener('click', async () => {
    showStatus('Translating Subject & Environment...');
    const translate = ui.useAI.checked ? geminiTranslate : googleTranslate;

    for (const id of translateFields) {
        const el = document.getElementById(id);
        if (el && el.value.trim()) {
            el.value = await translate(el.value);
        }
    }
    showStatus('Translated successfully!');
});

// ============================================================
// 7. Copy button — builds final prompt in Google formula order
// ============================================================
document.getElementById('btnCopy').addEventListener('click', () => {
    const parts = [];

    allFields.forEach(id => {
        const el  = document.getElementById(id);
        const val = el ? el.value.trim().replace(/\n/g, ' ') : '';
        if (val) parts.push(val);
    });

    // Music: skip default empty value
    const musicEl  = document.getElementById('music');
    const musicVal = musicEl ? musicEl.value.trim() : '';
    if (musicVal) parts.push(musicVal);

    const separator = ui.useNewline.checked ? '\n' : ', ';
    const finalPrompt = parts.join(separator);

    if (finalPrompt) {
        navigator.clipboard.writeText(finalPrompt).then(() => {
            showStatus('Copied to clipboard!');
        }).catch(() => {
            showStatus('Copy failed — check permissions.', true);
        });
    } else {
        showStatus('Nothing to copy yet.', true);
    }
});
// ============================================================
// 8. Multishot AI Generator (Google Veo 3.1)
// ============================================================
document.getElementById('btnGenMultishot').addEventListener('click', async () => {
    const key = ui.apiKey.value;
    if (!key) {
        showStatus('Please enter Gemini API Key first!', true);
        ui.settingsBox.style.display = 'block'; // Mở cài đặt nếu chưa có key
        return;
    }

    const content = document.getElementById('content').value.trim();
    const environment = document.getElementById('environment').value.trim();

    if (!content) {
        showStatus('Please describe Subject & Action (Group 2) first!', true);
        return;
    }

    const btnGen = document.getElementById('btnGenMultishot');
    btnGen.disabled = true;
    btnGen.innerText = "Wait...";
    showStatus('Generating Multishot Script...');

    const numShots = parseInt(document.getElementById('numShots').value);
    
    // Tự động chia timestamp đều nhau (Tổng max 8 giây)
    let timestamps = [];
    let duration = 8 / numShots;
    for (let i = 0; i < numShots; i++) {
        let start = Math.round(i * duration);
        let end = Math.round((i + 1) * duration);
        timestamps.push(`[00:0${start}-00:0${end}]`);
    }

    // Gộp các thông số để gợi ý cho AI
    const cinematography = [
        document.getElementById('shot').value,
        document.getElementById('angle').value,
        document.getElementById('movement').value
    ].filter(Boolean).join(', ');

    // Prompt hướng dẫn Gemini sinh ra multishot theo chuẩn Veo 3.1
    let promptTemplate = ui.promptMultishot.value || DEFAULT_PROMPT_MULTISHOT;
    const sysPrompt = promptTemplate
        .replace(/{NUM_SHOTS}/g, numShots)
        .replace(/{TIMESTAMPS}/g, timestamps.join(', '))
        .replace(/{CONTENT}/g, content)
        .replace(/{ENVIRONMENT}/g, environment)
        .replace(/{CINEMATOGRAPHY}/g, cinematography);

    try {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${ui.model.value || 'gemini-1.5-flash'}:generateContent?key=${key}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: sysPrompt }] }] })
            }
        );
        const data = await res.json();
        let generatedScenes = data.candidates[0].content.parts[0].text.trim();

        // Thu thập các thông số Global (Style, Motion, Tech, Audio) để nối vào cuối
        const globalSettings = [];
        ['style', 'mood', 'lighting', 'lens', 'motion', 'technical', 'audio'].forEach(id => {
            const val = document.getElementById(id).value.trim();
            if (val) globalSettings.push(val);
        });
        const musicVal = document.getElementById('music').value.trim();
        if (musicVal) globalSettings.push(musicVal);

        // Nối Global Settings vào cuối prompt
        if (globalSettings.length > 0) {
            generatedScenes += '\n\nGlobal settings: ' + globalSettings.join(', ') + '.';
        }

        // Hiển thị ra ô Textarea
        document.getElementById('multishotOutput').value = generatedScenes;
        showStatus('Multishot Prompt Generated successfully!');
    } catch (error) {
        console.error(error);
        showStatus('Failed to generate multishot. Check API or connection.', true);
    } finally {
        btnGen.disabled = false;
        btnGen.innerText = "Generate";
    }
});

// Nút Copy riêng cho Multishot
document.getElementById('btnCopyMultishot').addEventListener('click', () => {
    const text = document.getElementById('multishotOutput').value;
    if (text) {
        navigator.clipboard.writeText(text).then(() => {
            showStatus('Multishot Prompt copied to clipboard!');
        }).catch(() => showStatus('Copy failed!', true));
    } else {
        showStatus('Generate a multishot prompt first!', true);
    }
});

// Nút Clear riêng cho Multishot
document.getElementById('btnClearMultishot').addEventListener('click', () => {
    document.getElementById('multishotOutput').value = '';
    showStatus('Multishot Prompt cleared!');
});

// ============================================================
// 9. Manual translate buttons for parts without auto-translate
// ============================================================
document.querySelectorAll('.btn-trans-mini').forEach(btn => {
    btn.addEventListener('click', async () => {
        const group = btn.getAttribute('data-group');
        let fields = [];
        if (group === '1') fields = ['shot', 'angle', 'movement', 'lens'];
        if (group === '2') fields = ['content'];
        if (group === '3') fields = ['environment'];
        if (group === '4') fields = ['style', 'mood', 'lighting'];
        if (group === '5') fields = ['motion', 'technical'];
        if (group === '6') fields = ['audio'];

        btn.innerText = '⏳';
        const translate = ui.useAI.checked ? geminiTranslate : googleTranslate;
        
        for (const id of fields) {
            const el = document.getElementById(id);
            // Translate if the element exists, has a value, and it's not a select dropdown
            if (el && el.tagName !== 'SELECT' && el.value.trim()) {
                el.value = await translate(el.value);
            }
        }
        btn.innerText = '🌐';
        showStatus(`Translated Group ${group}!`);
    });
});

// ============================================================
// 10. Pop-out window
// ============================================================
document.getElementById('btnPopOut').addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'openPopupWindow' });
        window.close();
    } else {
        window.open(window.location.href, '_blank', 'width=540,height=900,menubar=no,toolbar=no,location=no,status=no');
    }
});