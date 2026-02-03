(function() {
    // Namespace setup
    window.WebCommandPalette = window.WebCommandPalette || {};

    class CommandEngine {
        constructor() {
            this.siteInfo = [];
        }

        async loadSiteInfo() {
            const data = await chrome.storage.local.get(['siteinfo']);
            this.siteInfo = data.siteinfo || [];
        }

        getCommandsForCurrentPage() {
            const currentUrl = window.location.href;
            const matchedConfigs = this.siteInfo.filter(info => {
                try {
                    return new RegExp(info.url).test(currentUrl);
                } catch (e) {
                    console.warn('Invalid Regex:', info.url);
                    return false;
                }
            });

            const commands = [];
            
            matchedConfigs.forEach(config => {
                config.commands.forEach(cmdDef => {
                    let elements = [];
                    if (cmdDef.xpath) {
                        elements = this.getElementsByXPath(cmdDef.xpath);
                    } else if (cmdDef.selector) {
                        elements = this.getElementsBySelector(cmdDef.selector);
                    }

                    elements.forEach((el, index) => {
                        let domText = "";
                        if (el) {
                            domText = el.innerText || el.textContent;
                            if (!domText || !domText.trim()) {
                                domText = el.value || el.placeholder || el.getAttribute('aria-label') || el.title || el.alt;
                            }
                        }
                        domText = (domText || "").trim();

                        const jsonTitle = (cmdDef.title || "").trim();
                        
                        // Primary label: DOM text > JSON Title > "Command"
                        let label = domText || jsonTitle || "Command";

                        // Description: JSON Title (only if it exists and is different from the label)
                        let description = "";
                        if (jsonTitle && jsonTitle !== label) {
                            description = jsonTitle;
                        }

                        // Use name if available, otherwise use url pattern for ID generation
                        const prefix = config.name ? config.name.replace(/\s+/g, '-') : config.url;

                        commands.push({
                            id: `${prefix}-${index}-${Math.random().toString(36).substr(2, 9)}`,
                            label: label.substring(0, 100),
                            description: description,
                            element: el,
                            action: cmdDef.action || 'click',
                            xpath: cmdDef.xpath,
                            definitionId: config.url, // Track which SITEINFO definition this command belongs to
                            sourceUrl: config.sourceUrl // Track the source (URL or 'local')
                        });
                    });
                });
            });

            return commands;
        }

        getElementsByXPath(xpath) {
            const results = [];
            try {
                const query = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                for (let i = 0; i < query.snapshotLength; i++) {
                    results.push(query.snapshotItem(i));
                }
            } catch (e) {
                console.error('XPath Error:', xpath, e);
            }
            return results;
        }

        getElementsBySelector(selector) {
            try {
                return Array.from(document.querySelectorAll(selector));
            } catch (e) {
                console.error('Selector Error:', selector, e);
                return [];
            }
        }
    }

    // Expose to namespace
    window.WebCommandPalette.CommandEngine = CommandEngine;
})();