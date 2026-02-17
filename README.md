# JSDoc Swagger SmartFold

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/maxicuyodev.jsdoc-swagger-smartfold?label=VS%20Marketplace&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=maxicuyodev.jsdoc-swagger-smartfold)
[![Open VSX](https://img.shields.io/open-vsx/v/maxicuyodev/jsdoc-swagger-smartfold?label=Open%20VSX)](https://open-vsx.org/extension/maxicuyodev/jsdoc-swagger-smartfold)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A VS Code extension that automatically detects, folds, validates, and provides rich features for `@swagger` and `@openapi` blocks within JSDoc comments in JavaScript and TypeScript files.

---

## Features

### 🔍 Auto-Detection & Folding
Automatically detects JSDoc comments containing the `@swagger` or `@openapi` tag and folds them when you open a file. This keeps your code clean and readable while keeping your API documentation close to the code.

### ✅ Validation
Validates the content of your Swagger/OpenAPI definitions:
*   **YAML Syntax Check**: Ensures valid YAML structure.
*   **OpenAPI Schema Validation**: Checks against OpenAPI 3.0/3.1 specification (best effort for fragments).
*   **Error Reporting**: Displays errors and warnings directly in VS Code's "Problems" panel.
*   **Configurable Severity**: Set validation errors as `error`, `warning`, or `info`.

### 🏷️ CodeLens
Inline information displayed above each Swagger block:
*   **Endpoint Info**: Shows HTTP method and path (e.g., `GET /api/users`)
*   **Parameters Count**: Number of parameters defined
*   **Response Codes**: List of response status codes
*   **Quick Actions**: Copy as JSON with one click

### 💡 Hover Preview
Hover over `@swagger` or `@openapi` tags to see a formatted preview:
*   Summary and description
*   Tags
*   Parameters count
*   Response codes
*   YAML preview (truncated for large blocks)

### 🔧 Quick Fixes
Automatic code actions for common issues:
*   Add default responses
*   Add summary field
*   Add operationId
*   Fix invalid types

### 📊 Status Bar
*   Shows count of Swagger blocks in current file
*   Click to fold all blocks

### 🚀 Navigation
*   **Next Block**: Jump to the next Swagger block
*   **Previous Block**: Jump to the previous Swagger block
*   **Toggle Fold**: Fold/unfold the block at cursor

### 📤 Export
*   **Export Current File**: Combine all Swagger blocks from current file into a single OpenAPI document
*   **Export Project**: Scan entire project and export all Swagger blocks
*   **Copy as JSON**: Copy current block as JSON to clipboard
*   **Format Options**: Export as YAML or JSON

### 👁️ Swagger UI Preview
*   Live preview of your API documentation using Swagger UI
*   Dark theme adapted to VS Code
*   Opens in a side panel

---

## Supported Languages

| Language | File Extensions |
|----------|-----------------|
| JavaScript | `.js` |
| TypeScript | `.ts` |
| JavaScript React | `.jsx` |
| TypeScript React | `.tsx` |
| Vue | `.vue` |
| Svelte | `.svelte` |

---

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for "JSDoc Swagger SmartFold"
4. Click **Install**

Or run:
```bash
code --install-extension maxicuyodev.jsdoc-swagger-smartfold
```

### From Open VSX (VSCodium, Gitpod, etc.)

```bash
code --install-extension maxicuyodev.jsdoc-swagger-smartfold
```

### Official Downloads

- **Visual Studio Marketplace:** [VS Marketplace](https://marketplace.visualstudio.com/items?itemName=maxicuyodev.jsdoc-swagger-smartfold)
- **Open VSX:** [Open VSX](https://open-vsx.org/extension/maxicuyodev/jsdoc-swagger-smartfold)

---

## Usage

1.  Open any supported file (`.js`, `.ts`, `.jsx`, `.tsx`, `.vue`, `.svelte`).
2.  Add a JSDoc block with `@swagger` or `@openapi`:

```javascript
/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Returns a list of users.
 *     description: Optional description.
 *     tags:
 *       - Users
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: A JSON array of user names
 *         content:
 *           application/json:
 *             schema: 
 *               type: array
 *               items: 
 *                 type: string
 */
app.get('/api/users', (req, res) => { ... });
```

Or using `@openapi`:

```javascript
/**
 * @openapi
 * /api/products/{id}:
 *   get:
 *     summary: Get product by ID
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product details
 *       404:
 *         description: Product not found
 */
app.get('/api/products/:id', (req, res) => { ... });
```

3.  The block will automatically fold (if enabled).
4.  CodeLens will show endpoint info above the block.
5.  Hover over `@swagger`/`@openapi` to see a preview.
6.  If there are syntax errors, they will appear in the Problems panel with Quick Fix suggestions.

---

## Commands

All commands are available via the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | Description | Keyboard Shortcut |
|---------|-------------|-------------------|
| `Swagger SmartFold: Fold Swagger Blocks` | Fold all Swagger blocks | `Ctrl+Alt+S F` |
| `Swagger SmartFold: Unfold Swagger Blocks` | Unfold all Swagger blocks | `Ctrl+Alt+S U` |
| `Swagger SmartFold: Toggle Fold at Cursor` | Toggle fold for block at cursor | `Ctrl+Alt+S T` |
| `Swagger SmartFold: Go to Next Swagger Block` | Navigate to next block | `Ctrl+Alt+S ↓` |
| `Swagger SmartFold: Go to Previous Swagger Block` | Navigate to previous block | `Ctrl+Alt+S ↑` |
| `Swagger SmartFold: Export Swagger to File` | Export current file's blocks | - |
| `Swagger SmartFold: Export All Project Swagger to File` | Export all project blocks | - |
| `Swagger SmartFold: Copy Swagger Block as JSON` | Copy current block as JSON | - |
| `Swagger SmartFold: Preview Swagger UI` | Open Swagger UI preview | `Ctrl+Alt+S P` |

> **Note:** On macOS, use `Cmd` instead of `Ctrl`.

---

## Context Menu

Right-click inside a supported file to access:
*   Toggle Fold at Cursor
*   Copy Swagger Block as JSON
*   Preview Swagger UI

---

## Configuration

This extension contributes the following settings:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `swaggerFold.autoFold` | boolean | `true` | Auto-fold @swagger/@openapi JSDoc blocks when opening a file |
| `swaggerFold.highlight` | boolean | `true` | Enable/disable syntax highlighting for Swagger blocks |
| `swaggerFold.exclude` | array | `[]` | Glob patterns for files/folders to exclude (e.g., `["**/test/**", "**/node_modules/**"]`) |
| `swaggerFold.validationSeverity` | string | `"warning"` | Severity level for OpenAPI validation errors (`"error"`, `"warning"`, `"info"`) |
| `swaggerFold.autoFoldDelay` | number | `300` | Delay in milliseconds before auto-folding blocks (0-5000) |
| `swaggerFold.exportFormat` | string | `"yaml"` | Default format for exporting OpenAPI documents (`"yaml"`, `"json"`) |

### Example Settings

```json
{
  "swaggerFold.autoFold": true,
  "swaggerFold.highlight": true,
  "swaggerFold.exclude": [
    "**/test/**",
    "**/node_modules/**",
    "**/*.spec.ts"
  ],
  "swaggerFold.validationSeverity": "warning",
  "swaggerFold.autoFoldDelay": 500,
  "swaggerFold.exportFormat": "yaml"
}
```

---

## Export Feature

### Export Current File

1. Open a file with Swagger blocks
2. Run command `Swagger SmartFold: Export Swagger to File`
3. Choose save location
4. File will be created with all blocks merged into a valid OpenAPI document

### Export Entire Project

1. Run command `Swagger SmartFold: Export All Project Swagger to File`
2. Extension will scan all supported files in the workspace
3. Choose save location
4. All Swagger blocks from the project will be merged into a single OpenAPI document

### Output Format

The exported document includes:
*   OpenAPI 3.0.3 specification
*   Auto-generated info section
*   All paths merged from blocks
*   Components (schemas, parameters, responses, securitySchemes, etc.) if defined
*   Tags collected from all endpoints
*   Servers, security, and externalDocs if present

---

## 💖 Support the Project

**JSDoc Swagger SmartFold** is free and open-source. The FREE version is fully functional and will always remain so.

If you find this extension useful and want to support its development, you can:

<p align="center">
  <a href="https://cafecito.app/maxxwer">
    <img src="https://img.shields.io/badge/Invitame%20un%20Cafecito-☕-6f4e37?style=for-the-badge" alt="Invitame un Cafecito">
  </a>
  &nbsp;&nbsp;
  <a href="https://maxibee7.gumroad.com/l/JSDocSwaggerSmartFoldPRO">
    <img src="https://img.shields.io/badge/Get%20PRO-$1%20USD-ff6b6b?style=for-the-badge&logo=heart&logoColor=white" alt="Get PRO Version - $1 USD">
  </a>
</p>

### ☕ Buy me a Cafecito

If you're from Argentina or just want to send a quick tip, you can [invite me a cafecito](https://cafecito.app/maxxwer)! It's a simple way to say thanks.

### 🎁 PRO Version ($1)

### What's included in PRO?

| Feature | FREE | PRO ($1) |
|---------|:----:|:--------:|
| Auto-fold @swagger/@openapi blocks | ✅ | ✅ |
| YAML syntax validation | ✅ | ✅ |
| OpenAPI schema validation | ✅ | ✅ |
| Manual fold/unfold commands | ✅ | ✅ |
| Visual highlighting | ✅ | ✅ |
| CodeLens with endpoint info | ✅ | ✅ |
| Hover preview | ✅ | ✅ |
| Quick Fixes | ✅ | ✅ |
| Navigation commands | ✅ | ✅ |
| Export to file | ✅ | ✅ |
| Swagger UI preview | ✅ | ✅ |
| Status bar indicator | ✅ | ✅ |
| Priority support via email | ❌ | ✅ |
| Early access to new features | ❌ | ✅ |
| Name in supporters list | ❌ | ✅ |
| Good karma & warm fuzzy feeling | ❌ | ✅ |

> **Note:** The PRO version is primarily a way to support the project. All core features are available in the FREE version.

### How to Install PRO Version

1. **Purchase** the PRO version from [Gumroad](https://maxibee7.gumroad.com/l/JSDocSwaggerSmartFoldPRO)
2. **Download** the `.vsix` file from the purchase confirmation page
3. **Install** manually in VS Code:

```bash
code --install-extension jsdoc-swagger-smartfold-pro-X.Y.Z.vsix
```

Or in VS Code:
- Press `Ctrl+Shift+P` / `Cmd+Shift+P`
- Type "Extensions: Install from VSIX..."
- Select the downloaded `.vsix` file

---

## Development

### Building

1.  Clone the repository.
2.  Run `npm install` to install dependencies.
3.  Run `npm run compile` to build the source.

### Running

1.  Open the project in VS Code.
2.  Press `F5` to launch the extension in a new Extension Development Host window.

### Scripts

| Script | Description |
|--------|-------------|
| `npm run compile` | Compile TypeScript to JavaScript |
| `npm run watch` | Watch for changes and recompile |
| `npm run lint` | Run ESLint |
| `npm run package` | Create .vsix package |
| `npm run publish:vs` | Publish to VS Marketplace |
| `npm run publish:ovsx` | Publish to Open VSX |
| `npm run publish:all` | Publish to both marketplaces |
| `npm test` | Run tests (compile + lint + node test runner) |

### Project Structure

```
src/
├── extension.ts      # Main extension entry point
├── constants.ts      # Constants, commands, and configuration
├── swaggerUtils.ts   # Swagger block detection, validation, and merge logic
├── decorator.ts      # Visual decorations for blocks
├── codeLens.ts       # CodeLens provider
├── hoverProvider.ts  # Hover information provider
├── codeActions.ts    # Quick Fix code actions
├── statusBar.ts      # Status bar indicator
├── exporter.ts       # Export functionality
├── preview.ts        # Swagger UI preview webview
└── utils.ts          # Utility functions (debounce, LRU cache)
test/
├── setup.ts                      # Mock vscode module for tests
├── swaggerBlockDetection.test.ts # Block detection & validation tests
├── codeActions.test.ts           # Code actions tests
└── utils.test.ts                 # Glob matching, cache, debounce, endpoint info tests
```

---

## Requirements

*   VS Code 1.80.0 or higher.

---

## Support & Contact

### Found a bug? Have a feature request?

- 🐛 **Report bugs:** [GitHub Issues](https://github.com/maxicuyo94/jsdoc-swagger-smartfold/issues)
- 💡 **Feature requests:** [GitHub Issues](https://github.com/maxicuyo94/jsdoc-swagger-smartfold/issues)

### Support Policy

- **FREE users:** Community support via GitHub Issues
- **PRO users:** Priority email support within 48 hours

### Refund Policy

Due to the digital nature of this product and its symbolic pricing ($1), **refunds are generally not provided**. However, if you experience technical issues that prevent you from using the PRO version, please contact us and we'll do our best to help.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a list of changes.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with ❤️ for the developer community
</p>

<p align="center">
  <a href="https://cafecito.app/maxxwer">
    <img src="https://img.shields.io/badge/☕%20Cafecito-Support-6f4e37?style=flat-square" alt="Invitame un Cafecito">
  </a>
  &nbsp;
  <a href="https://maxibee7.gumroad.com/l/JSDocSwaggerSmartFoldPRO">
    <img src="https://img.shields.io/badge/PRO-$1-ff6b6b?style=flat-square" alt="Get PRO">
  </a>
</p>

---

**Enjoy writing documented APIs!**
