import { App, Plugin, PluginSettingTab, Setting, Editor, EditorPosition } from 'obsidian';

// Interface for link data
interface WikiLink {
  fullText: string;        // Complete match including brackets
  hasTransclusion: boolean; // Whether ! prefix exists
  path: string;             // Path between brackets
  startLine: number;        // Editor line number
  startCh: number;          // Character position in line
  endCh: number;            // End character position
}

export default class TransclusionTogglerPlugin extends Plugin {
  async onload() {
    console.log('Transclusion Toggler plugin loaded');

    // Command 1: Toggle transclusion on current link
    this.addCommand({
      id: 'toggle-current-link',
      name: 'Toggle transclusion on current wikilink',
      editorCallback: (editor: Editor) => {
        this.toggleCurrentLink(editor);
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

    // Optional: Add settings tab if needed for future configuration
    this.addSettingTab(new TransclusionTogglerSettingTab(this.app, this));
  }

  onunload() {
    console.log('Transclusion Toggler plugin unloaded');
  }

  // CORE METHOD 1: Toggle link under cursor
  toggleCurrentLink(editor: Editor): void {
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);

    // Find wikilink at cursor position
    const link = this.findLinkAtCursor(line, cursor.ch);

    if (!link) {
      // Show visual feedback - optional toast notification
      console.log('No wikilink found at cursor position');
      return;
    }

    // Toggle the link
    const toggled = this.toggleLink(link);

    // Replace in editor
    editor.replaceRange(toggled,
      { line: cursor.line, ch: link.startCh },
      { line: cursor.line, ch: link.endCh }
    );
  }

  // CORE METHOD 2: Toggle all links in document
  toggleAllLinks(editor: Editor): void {
    const fullText = editor.getValue();

    // Split by lines to track line numbers
    const lines = fullText.split('\n');

    const newLines = lines.map((line) => {
      const matches = this.findAllLinksInLine(line);

      // Sort matches in reverse to avoid position shifting during replacement within the line
      matches.reverse();

      let newLine = line;
      matches.forEach((link) => {
        const toggled = this.toggleLink(link);
        newLine = newLine.substring(0, link.startCh) +
                      toggled +
                      newLine.substring(link.endCh);
      });
      return newLine;
    });

    // Replace entire document content
    const lastLine = editor.lastLine();
    const lastCh = editor.getLine(lastLine).length;

    const modifiedText = newLines.join('\n');

    editor.replaceRange(modifiedText,
      { line: 0, ch: 0 },
      { line: lastLine, ch: lastCh }
    );
  }

  // HELPER: Find link under cursor
  private findLinkAtCursor(line: string, cursorCh: number): WikiLink | null {
    // Regex pattern for wikilink
    const wikiLinkPattern = /!?\[\[[^\]]+\]\]/g;
    let match;

    while ((match = wikiLinkPattern.exec(line)) !== null) {
      const startCh = match.index;
      const endCh = match.index + match[0].length;

      // Check if cursor is within this link
      if (cursorCh >= startCh && cursorCh <= endCh) {
        return this.parseWikiLink(match[0], startCh, endCh);
      }
    }

    return null;
  }

  // HELPER: Find all links in a single line
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

  // HELPER: Parse wikilink structure
  private parseWikiLink(fullText: string, startCh: number, endCh: number): WikiLink {
    const hasTransclusion = fullText.startsWith('!');
    const path = fullText.slice(hasTransclusion ? 3 : 2, -2); // Extract path between [[ ]]

    return {
      fullText,
      hasTransclusion,
      path,
      startLine: 0, // Set dynamically in context
      startCh,
      endCh
    };
  }

  // CORE TRANSFORMER: Toggle the link
  private toggleLink(link: WikiLink): string {
    if (link.hasTransclusion) {
      // Remove ! prefix
      return `[[${link.path}]]`;
    } else {
      // Add ! prefix
      return `![[${link.path}]]`;
    }
  }
}

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
      .setName('Feature Status')
      .setDesc('Transclusion Toggler is active and ready to use');
  }
}
