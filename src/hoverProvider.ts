import * as vscode from 'vscode';
import { findSwaggerBlocks, SwaggerBlock } from './swaggerUtils';
import { isSupportedLanguage, SWAGGER_TAGS } from './constants';

/**
 * Hover provider for Swagger blocks
 * Shows formatted preview when hovering over @swagger or @openapi tags
 */
export class SwaggerHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
  ): vscode.Hover | null {
    if (!isSupportedLanguage(document.languageId)) {
      return null;
    }

    const line = document.lineAt(position.line).text;

    // Check if hovering over a swagger tag
    const hasSwaggerTag = SWAGGER_TAGS.some((tag) => line.includes(tag));
    if (!hasSwaggerTag) {
      return null;
    }

    // Find the block at this position
    const blocks = findSwaggerBlocks(document);
    const block = blocks.find((b) => b.range.contains(position));

    if (!block) {
      return null;
    }

    const markdown = this.createHoverContent(block);
    return new vscode.Hover(markdown, block.range);
  }

  private createHoverContent(block: SwaggerBlock): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.supportHtml = true;

    if (block.endpointInfo) {
      const { method, path, summary, description, tags, parameters, responses } = block.endpointInfo;

      // Header with method badge
      const methodColor = this.getMethodColor(method);
      md.appendMarkdown(`### \`${method}\` ${path}\n\n`);

      // Summary
      if (summary) {
        md.appendMarkdown(`**${summary}**\n\n`);
      }

      // Description
      if (description) {
        md.appendMarkdown(`${description}\n\n`);
      }

      // Tags
      if (tags && tags.length > 0) {
        md.appendMarkdown(`**Tags:** ${tags.map((t) => `\`${t}\``).join(', ')}\n\n`);
      }

      // Parameters
      if (parameters && parameters > 0) {
        md.appendMarkdown(`**Parameters:** ${parameters}\n\n`);
      }

      // Responses
      if (responses && responses.length > 0) {
        md.appendMarkdown(`**Responses:** ${responses.map((r) => `\`${r}\``).join(', ')}\n\n`);
      }

      md.appendMarkdown('---\n\n');
    }

    // YAML preview (truncated)
    const yamlPreview = this.truncateYaml(block.yamlContent, 15);
    md.appendCodeblock(yamlPreview, 'yaml');

    return md;
  }

  private getMethodColor(method: string): string {
    const colors: Record<string, string> = {
      GET: '#61affe',
      POST: '#49cc90',
      PUT: '#fca130',
      PATCH: '#50e3c2',
      DELETE: '#f93e3e',
      OPTIONS: '#0d5aa7',
      HEAD: '#9012fe',
    };
    return colors[method] || '#999999';
  }

  private truncateYaml(yaml: string, maxLines: number): string {
    const lines = yaml.split('\n');
    if (lines.length <= maxLines) {
      return yaml;
    }
    return lines.slice(0, maxLines).join('\n') + '\n# ... (truncated)';
  }
}

/**
 * Activate hover provider
 */
export function activateHoverProvider(context: vscode.ExtensionContext): void {
  const provider = new SwaggerHoverProvider();

  const disposable = vscode.languages.registerHoverProvider(
    [
      { language: 'javascript' },
      { language: 'typescript' },
      { language: 'javascriptreact' },
      { language: 'typescriptreact' },
      { language: 'vue' },
      { language: 'svelte' },
    ],
    provider,
  );

  context.subscriptions.push(disposable);
}

