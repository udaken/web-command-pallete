const ALARM_NAME = 'update-siteinfo';
const UPDATE_PERIOD_MINUTES = 60 * 24; // 24 hours

// Validate JSON structure (Same as in options/main.js)
function validateSiteInfo(json) {
    if (!Array.isArray(json)) {
        throw new Error("Root must be an array");
    }
    json.forEach((item, index) => {
        if (!item.url) throw new Error(`Item ${index}: Missing 'url'`);
        if (!Array.isArray(item.commands)) throw new Error(`Item ${index}: 'commands' must be an array`);
        item.commands.forEach((cmd, cmdIndex) => {
            if (!cmd.xpath && !cmd.selector) throw new Error(`Item ${index}, Command ${cmdIndex}: Missing 'xpath' or 'selector'`);
        });
    });
    return true;
}

async function updateSiteInfo() {
    try {
        const data = await chrome.storage.local.get(['config']);
        const config = data.config;
        
        if (!config) return; // No config yet

        // 1. Parse Local JSON
        let localData = [];
        try {
            if (config.localJson) {
                localData = JSON.parse(config.localJson);
                validateSiteInfo(localData);
                localData.forEach(item => item.sourceUrl = 'local');
            }
        } catch (e) {
            console.error('Background Update: Local JSON Error', e);
            // Continue with empty local data or partial? Best to abort local part?
            // If local JSON is corrupt in storage, we probably shouldn't use it.
            localData = [];
        }

        // 2. Fetch External URLs
        const urls = config.urls || [];
        let externalData = [];

        for (const url of urls) {
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
                const json = await res.json();
                validateSiteInfo(json);
                if (Array.isArray(json)) {
                    json.forEach(item => item.sourceUrl = url);
                    externalData = externalData.concat(json);
                }
            } catch (e) {
                console.error(`Background Update: Fetch Error (${url})`, e);
                // Continue with other URLs
            }
        }

        // 3. Merge
        const mergedSiteInfo = [...externalData, ...localData];

        // 4. Save
        await chrome.storage.local.set({
            siteinfo: mergedSiteInfo,
            lastUpdated: Date.now()
        });

        console.log(`Background Update: Completed. ${mergedSiteInfo.length} definitions loaded.`);

    } catch (e) {
        console.error('Background Update Failed:', e);
    }
}

// Alarm Listener
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
        updateSiteInfo();
    }
});

// Setup Alarm on Install/Startup
function setupAlarm() {
    chrome.alarms.get(ALARM_NAME, (alarm) => {
        if (!alarm) {
            chrome.alarms.create(ALARM_NAME, { periodInMinutes: UPDATE_PERIOD_MINUTES });
            console.log("Background Update: Alarm created.");
        }
    });
}

chrome.runtime.onInstalled.addListener(() => {
    setupAlarm();
    updateSiteInfo(); // Update immediately on install/update
});

chrome.runtime.onStartup.addListener(() => {
    setupAlarm();
});
