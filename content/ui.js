(function() {
    window.WebCommandPalette = window.WebCommandPalette || {};

    const styles = `
    .host {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 2147483647;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding-top: 10vh;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.1s ease;
    }

    .host.open {
        opacity: 1;
        pointer-events: auto;
    }

    .palette {
        width: 600px;
        max-width: 90%;
        background: #222;
        color: #eee;
        border-radius: 8px;
        box-shadow: 0 15px 30px rgba(0,0,0,0.3);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        max-height: 80vh;
        border: 1px solid #444;
    }

    input {
        width: 100%;
        padding: 16px;
        font-size: 18px;
        border: none;
        border-bottom: 1px solid #444;
        outline: none;
        box-sizing: border-box;
        background: #222;
        color: #fff;
    }

    .results {
        list-style: none;
        margin: 0;
        padding: 0;
        overflow-y: auto;
    }

    .item {
        padding: 12px 16px;
        cursor: pointer;
        border-bottom: 1px solid #333;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .item.active, .item:hover {
        background: #007bff;
        color: #fff;
    }

    .no-results {
        padding: 16px;
        color: #999;
        text-align: center;
    }
    `;

    class CommandPaletteUI {
        constructor() {
            // Create a host element (standard div) instead of Custom Element
            this.hostElement = document.createElement('div');
            // Attach Shadow DOM to the div
            this.shadowRoot = this.hostElement.attachShadow({ mode: 'open' });
            
            this.commands = [];
            this.filteredCommands = [];
            this.selectedIndex = 0;
            this.isOpen = false;
            this.eventListeners = {}; // Simple event emitter

            this.init();
        }

        init() {
            this.render();
            this.input = this.shadowRoot.querySelector('input');
            this.resultsContainer = this.shadowRoot.querySelector('.results');
            this.hostContainer = this.shadowRoot.querySelector('.host'); // Wrapper for styles
            
            this.input.addEventListener('input', (e) => this.filterCommands(e.target.value));
            this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
            
            this.hostContainer.addEventListener('click', (e) => {
                if (e.target === this.hostContainer) this.close();
            });
        }

        // Event Emitter Logic
        on(event, handler) {
            if (!this.eventListeners[event]) this.eventListeners[event] = [];
            this.eventListeners[event].push(handler);
        }

        emit(event, data) {
            if (this.eventListeners[event]) {
                this.eventListeners[event].forEach(handler => handler(data));
            }
        }

        getElement() {
            return this.hostElement;
        }

        setCommands(commands) {
            this.commands = commands;
            this.filterCommands('');
        }

        open() {
            this.isOpen = true;
            this.hostContainer.classList.add('open');
            this.input.value = '';
            this.filterCommands('');
            // Small timeout to ensure visibility before focusing
            setTimeout(() => this.input.focus(), 50);
        }

        close() {
            this.isOpen = false;
            this.hostContainer.classList.remove('open');
            this.selectedIndex = 0;
        }

        filterCommands(query) {
            if (!query) {
                this.filteredCommands = this.commands;
            } else {
                const lowerQuery = query.toLowerCase();
                this.filteredCommands = this.commands.filter(cmd => 
                    cmd.label.toLowerCase().includes(lowerQuery)
                );
            }
            this.selectedIndex = 0;
            this.renderResults();
        }

        handleKeydown(e) {
            if (!this.isOpen) return;

            switch(e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredCommands.length - 1);
                    this.renderResults();
                    this.scrollSelectedIntoView();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
                    this.renderResults();
                    this.scrollSelectedIntoView();
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (this.filteredCommands[this.selectedIndex]) {
                        this.executeCommand(this.filteredCommands[this.selectedIndex]);
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    this.close();
                    break;
            }
        }

        scrollSelectedIntoView() {
            const selected = this.resultsContainer.children[this.selectedIndex];
            if (selected) {
                selected.scrollIntoView({ block: 'nearest' });
            }
        }

        executeCommand(cmd) {
            this.close();
            this.emit('execute', cmd);
        }

        renderResults() {
            if (this.filteredCommands.length === 0) {
                this.resultsContainer.innerHTML = '<div class="no-results">No commands found</div>';
                return;
            }

            this.resultsContainer.innerHTML = this.filteredCommands.map((cmd, index) => `
                <li class="item ${index === this.selectedIndex ? 'active' : ''}" data-index="${index}">
                    <span class="label">${this.escapeHtml(cmd.label)}</span>
                </li>
            `).join('');

            this.resultsContainer.querySelectorAll('.item').forEach((el, index) => {
                el.addEventListener('click', () => {
                    this.executeCommand(this.filteredCommands[index]);
                });
            });
        }

        escapeHtml(unsafe) {
            return unsafe
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        render() {
            this.shadowRoot.innerHTML = `
                <style>${styles}</style>
                <div class="host">
                    <div class="palette">
                        <input type="text" placeholder="Type a command..." />
                        <ul class="results"></ul>
                    </div>
                </div>
            `;
        }
    }

    window.WebCommandPalette.CommandPalette = CommandPaletteUI;
})();
