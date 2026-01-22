(async () => {
    // Wait for the namespace to be ready
    const { CommandEngine, CommandPalette } = window.WebCommandPalette;

    if (!CommandEngine || !CommandPalette) {
        return;
    }

    // Config State
    let config = {
        shortcut: { key: 'p', ctrlKey: true, shiftKey: false, altKey: true, metaKey: false, code: 'KeyP' },
        excludedUrls: '',
        allowedClickUrls: ''
    };

    async function loadConfig() {
        const data = await chrome.storage.local.get(['config']);
        if (data.config) {
            if (data.config.shortcut) config.shortcut = data.config.shortcut;
            if (data.config.excludedUrls) config.excludedUrls = data.config.excludedUrls;
            if (data.config.allowedClickUrls) config.allowedClickUrls = data.config.allowedClickUrls;
        }
    }

    function isExcluded() {
        if (!config.excludedUrls) return false;
        const patterns = config.excludedUrls.split('\n').filter(p => p.trim());
        const currentUrl = window.location.href;
        for (const p of patterns) {
            try {
                if (new RegExp(p).test(currentUrl)) return true;
            } catch (e) {
                console.warn('Invalid Exclude Regex:', p);
            }
        }
        return false;
    }

    function isClickAllowed() {
        if (!config.allowedClickUrls) return false;
        const patterns = config.allowedClickUrls.split('\n').filter(p => p.trim());
        const currentUrl = window.location.href;
        for (const p of patterns) {
            try {
                if (new RegExp(p).test(currentUrl)) return true;
            } catch (e) {
                console.warn('Invalid Allowed Click Regex:', p);
            }
        }
        return false;
    }

    function isShortcut(e) {
        const s = config.shortcut;
        // Strict modifier check
        if (e.ctrlKey !== s.ctrlKey) return false;
        if (e.shiftKey !== s.shiftKey) return false;
        if (e.altKey !== s.altKey) return false;
        if (e.metaKey !== s.metaKey) return false;

        // Key check: Prefer code if available, fallback to key
        if (s.code && e.code === s.code) return true;
        if (e.key.toLowerCase() === s.key.toLowerCase()) return true;
        
        return false;
    }

    // Initialize Engine and UI
    const engine = new CommandEngine();
    const palette = new CommandPalette();

    const paletteElement = palette.getElement();
    if (paletteElement && document.body) {
        document.body.appendChild(paletteElement);
    } else {
        return;
    }

    // Load Data
    await engine.loadSiteInfo();
    await loadConfig();

    // Listen for execution events
    palette.on('execute', (cmd) => {
        console.log("Executing:", cmd);

        let action = cmd.action || 'click'; // Default action

        // Security: Demote click to focus if not allowed
        if (action === 'click' && !isClickAllowed()) {
            console.warn("Web Command Palette: 'click' action demoted to 'focus' for security. Configure 'Allowed Click URLs' in options to enable.");
            action = 'focus';
        }

        if (action === 'options') {
            window.open(chrome.runtime.getURL('options/index.html'), '_blank');
            return;
        }

        if (action === 'debug') {
            palette.toggleDebug();
            palette.open(); // Keep open to see debug info
            return;
        }

        if (action === 'copy-template') {
            const fullUrl = window.location.origin + window.location.pathname;
            const escapedUrl = `^${fullUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`;
            const template = [{
                name: document.title || "New Site",
                url: escapedUrl,
                commands: []
            }];
            const json = JSON.stringify(template, null, 4);
            navigator.clipboard.writeText(json).then(() => {
                palette.setDebugInfo(`Copied SITEINFO template to clipboard!\n\n${json}`);
                if (!palette.isDebugVisible) {
                    palette.toggleDebug();
                }
                palette.open();
            }).catch(err => {
                console.error('Failed to copy:', err);
            });
            return;
        }

        if (cmd.element) {
            // Ensure element is visible
            if (typeof cmd.element.scrollIntoView === 'function') {
                cmd.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            // Visual highlight
            const originalOutline = cmd.element.style.outline;
            const originalBoxShadow = cmd.element.style.boxShadow;
            const originalTransition = cmd.element.style.transition;

            // Instant highlight
            cmd.element.style.transition = 'none';
            cmd.element.style.outline = '4px solid #ff00ff';
            cmd.element.style.boxShadow = '0 0 15px 5px rgba(255, 0, 255, 0.5)';
            
            // Fade back after 1 second
            setTimeout(() => {
                cmd.element.style.transition = 'outline 1s ease, box-shadow 1s ease';
                cmd.element.style.outline = originalOutline;
                cmd.element.style.boxShadow = originalBoxShadow;
                
                // Cleanup transition property after fade finishes
                setTimeout(() => {
                    cmd.element.style.transition = originalTransition;
                }, 1000);
            }, 1000);

            if (action === 'focus') {
                cmd.element.focus();
            } else {
                // Default to click (and focus for better UX)
                cmd.element.click();
                if (typeof cmd.element.focus === 'function') {
                    cmd.element.focus();
                }
            }
        } else {
            console.warn("Element not found for command:", cmd);
        }
    });

    // Global Shortcut Listener
    document.addEventListener('keydown', async (e) => {
        if (isShortcut(e)) {
            if (isExcluded()) {
                console.log("Web Command Palette: URL is excluded.");
                return;
            }

            console.log("Web Command Palette: Shortcut triggered");
            e.preventDefault();
            e.stopPropagation(); 
            
            if (palette.isOpen) {
                palette.close();
            } else {
                let commands = engine.getCommandsForCurrentPage();

                commands.push({
                    id: 'builtin-debug',
                    label: 'Debug: Toggle Info',
                    action: 'debug',
                    element: null
                });

                commands.push({
                    id: 'builtin-copy-template',
                    label: 'Debug: Copy SITEINFO Template',
                    action: 'copy-template',
                    element: null
                });
                
                // Prepare debug info
                const matchedConfigs = engine.siteInfo.filter(info => {
                    try { return new RegExp(info.url).test(window.location.href); } catch(e) { return false; }
                });
                const debugInfo = [
                    `URL: ${window.location.href}`,
                    `Matched SITEINFO: ${matchedConfigs.map(c => c.name || c.url).join(', ') || 'None'}`,
                    `Total SITEINFO loaded: ${engine.siteInfo.length}`,
                    `Click Allowed: ${isClickAllowed()}`,
                    `Shortcut: ${config.shortcut ? JSON.stringify(config.shortcut) : 'Default'}`
                ].join('<br>');
                palette.setDebugInfo(debugInfo);
                
                palette.setCommands(commands);
                palette.open();
            }
        }
    }, true);

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            if (changes.siteinfo) {
                engine.loadSiteInfo();
                console.log("SITEINFO updated");
            }
            if (changes.config) {
                loadConfig();
                console.log("Config updated");
            }
        }
    });

    console.log("Web Command Palette: Ready (Polyfill + Configurable)");

})();
