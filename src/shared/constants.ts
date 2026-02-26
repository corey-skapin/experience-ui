// src/shared/constants.ts
// Application-wide constants shared between the main process and renderer.
// All values here are immutable and have no runtime side-effects.
//
// Full set of constants (CSP templates, disallowed patterns, sandbox
// message allowlists, etc.) will be populated in T009.

// ─── Layout ───────────────────────────────────────────────────────────────────

/** Default split ratio: chat panel takes 30% of available width. */
export const DEFAULT_CHAT_PANEL_WIDTH_PERCENT = 30;

/** Content area default width (complement of chat panel). */
export const DEFAULT_CONTENT_PANEL_WIDTH_PERCENT = 70;

/** Minimum chat panel width as % of total layout width. */
export const MIN_CHAT_PANEL_WIDTH_PERCENT = 15;

/** Maximum chat panel width as % of total layout width. */
export const MAX_CHAT_PANEL_WIDTH_PERCENT = 85;

// ─── CLI / Process ────────────────────────────────────────────────────────────

/** Maximum number of automatic CLI restart attempts before giving up. */
export const MAX_CLI_RESTART_RETRIES = 5;

/** Timeout in milliseconds for a single CLI request before considering it failed. */
export const CLI_REQUEST_TIMEOUT_MS = 30_000;

// ─── Versioning ───────────────────────────────────────────────────────────────

/** Maximum number of cached version diffs (LRU). */
export const VERSION_DIFF_CACHE_SIZE = 20;

// ─── Placeholder — full constants list in T009 ────────────────────────────────
