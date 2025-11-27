# JSDoc Swagger SmartFold

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/tu-publisher-id.jsdoc-swagger-smartfold?label=VS%20Marketplace&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=tu-publisher-id.jsdoc-swagger-smartfold)
[![Open VSX](https://img.shields.io/open-vsx/v/tu-publisher-id/jsdoc-swagger-smartfold?label=Open%20VSX)](https://open-vsx.org/extension/tu-publisher-id/jsdoc-swagger-smartfold)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A VS Code extension that automatically detects, folds, and validates `@swagger` blocks within JSDoc comments in JavaScript and TypeScript files.

---

## Features

### 🔍 Auto-Detection & Folding
Automatically detects JSDoc comments containing the `@swagger` tag and folds them when you open a file. This keeps your code clean and readable while keeping your API documentation close to the code.

### ✅ Validation
Validates the content of your Swagger/OpenAPI definitions:
*   **YAML Syntax Check**: Ensures valid YAML structure.
*   **OpenAPI Schema Validation**: Checks against OpenAPI 3.0 specification (best effort for fragments).
*   **Error Reporting**: Displays errors and warnings directly in VS Code's "Problems" panel.

### 🛠 Manual Control
*   **Command**: `Swagger SmartFold: Fold Swagger Blocks` (`swaggerFold.foldNow`) to manually fold all blocks in the current file.
*   **Configuration**: Toggle auto-folding on/off.

---

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for "JSDoc Swagger SmartFold"
4. Click **Install**

Or run:
```bash
code --install-extension tu-publisher-id.jsdoc-swagger-smartfold
```

### From Open VSX (VSCodium, Gitpod, etc.)

```bash
code --install-extension tu-publisher-id.jsdoc-swagger-smartfold
```

---

## Usage

1.  Open any `.js`, `.ts`, `.jsx`, or `.tsx` file.
2.  Add a JSDoc block with `@swagger`:

```javascript
/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Returns a list of users.
 *     description: Optional description.
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

3.  The block will automatically fold (if enabled).
4.  If there are syntax errors in your YAML or OpenAPI definition, they will appear in the Problems panel.

---

## Configuration

This extension contributes the following settings:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `swaggerFold.autoFold` | boolean | `true` | Auto-fold @swagger JSDoc blocks when opening a file |
| `swaggerFold.highlight` | boolean | `true` | Enable/disable syntax highlighting for Swagger blocks |

---

## 💖 Support the Project — PRO Version ($1)

**JSDoc Swagger SmartFold** is free and open-source. The FREE version is fully functional and will always remain so.

If you find this extension useful and want to support its development, consider getting the **PRO version for just $1**. It's a symbolic way to say "thanks" and help keep the project alive!

<p align="center">
  <a href="https://example.com/buy-pro">
    <img src="https://img.shields.io/badge/Get%20PRO-$1%20USD-ff6b6b?style=for-the-badge&logo=heart&logoColor=white" alt="Get PRO Version - $1 USD">
  </a>
</p>

### What's included in PRO?

| Feature | FREE | PRO ($1) |
|---------|:----:|:--------:|
| Auto-fold @swagger blocks | ✅ | ✅ |
| YAML syntax validation | ✅ | ✅ |
| OpenAPI schema validation | ✅ | ✅ |
| Manual fold command | ✅ | ✅ |
| Visual highlighting | ✅ | ✅ |
| Priority support via email | ❌ | ✅ |
| Early access to new features | ❌ | ✅ |
| Name in supporters list | ❌ | ✅ |
| Good karma & warm fuzzy feeling | ❌ | ✅ |

> **Note:** The PRO version is primarily a way to support the project. All core features are available in the FREE version.

### How to Install PRO Version

1. **Purchase** the PRO version from [our store](https://example.com/buy-pro)
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

---

## Requirements

*   VS Code 1.80.0 or higher.

---

## Support & Contact

### Found a bug? Have a feature request?

- 🐛 **Report bugs:** [GitHub Issues](https://github.com/tu-usuario/jsdoc-swagger-smartfold/issues)
- 💡 **Feature requests:** [GitHub Discussions](https://github.com/tu-usuario/jsdoc-swagger-smartfold/discussions)
- 📧 **Email support (PRO):** support@example.com

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
  <a href="https://example.com/buy-pro">
    <img src="https://img.shields.io/badge/Support%20this%20project-$1-ff6b6b?style=flat-square" alt="Support this project">
  </a>
</p>

---

**Enjoy writing documented APIs!**
