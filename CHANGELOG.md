# Changelog

All notable changes to the **JSDoc Swagger SmartFold** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- (Features to be added in the next release)

### Changed
- (Changes to existing features)

### Fixed
- (Bug fixes)

### Removed
- (Removed features)

---

## [0.0.5] - 2024-11-29

### Fixed
- Fixed toggle fold from CodeLens not working correctly - blocks were unfolding immediately after folding
- CodeLens now passes the block reference directly to the toggle fold command instead of relying on cursor position

---

## [0.0.4] - 2024-11-29

### Fixed
- Fixed OpenAPI validation error for `components` blocks: `#/paths must NOT have additional properties`
- Root-level OpenAPI properties (`components`, `tags`, `security`, etc.) are now correctly identified and placed at document root instead of being incorrectly added to `paths`

---

## [0.1.0] - 2024-XX-XX

### Added

#### New Tag Support
- Support for `@openapi` tag in addition to `@swagger`

#### New Language Support
- Vue (`.vue`) files support
- Svelte (`.svelte`) files support

#### New Commands
- **Unfold Swagger Blocks** (`swaggerFold.unfoldNow`) - Unfold all Swagger blocks in the current file
- **Toggle Fold at Cursor** (`swaggerFold.toggleFold`) - Toggle fold for the block at cursor position
- **Go to Next Swagger Block** (`swaggerFold.nextBlock`) - Navigate to the next Swagger block
- **Go to Previous Swagger Block** (`swaggerFold.previousBlock`) - Navigate to the previous Swagger block
- **Export Swagger to File** (`swaggerFold.exportToFile`) - Export current file's Swagger blocks to OpenAPI document
- **Export All Project Swagger** (`swaggerFold.exportProject`) - Export all project Swagger blocks to OpenAPI document
- **Copy Swagger Block as JSON** (`swaggerFold.copyAsJson`) - Copy current block as JSON to clipboard
- **Preview Swagger UI** (`swaggerFold.preview`) - Open Swagger UI preview in a side panel

#### CodeLens
- Inline endpoint information (HTTP method + path) above each Swagger block
- Parameters count display
- Response status codes display
- Quick action to copy block as JSON

#### Hover Preview
- Formatted preview when hovering over `@swagger` or `@openapi` tags
- Shows summary, description, tags, parameters, and responses
- Truncated YAML preview for large blocks

#### Quick Fixes (Code Actions)
- Add default responses to endpoint
- Add summary field
- Add operationId
- Type correction suggestions for invalid types

#### Status Bar
- Swagger block count indicator in status bar
- Click to fold all blocks

#### Export Feature
- Export to YAML or JSON format (configurable)
- Merge all blocks into valid OpenAPI 3.0.3 document
- Auto-generate info section
- Collect and merge tags from all endpoints
- Project-wide export with progress indicator

#### Swagger UI Preview
- Live preview using Swagger UI
- Dark theme adapted to VS Code
- Side panel integration

#### New Configuration Options
- `swaggerFold.exclude` - Glob patterns to exclude files/folders from processing
- `swaggerFold.validationSeverity` - Set validation error severity (`error`, `warning`, `info`)
- `swaggerFold.autoFoldDelay` - Configurable delay before auto-folding (0-5000ms)
- `swaggerFold.exportFormat` - Default export format (`yaml` or `json`)

#### Keyboard Shortcuts
- `Ctrl+Alt+S F` / `Cmd+Alt+S F` - Fold all blocks
- `Ctrl+Alt+S U` / `Cmd+Alt+S U` - Unfold all blocks
- `Ctrl+Alt+S T` / `Cmd+Alt+S T` - Toggle fold at cursor
- `Ctrl+Alt+S ↓` / `Cmd+Alt+S ↓` - Go to next block
- `Ctrl+Alt+S ↑` / `Cmd+Alt+S ↑` - Go to previous block
- `Ctrl+Alt+S P` / `Cmd+Alt+S P` - Open Swagger UI preview

#### Context Menu
- Toggle Fold at Cursor
- Copy Swagger Block as JSON
- Preview Swagger UI

### Changed
- Improved block detection to support both `@swagger` and `@openapi` tags
- Enhanced validation with configurable severity levels
- Better performance with optimized caching

---

## [0.0.1] - 2024-XX-XX

### Added
- Initial release of JSDoc Swagger SmartFold
- Auto-detection of `@swagger` JSDoc blocks
- Automatic folding of Swagger blocks on file open
- YAML syntax validation for Swagger content
- OpenAPI 3.0 schema validation (best effort for fragments)
- Error and warning reporting in VS Code's Problems panel
- Manual fold command: `Swagger SmartFold: Fold Swagger Blocks`
- Configuration option: `swaggerFold.autoFold` to toggle auto-folding
- Configuration option: `swaggerFold.highlight` for visual distinction
- Support for JavaScript, TypeScript, JSX, and TSX files

---

## Version History Summary

| Version | Date | Highlights |
|---------|------|------------|
| 0.1.0 | TBD | Major feature update: CodeLens, Hover, Quick Fixes, Export, Preview, Navigation |
| 0.0.1 | TBD | Initial release |

---

## Upgrade Guide

### From 0.0.1 to 0.1.0

No breaking changes. All new features are additive.

New configuration options have sensible defaults:
- `swaggerFold.exclude`: `[]` (no exclusions)
- `swaggerFold.validationSeverity`: `"warning"`
- `swaggerFold.autoFoldDelay`: `300`
- `swaggerFold.exportFormat`: `"yaml"`

### From 0.x to 1.0

(To be documented when 1.0 is released)

---

## Links

- [GitHub Repository](https://github.com/tu-usuario/jsdoc-swagger-smartfold)
- [VS Marketplace](https://marketplace.visualstudio.com/items?itemName=tu-publisher-id.jsdoc-swagger-smartfold)
- [Open VSX](https://open-vsx.org/extension/tu-publisher-id/jsdoc-swagger-smartfold)
- [Report Issues](https://github.com/tu-usuario/jsdoc-swagger-smartfold/issues)

[Unreleased]: https://github.com/tu-usuario/jsdoc-swagger-smartfold/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/tu-usuario/jsdoc-swagger-smartfold/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/tu-usuario/jsdoc-swagger-smartfold/releases/tag/v0.0.1
