// DOM Elements
const shortcutInput = document.getElementById('shortcut-input');
const resetShortcutButton = document.getElementById('reset-shortcut');
const excludedUrlsInput = document.getElementById('excluded-urls');
const allowedClickUrlsInput = document.getElementById('allowed-click-urls');
const siteInfoUrlsInput = document.getElementById('siteinfo-urls');
const siteInfoJsonInput = document.getElementById('siteinfo-json');
const updateAllButton = document.getElementById('update-all');
const exportJsonButton = document.getElementById('export-json');
const importJsonButton = document.getElementById('import-json');
const importFileInput = document.getElementById('import-file');
const statusSpan = document.getElementById('status');

// Default Shortcut
const DEFAULT_SHORTCUT = {
    key: 'p',
    ctrlKey: true,
    shiftKey: true,
    altKey: false,
    metaKey: false,
    code: 'KeyP'
};

let currentShortcut = { ...DEFAULT_SHORTCUT };

// Helper: Show Status
function showStatus(message, type = 'success') {
    statusSpan.textContent = message;
    statusSpan.className = type;
    setTimeout(() => {
        statusSpan.textContent = '';
        statusSpan.className = '';
    }, 5000);
}

// Helper: Shortcut Display String
function formatShortcut(s) {
    const parts = [];
    if (s.ctrlKey) parts.push('Ctrl');
    if (s.metaKey) parts.push('Cmd');
    if (s.altKey) parts.push('Alt');
    if (s.shiftKey) parts.push('Shift');
    
    // Capitalize key
    let keyDisplay = s.key;
    if (keyDisplay === ' ') keyDisplay = 'Space';
    else if (keyDisplay.length === 1) keyDisplay = keyDisplay.toUpperCase();
    
    parts.push(keyDisplay);
    return parts.join('+');
}

// Shortcut Recorder
shortcutInput.addEventListener('keydown', (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Ignore modifier-only presses
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

    currentShortcut = {
        key: e.key,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
        code: e.code
    };

    shortcutInput.value = formatShortcut(currentShortcut);
});

resetShortcutButton.addEventListener('click', () => {
    currentShortcut = { ...DEFAULT_SHORTCUT };
    shortcutInput.value = formatShortcut(currentShortcut);
});

// Load Settings
async function loadSettings() {
    const data = await chrome.storage.local.get(['config']);
    const config = data.config || {};

    // 1. Shortcut
    if (config.shortcut) {
        currentShortcut = config.shortcut;
    }
    shortcutInput.value = formatShortcut(currentShortcut);

    // 2. Excluded URLs
    excludedUrlsInput.value = config.excludedUrls || '';

    // 2.5 Allowed Click URLs
    allowedClickUrlsInput.value = config.allowedClickUrls || '';

    // 3. URLs
    siteInfoUrlsInput.value = (config.urls || []).join('\n');

    // 4. Local JSON
    siteInfoJsonInput.value = config.localJson || '[]';
}

// Export JSON
exportJsonButton.addEventListener('click', () => {
    try {
        const jsonStr = siteInfoJsonInput.value.trim() || '[]';
        // Validate before export to ensure it's at least valid JSON
        JSON.parse(jsonStr);
        
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'SITEINFO.json';
        a.click();
        URL.revokeObjectURL(url);
        showStatus('Exported!');
    } catch (e) {
        showStatus('Invalid JSON in textarea. Cannot export.', 'error');
    }
});

// Import JSON
importJsonButton.addEventListener('click', () => {
    importFileInput.click();
});

importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const content = event.target.result;
            // Validate JSON
            const json = JSON.parse(content);
            validateSiteInfo(json);
            
            siteInfoJsonInput.value = JSON.stringify(json, null, 4);
            showStatus('Imported! Don\'t forget to click "Update & Save All".');
        } catch (err) {
            showStatus(`Import Error: ${err.message}`, 'error');
        }
        // Reset input so the same file can be imported again if needed
        importFileInput.value = '';
    };
    reader.readAsText(file);
});

// Validate JSON structure
function validateSiteInfo(json) {
    if (!Array.isArray(json)) {
        throw new Error("Root must be an array");
    }
    json.forEach((item, index) => {
        if (!item.url) throw new Error(`Item ${index}: Missing 'url'`);
        if (!Array.isArray(item.commands)) throw new Error(`Item ${index}: 'commands' must be an array`);
        item.commands.forEach((cmd, cmdIndex) => {
            if (!cmd.xpath) throw new Error(`Item ${index}, Command ${cmdIndex}: Missing 'xpath'`);
        });
    });
    return true;
}

// Save & Update Handler
updateAllButton.addEventListener('click', async () => {
    statusSpan.textContent = 'Updating...';
    statusSpan.className = '';

    try {
        // 1. Parse Local JSON
        let localData = [];
        try {
            const jsonStr = siteInfoJsonInput.value.trim();
            if (jsonStr) {
                localData = JSON.parse(jsonStr);
                validateSiteInfo(localData);
            }
        } catch (e) {
            throw new Error(`Local JSON Error: ${e.message}`);
        }

        // 2. Fetch External URLs
        const urls = siteInfoUrlsInput.value.trim().split('\n').map(u => u.trim()).filter(u => u);
        let externalData = [];
        
        if (urls.length > 0) {
            statusSpan.textContent = `Fetching ${urls.length} URLs...`;
        }

        for (const url of urls) {
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
                const json = await res.json();
                validateSiteInfo(json);
                if (Array.isArray(json)) {
                    externalData = externalData.concat(json);
                }
            } catch (e) {
                console.error(e);
                throw new Error(`Fetch Error (${url}): ${e.message}`);
            }
        }

        // 3. Merge
        const mergedSiteInfo = [...externalData, ...localData];
        
        // 4. Save Config & Merged Data
        const config = {
            shortcut: currentShortcut,
            excludedUrls: excludedUrlsInput.value,
            allowedClickUrls: allowedClickUrlsInput.value,
            urls: urls,
            localJson: siteInfoJsonInput.value
        };

        await chrome.storage.local.set({
            config: config,
            siteinfo: mergedSiteInfo // Content script reads this
        });

        showStatus(`Saved! Loaded ${mergedSiteInfo.length} definitions.`);

    } catch (e) {
        showStatus(e.message, 'error');
    }
});

loadSettings();