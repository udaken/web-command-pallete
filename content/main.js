(async () => {
    // Wait for the namespace to be ready
    const { CommandEngine, CommandPalette } = window.WebCommandPalette;

    if (!CommandEngine || !CommandPalette) {
        return;
    }

    const DEFAULT_NAV_HIGHLIGHT_CSS = 'outline: 3px solid #ff00ff; outline-offset: 2px; box-shadow: 0 0 10px 3px rgba(255, 0, 255, 0.5);';

    // Config State
    let config = {
        shortcut: { key: 'p', ctrlKey: true, shiftKey: false, altKey: true, metaKey: false, code: 'KeyP' },
        excludedUrls: '',
        allowedClickUrls: '',
        trustedSources: [],
        navHighlightCss: DEFAULT_NAV_HIGHLIGHT_CSS,
        navOpenInNewWindow: false
    };

    async function loadConfig() {
        const data = await chrome.storage.local.get(['config']);
        if (data.config) {
            if (data.config.shortcut) config.shortcut = data.config.shortcut;
            if (data.config.excludedUrls) config.excludedUrls = data.config.excludedUrls;
            if (data.config.allowedClickUrls) config.allowedClickUrls = data.config.allowedClickUrls;
            if (data.config.trustedSources) config.trustedSources = data.config.trustedSources;
            if (typeof data.config.navHighlightCss === 'string') config.navHighlightCss = data.config.navHighlightCss;
            if (typeof data.config.navOpenInNewWindow === 'boolean') config.navOpenInNewWindow = data.config.navOpenInNewWindow;
        }
    }

    function parseCssDeclarations(css) {
        const result = [];
        if (!css) return result;
        for (const raw of css.split(';')) {
            const decl = raw.trim();
            if (!decl) continue;
            const colon = decl.indexOf(':');
            if (colon <= 0) continue;
            const prop = decl.slice(0, colon).trim();
            let value = decl.slice(colon + 1).trim();
            let priority = '';
            const importantMatch = /!important\s*$/i.exec(value);
            if (importantMatch) {
                priority = 'important';
                value = value.slice(0, importantMatch.index).trim();
            }
            if (prop && value) result.push({ prop, value, priority });
        }
        return result;
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

    function isEditableTarget(e) {
        const t = e.target;
        if (!t) return false;
        const tag = t.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
        if (t.isContentEditable) return true;
        return false;
    }

    function isNavNext(e) {
        if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && e.key === 'ArrowRight') return true;
        if (!e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && (e.key === 'j' || e.key === 'J')) return true;
        return false;
    }

    function isNavPrev(e) {
        if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && e.key === 'ArrowLeft') return true;
        if (!e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && (e.key === 'k' || e.key === 'K')) return true;
        return false;
    }

    function isNavOpen(e) {
        if (e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return false;
        if (e.key === 'Enter') return true;
        if (e.key === 'v' || e.key === 'V') return true;
        return false;
    }

    function isNavOpenInWindow(e) {
        if (e.ctrlKey || e.altKey || e.metaKey || !e.shiftKey) return false;
        if (e.key === 'Enter') return true;
        if (e.key === 'v' || e.key === 'V') return true;
        return false;
    }

    function isTrustedSource(sourceUrl) {
        if (sourceUrl === 'local') return true;
        if (sourceUrl && config.trustedSources && config.trustedSources.includes(sourceUrl)) return true;
        return false;
    }

    function findLinkInActive(activeEl, linkDef) {
        if (!activeEl) return null;
        if (linkDef) {
            try {
                if (linkDef.xpath) {
                    const result = document.evaluate(linkDef.xpath, activeEl, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                    return result.singleNodeValue;
                }
                if (linkDef.selector) {
                    return activeEl.querySelector(linkDef.selector);
                }
            } catch (e) {
                console.error('Navigation link selector error:', e);
                return null;
            }
        }
        return activeEl.querySelector('a');
    }

    function openActiveLink(inNewWindow = false) {
        const active = navState.activeEl;
        if (!active) return false;
        const nav = engine.getNavigationForCurrentPage();
        if (!nav) return false;
        const link = findLinkInActive(active, nav.link);
        if (!link) {
            console.warn('Web Command Palette: no link found inside active element.');
            return false;
        }
        const href = (link.tagName === 'A' && link.href) ? link.href : null;

        if (inNewWindow) {
            if (!href) {
                console.warn('Web Command Palette: cannot open in a new window without a valid href.');
                return false;
            }
            chrome.runtime.sendMessage({ type: 'open-window', url: href });
            return true;
        }

        if (href) {
            window.location.href = href;
            return true;
        }
        if (isClickAllowed() || isTrustedSource(nav.sourceUrl)) {
            link.click();
            return true;
        }
        console.warn('Web Command Palette: link element has no href and click is not allowed.');
        return false;
    }

    const navState = {
        activeEl: null,
        savedProps: []
    };

    function clearNavHighlight() {
        const el = navState.activeEl;
        if (!el) return;
        for (const saved of navState.savedProps) {
            if (saved.value) {
                el.style.setProperty(saved.prop, saved.value, saved.priority);
            } else {
                el.style.removeProperty(saved.prop);
            }
        }
        navState.savedProps = [];
        navState.activeEl = null;
    }

    function applyNavHighlight(el) {
        if (navState.activeEl === el) return;
        clearNavHighlight();
        if (!el) return;
        const decls = parseCssDeclarations(config.navHighlightCss);
        const saved = [];
        for (const decl of decls) {
            saved.push({
                prop: decl.prop,
                value: el.style.getPropertyValue(decl.prop),
                priority: el.style.getPropertyPriority(decl.prop)
            });
        }
        for (const decl of decls) {
            el.style.setProperty(decl.prop, decl.value, decl.priority);
        }
        navState.savedProps = saved;
        navState.activeEl = el;
    }

    function findInitialNavIndex(items) {
        for (let i = 0; i < items.length; i++) {
            const rect = items[i].getBoundingClientRect();
            if (rect.bottom > 0 && rect.top < window.innerHeight) return i;
        }
        return 0;
    }

    function moveNav(direction) {
        const nav = engine.getNavigationForCurrentPage();
        if (!nav || !nav.items || nav.items.length === 0) return false;
        const items = nav.items;

        let idx = items.indexOf(navState.activeEl);
        if (idx < 0) {
            idx = findInitialNavIndex(items);
        } else {
            idx += direction;
            if (idx < 0) idx = 0;
            if (idx >= items.length) idx = items.length - 1;
        }

        const target = items[idx];
        applyNavHighlight(target);
        if (typeof target.scrollIntoView === 'function') {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return true;
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

        // Check for Trusted Source
        let isTrusted = false;
        if (cmd.sourceUrl === 'local') {
            isTrusted = true;
        } else if (cmd.sourceUrl && config.trustedSources && config.trustedSources.includes(cmd.sourceUrl)) {
            isTrusted = true;
        }

        // Security: Demote click to focus if not allowed
        if (action === 'click' && !isClickAllowed() && !isTrusted) {
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
                palette.setDebugInfo(`Copied SITEINFO template to clipboard!\n\n${palette.escapeHtml(json)}`);
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

    function togglePalette() {
        if (isExcluded()) {
            console.log("Web Command Palette: URL is excluded.");
            return;
        }

        if (palette.isOpen) {
            palette.close();
            return;
        }

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

        const matchedConfigs = engine.siteInfo.filter(info => {
            try { return new RegExp(info.url).test(window.location.href); } catch(e) { return false; }
        });
        const debugInfo = [
            `URL: ${palette.escapeHtml(window.location.href)}`,
            `Matched SITEINFO: ${palette.escapeHtml(matchedConfigs.map(c => c.name || c.url).join(', ') || 'None')}`,
            `Total SITEINFO loaded: ${engine.siteInfo.length}`,
            `Click Allowed: ${isClickAllowed()}`,
            `Shortcut: ${palette.escapeHtml(config.shortcut ? JSON.stringify(config.shortcut) : 'Default')}`
        ].join('<br>');
        palette.setDebugInfo(debugInfo);

        palette.setCommands(commands);
        palette.open();
    }

    // Message Listener (e.g., from toolbar button click)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message && message.type === 'toggle-palette') {
            togglePalette();
            sendResponse({ ok: true });
        }
        return false;
    });

    // Global Shortcut Listener
    document.addEventListener('keydown', async (e) => {
        // Navigation shortcuts: only when palette closed, not in editable fields, and not excluded
        if (!palette.isOpen && !isEditableTarget(e)) {
            if (isNavNext(e) || isNavPrev(e)) {
                if (isExcluded()) return;
                const direction = isNavNext(e) ? 1 : -1;
                if (moveNav(direction)) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                return;
            }
            if ((isNavOpen(e) || isNavOpenInWindow(e)) && navState.activeEl) {
                if (isExcluded()) return;
                const shiftHeld = isNavOpenInWindow(e);
                const inNewWindow = shiftHeld !== !!config.navOpenInNewWindow;
                if (openActiveLink(inNewWindow)) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                return;
            }
        }

        if (isShortcut(e)) {
            console.log("Web Command Palette: Shortcut triggered");
            e.preventDefault();
            e.stopPropagation();
            togglePalette();
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
