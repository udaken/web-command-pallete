# Web Command Palette ⌨️

**Control any website with your keyboard.**

Web Command Palette is a lightweight browser extension that brings a VS Code-style command palette to your browsing experience. Define custom commands using XPath to click buttons, focus inputs, or navigate links—all without reaching for your mouse.

## ✨ Features

- **Universal Command Palette:** Works on any website defined in your settings.
- **Customizable Shortcuts:** Default is `Ctrl+Shift+P` (or `Cmd+Shift+P`), but you can make it yours.
- **Powerful Definitions:** Use XPath to target any element.
- **Flexible Configuration:** Load rules from local JSON or subscribe to external URLs (e.g., GitHub Gists).
- **Zero Dependencies:** Built with pure vanilla JavaScript for maximum speed and privacy.

## 🚀 Installation

### Chrome / Edge / Brave / Firefox
1.  Clone or download this repository.
2.  **Chrome/Edge:** Go to `chrome://extensions`, enable **Developer mode**, and click **Load unpacked**.
3.  **Firefox:** Go to `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on...**, and select `manifest.json`.
4.  Select the project folder (or the `manifest.json` file).

## 📖 Usage

1.  **Open the Palette:** Press `Ctrl+Shift+P` on a supported page.
2.  **Search:** Type to filter available commands.
3.  **Execute:** Press `Enter` to run the selected command.

**Tip:** You can always open the options page by running the "Configure Web Command Palette" command from the palette itself!

## ⚙️ Configuration

Open the extension **Options** page to configure your rules.

### 1. General Settings
- **Keyboard Shortcut:** Click the input and press your desired key combination to change the activation shortcut.
- **Excluded URLs:** Prevent the palette from opening on specific sites (supports Regex).
- **Allowed Click URLs:** For security, `click` actions are disabled by default. Add URL patterns (Regex) here to enable clicking on specific sites. If a site is not in this list, `click` actions will safely fallback to `focus`.

### 2. SITEINFO (Command Definitions)
You can define commands using a JSON structure called **SITEINFO**. You can edit this directly in the "Custom SITEINFO" box or load it from external URLs.

#### Simple Example
Here is a rule for **Google Search**:

```json
[
    {
        "name": "Google Search",
        "url": "^https://www\.google\.com/",
        "commands": [
            {
                "title": "Focus Search Box",
                "action": "focus",
                "xpath": "//textarea[@name=\"q\"]"
            },
            {
                "title": "I'm Feeling Lucky",
                "action": "click",
                "xpath": "//input[@name=\"btnI\"]"
            }
        ]
    }
]
```

### 3. Reference
| Property | Type | Description |
| :--- | :--- | :--- |
| `name` | String | (Optional) A friendly name for the site rule. |
| `url` | String | **Required.** A Regular Expression to match the page URL. |
| `commands` | Array | List of command objects. |
| `commands[].xpath` | String | **Required.** XPath expression to find the element. |
| `commands[].action` | String | `click` or `focus` (default). Note: `click` only works on sites in the "Allowed Click URLs" list. |
| `commands[].title` | String | Label in the palette. Auto-detected from element text/placeholder if omitted. |
