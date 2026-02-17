# Changelog

All notable changes to the **JSDoc Swagger SmartFold** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.7] - 2025-02-17

### Security
- **Nonce generation** — replaced `Math.random()` with `crypto.randomBytes()` for cryptographically secure CSP nonces
- **Webview spec embedding** — switched to `<script type="application/json">` for safe OpenAPI spec serialization, eliminating eval-based injection risks

### Fixed
- **Glob matching** — `isFileExcluded` now properly escapes regex special characters (e.g. dots in `*.min.js`) before converting glob patterns
- **LRU cache** — `DocumentCache.get()` now moves accessed entries to the end, making eviction truly least-recently-used
- **Exporter merge** — all `components` sub-keys (schemas, parameters, responses, securitySchemes, etc.) are now merged when exporting, not just schemas
- **Code actions indentation** — quick fixes now detect the actual JSDoc indentation instead of using hardcoded spaces

### Changed
- **`autoFoldDelay` wired up** — the `swaggerFold.autoFoldDelay` config setting now controls the validation debounce delay
- **Debounced status bar & CodeLens** — `updateStatusBar` and `codeLensProvider.refresh` are now debounced on document change to reduce unnecessary work
- **Unified merge logic** — extracted shared `mergeBlocksToOpenApi()` in `swaggerUtils.ts`, replacing duplicate code in `preview.ts` and `exporter.ts`
- **`DOCUMENT_SELECTORS` constant** — eliminated duplicated language selector arrays across `codeLens.ts`, `hoverProvider.ts`, and `codeActions.ts`
- **Removed unnecessary `async`** from `handleNextBlock` / `handlePreviousBlock` (no awaits)
- **`dotenv` moved to devDependencies** — it is only used by `scripts/release.js`, not at runtime

### Added
- **New test suite** (`test/utils.test.ts`) — 22 tests covering `isFileExcluded`, `DocumentCache` (including LRU behavior), `debounce`, and `extractEndpointInfo`

---

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

[0.0.7]: https://github.com/maxicuyo94/jsdoc-swagger-smartfold/compare/v0.0.6...v0.0.7
[0.0.6]: https://github.com/maxicuyo94/jsdoc-swagger-smartfold/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/maxicuyo94/jsdoc-swagger-smartfold/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/maxicuyo94/jsdoc-swagger-smartfold/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/maxicuyo94/jsdoc-swagger-smartfold/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/maxicuyo94/jsdoc-swagger-smartfold/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/maxicuyo94/jsdoc-swagger-smartfold/releases/tag/v0.0.1
