# Web Command Palette

This project is a browser extension that provides a “Command Palette” feature to simplify page operations.
It works with Chrome and Firefox.

## Key Features
- **Vanilla ECMAScript:** No external libraries or build tools (npm/vite) are used.
- **Manifest V3 Compatible:** Uses service workers and isolated content scripts.
- **UI Architecture:** 
  - Uses a custom UI class (`CommandPaletteUI`) instead of `customElements.define` to ensure stability within the browser extension's isolated world.
  - Styles are isolated using **Shadow DOM**.
- **Flexible Configuration:**
  - **Multiple SITEINFO Sources:** Supports merging definitions from local JSON and multiple external URLs.
  - **Configurable Shortcut:** Users can change the activation key (default: `Ctrl+Shift+P`).
  - **Excluded URLs:** Support for regex-based URL exclusion.

## Overview of Operation
- **Data Loading:** 
  - Loads site-specific command definitions (SITEINFO) from `chrome.storage.local`.
  - SITEINFO structure:
    - `name`: (Optional) Name of the site definition.
    - `url`: Regex pattern to match the webpage URL.
    - `commands`: Array of command objects:
      - `title`: Command label (defaults to element's `innerText`, `value`, or `placeholder` if omitted).
      - `xpath`: XPath expression to find the target element.
      - `action`: Operation to perform (`click` or `focus`. Defaults to `click`).
- **Activation:** 
  - Pressing the configured shortcut (default `Ctrl+Shift+P`) displays the palette.
  - The palette filters commands based on the current URL.
  - Includes a built-in command to open the Options page.
- **Execution:** 
  - Selecting a command performs the specified action on the element found via XPath.
  - Automatically handles fallbacks for elements without direct text content.