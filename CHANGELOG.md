# Changelog

All notable changes to the **JSDoc Swagger SmartFold** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.6] - 2024-12-01

### Added
- **Add Tags Command** (`swaggerFold.addTags`) - New refactoring action to add tags to Swagger endpoints via input dialog
- **Local Swagger UI** - Swagger UI assets are now bundled locally instead of loading from CDN, improving security and offline support
- **Exclude Pattern Support in Export** - Export commands now respect `swaggerFold.exclude` configuration patterns

### Changed
- **Webview Security Hardening**:
  - Implemented strict Content Security Policy (CSP) with nonce-based script execution
  - Added JSON serialization with XSS-safe character escaping
  - Added spec sanitization to prevent prototype pollution and dangerous URL schemes
  - Disabled external requests in Swagger UI
  - Restricted webview resource loading to extension's `media/` folder

### Fixed
- Fixed test syntax issues in `swaggerBlockDetection.test.ts`
- Strengthened test VS Code stubs with real line/column math and added multi-block range/validation coverage to catch folding/diagnostic regressions

---

## [0.0.5] - 2024-11-29

### Fixed
- Fixed toggle fold from CodeLens not working correctly
- CodeLens now passes the block reference directly to the toggle fold command

---

## [0.0.4] - 2024-11-29

### Fixed
- Fixed OpenAPI validation error for `components` blocks
- Root-level OpenAPI properties are now correctly placed at document root

---

## [0.0.3] - 2024-11-28

### Added
- Support for `@openapi` tag in addition to `@swagger`
- Vue and Svelte files support
- CodeLens with endpoint info, parameters count, and response codes
- Hover preview for Swagger blocks
- Quick fixes for missing responses, summary, operationId
- Export to YAML/JSON
- Swagger UI preview panel
- Navigation commands (next/previous block)
- Status bar indicator

### Changed
- Improved block detection and validation
- Enhanced performance with caching

---

## [0.0.2] - 2024-11-27

### Added
- Configuration options: `exclude`, `validationSeverity`, `autoFoldDelay`, `exportFormat`
- Keyboard shortcuts for all commands
- Context menu integration

---

## [0.0.1] - 2024-11-26

### Added
- Initial release
- Auto-detection and folding of `@swagger` JSDoc blocks
- YAML and OpenAPI 3.0 validation
- Support for JavaScript, TypeScript, JSX, and TSX files
- Configuration: `autoFold`, `highlight`

---

[0.0.6]: https://github.com/maxicuyo94/jsdoc-swagger-smartfold/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/maxicuyo94/jsdoc-swagger-smartfold/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/maxicuyo94/jsdoc-swagger-smartfold/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/maxicuyo94/jsdoc-swagger-smartfold/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/maxicuyo94/jsdoc-swagger-smartfold/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/maxicuyo94/jsdoc-swagger-smartfold/releases/tag/v0.0.1
