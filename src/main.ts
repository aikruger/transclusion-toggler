import { App, Plugin, PluginSettingTab, Setting, Editor } from 'obsidian';

// Interface for link data
interface WikiLink {
  fullText: string;
  hasTransclusion: boolean;
  path: string;
  startLine: number;
  startCh: number;
  endCh: number;
}

export default class TransclusionTogglerPlugin extends Plugin {
  async onload() {
    console.debug('Transclusion Toggler plugin loaded');

    // Command 1: Toggle transclusion - selection or current link or nearest
    this.addCommand({
      id: 'toggle-current-link',
      name: 'Toggle transclusion on current/selected wikilinks',
      editorCallback: (editor: Editor) => {
        this.toggleCurrentOrSelected(editor);
      }
    });

    // Command 2: Toggle transclusion on all links
    this.addCommand({
      id: 'toggle-all-links',
      name: 'Toggle transclusion on all wikilinks in note',
      editorCallback: (editor: Editor) => {
        this.toggleAllLinks(editor);
      }
    });

    this.addSettingTab(new TransclusionTogglerSettingTab(this.app, this));
  }

  onunload() {
    console.debug('Transclusion Toggler plugin unloaded');
  }

  // ===== CORE METHOD 1: Toggle with selection awareness =====
  toggleCurrentOrSelected(editor: Editor): void {
    const selection = editor.getSelection();

    // CASE 1: User has text selected
    if (selection.length > 0) {
      this.toggleLinksInSelection(editor);
      return;
    }

    // CASE 2 & 3: No selection - check cursor position
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);
    const link = this.findLinkAtCursor(line, cursor.ch);

    if (link) {
      // CASE 2: Cursor is on a wikilink
      const toggled = this.toggleLink(link);
      editor.replaceRange(
        toggled,
        { line: cursor.line, ch: link.startCh },
        { line: cursor.line, ch: link.endCh }
      );
    } else {
      // CASE 3: Cursor not on link - find nearest wikilink
      const nearestLink = this.findNearestLink(editor, cursor.line, cursor.ch);
      if (nearestLink) {
        const toggled = this.toggleLink(nearestLink.link);
        editor.replaceRange(
          toggled,
          { line: nearestLink.line, ch: nearestLink.link.startCh },
          { line: nearestLink.line, ch: nearestLink.link.endCh }
        );
      } else {
        console.debug('No wikilink found at cursor or nearby');
      }
    }
  }

  // ===== HELPER: Toggle all links within selection =====
  toggleLinksInSelection(editor: Editor): void {
    const anchor = editor.getCursor('anchor');
    const head = editor.getCursor('head');

    // Normalize so start < end
    const startLine = Math.min(anchor.line, head.line);
    const endLine = Math.max(anchor.line, head.line);

    const startCh = anchor.line < head.line ? anchor.ch : Math.min(anchor.ch, head.ch);
    const endCh = anchor.line < head.line ? Number.MAX_SAFE_INTEGER : Math.max(anchor.ch, head.ch);

    const fullText = editor.getValue();
    const lines = fullText.split('\n');
    let replacements: Array<{ from: EditorPos; to: EditorPos; text: string }> = [];

    lines.forEach((line, lineIndex) => {
      // Check if this line is within selection range
      if (lineIndex < startLine || lineIndex > endLine) {
        return;
      }

      const links = this.findAllLinksInLine(line);

      // Filter links that fall within selection bounds
      const selectedLinks = links.filter((link) => {
        if (lineIndex === startLine && lineIndex === endLine) {
          return link.startCh >= startCh && link.endCh <= endCh;
        } else if (lineIndex === startLine) {
          return link.startCh >= startCh;
        } else if (lineIndex === endLine) {
          return link.endCh <= endCh;
        }
        return true; // Entire line is in selection
      });

      // Process in reverse order to avoid position shifting
      selectedLinks.reverse().forEach((link) => {
        const toggled = this.toggleLink(link);
        replacements.push({
          from: { line: lineIndex, ch: link.startCh },
          to: { line: lineIndex, ch: link.endCh },
          text: toggled
        });
      });
    });

    // Apply replacements (already in reverse order per line)
    replacements.forEach((replacement) => {
      editor.replaceRange(replacement.text, replacement.from, replacement.to);
    });
  }

  // ===== HELPER: Find nearest wikilink from cursor =====
  findNearestLink(editor: Editor, cursorLine: number, cursorCh: number): { line: number; link: WikiLink } | null {
    const fullText = editor.getValue();
    const lines = fullText.split('\n');

    // First, search forward from cursor line
    for (let i = cursorLine; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;
      const links = this.findAllLinksInLine(line);

      for (const link of links) {
        if (i === cursorLine) {
          // On cursor line: only consider links after cursor
          if (link.startCh >= cursorCh) {
            return { line: i, link };
          }
        } else {
          // After cursor line: take first link
          return { line: i, link };
        }
      }
    }

    // Search backward from cursor line
    for (let i = cursorLine; i >= 0; i--) {
      const line = lines[i];
      if (line === undefined) continue;
      const links = this.findAllLinksInLine(line);

      for (let j = links.length - 1; j >= 0; j--) {
        const link = links[j];
        if (!link) continue;
        if (i === cursorLine) {
          // On cursor line: only consider links before cursor
          if (link.endCh <= cursorCh) {
            return { line: i, link };
          }
        } else {
          // Before cursor line: take last link
          return { line: i, link };
        }
      }
    }

    return null;
  }

  // ===== CORE METHOD 2: Toggle all links in document =====
  toggleAllLinks(editor: Editor): void {
    const fullText = editor.getValue();
    const lines = fullText.split('\n');

    const newLines = lines.map((line) => {
      const matches = this.findAllLinksInLine(line);
      matches.reverse();

      let newLine = line;
      matches.forEach((link) => {
        const toggled = this.toggleLink(link);
        newLine = newLine.substring(0, link.startCh) + toggled + newLine.substring(link.endCh);
      });

      return newLine;
    });

    const lastLine = editor.lastLine();
    const lastCh = editor.getLine(lastLine).length;
    const modifiedText = newLines.join('\n');

    editor.replaceRange(
      modifiedText,
      { line: 0, ch: 0 },
      { line: lastLine, ch: lastCh }
    );
  }

  // ===== HELPER: Find link under cursor =====
  private findLinkAtCursor(line: string, cursorCh: number): WikiLink | null {
    const wikiLinkPattern = /!?\[\[[^\]]+\]\]/g;
    let match;

    while ((match = wikiLinkPattern.exec(line)) !== null) {
      const startCh = match.index;
      const endCh = match.index + match[0].length;

      if (cursorCh >= startCh && cursorCh <= endCh) {
        return this.parseWikiLink(match[0], startCh, endCh);
      }
    }

    return null;
  }

  // ===== HELPER: Find all links in a single line =====
  private findAllLinksInLine(line: string): WikiLink[] {
    const wikiLinkPattern = /!?\[\[[^\]]+\]\]/g;
    const links: WikiLink[] = [];
    let match;

    while ((match = wikiLinkPattern.exec(line)) !== null) {
      const startCh = match.index;
      const endCh = match.index + match[0].length;
      links.push(this.parseWikiLink(match[0], startCh, endCh));
    }

    return links;
  }

  // ===== HELPER: Parse wikilink structure =====
  private parseWikiLink(fullText: string, startCh: number, endCh: number): WikiLink {
    const hasTransclusion = fullText.startsWith('!');
    const path = fullText.slice(hasTransclusion ? 3 : 2, -2);

    return {
      fullText,
      hasTransclusion,
      path,
      startLine: 0,
      startCh,
      endCh
    };
  }

  // ===== CORE TRANSFORMER: Toggle the link =====
  private toggleLink(link: WikiLink): string {
    if (link.hasTransclusion) {
      return `[[${link.path}]]`;
    } else {
      return `![[${link.path}]]`;
    }
  }
}

// ===== SETTINGS TAB =====
class TransclusionTogglerSettingTab extends PluginSettingTab {
  plugin: TransclusionTogglerPlugin;

  constructor(app: App, plugin: TransclusionTogglerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Feature status')
      // eslint-disable-next-line obsidianmd/ui/sentence-case
      .setDesc('Transclusion Toggler is active with selection-aware toggling');
  }
}

// Type definition for editor positions in replacements
interface EditorPos {
  line: number;
  ch: number;
}