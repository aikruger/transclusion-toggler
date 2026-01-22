# Transclusion Toggler

Transclusion Toggler is an Obsidian plugin that allows you to quickly toggle the transclusion prefix (`!`) on wikilinks using hotkeys. This makes it easy to switch between linking to a note and embedding its content.

## Features

- **Toggle Current Link**: Add or remove the `!` prefix from the wikilink under your cursor or wikilink(s) in selection.
- **Toggle All Links**: Add or remove the `!` prefix from all wikilinks in the current note.

## Usage

### Commands

This plugin provides two commands:

1.  **Toggle transclusion on current selected wikilink(s)**:
    -   Place your cursor anywhere inside a wikilink (e.g., `[[My Note]]` or `![[My Note]]`).
    -   Run the command to toggle the `!` prefix.
    -   `[[My Note]]` -> `![[My Note]]`
    -   `![[My Note]]` -> `[[My Note]]`

2.  **Toggle transclusion on all wikilinks in note**:
    -   Run the command to toggle the `!` prefix for *every* wikilink in the current active note.

### Hotkeys

To use these features efficiently, you should assign hotkeys:

1.  Open **Settings** -> **Hotkeys**.
2.  Search for "Transclusion Toggler".
3.  Assign your preferred key combinations (e.g., `Ctrl+Shift+T` for current link, `Ctrl+Shift+A` for all links).

## Installation

### Manually

1.  Download the latest release (`main.js`, `manifest.json`, `styles.css`).
2.  Create a folder named `transclusion-toggler` in your vault's plugin directory: `<VaultFolder>/.obsidian/plugins/transclusion-toggler/`.
3.  Copy the downloaded files into that folder.
4.  Reload Obsidian.
5.  Enable "Transclusion Toggler" in **Settings** -> **Community plugins**.

## Development

If you want to modify this plugin:

1.  Clone the repository.
2.  Run `npm install` to install dependencies.
3.  Run `npm run build` to compile the TypeScript code to `main.js`.
4.  Run `npm run dev` to start compilation in watch mode.
