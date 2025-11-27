# JSDoc Swagger SmartFold

A VS Code extension that automatically detects, folds, and validates `@swagger` blocks within JSDoc comments in JavaScript and TypeScript files.

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

## Configuration

This extension contributes the following settings:

*   `swaggerFold.autoFold`: (boolean) Enable/disable automatic folding of Swagger blocks when opening a file. Default: `true`.

## Development

### Building

1.  Clone the repository.
2.  Run `npm install` to install dependencies.
3.  Run `npm run compile` to build the source.

### Running

1.  Open the project in VS Code.
2.  Press `F5` to launch the extension in a new Extension Development Host window.

## Requirements

*   VS Code 1.80.0 or higher.

---
**Enjoy writing documented APIs!**

