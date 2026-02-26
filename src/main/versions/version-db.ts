// src/main/versions/version-db.ts
// T067 — SQLite-backed append-only version store using better-sqlite3.
// Code content is stored on the filesystem; this DB holds only metadata.

import { existsSync, readFileSync } from 'fs';

import Database from 'better-sqlite3';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VersionRow {
  id: string;
  interface_id: string;
  version_number: number;
  parent_version_id: string | null;
  is_revert: 0 | 1;
  reverted_from_id: string | null;
  created_at: string;
  description: string;
  change_type: string;
  code_path: string;
  code_hash: string;
  generation_prompt: string | null;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS versions (
    id               TEXT PRIMARY KEY NOT NULL,
    interface_id     TEXT NOT NULL,
    version_number   INTEGER NOT NULL,
    parent_version_id TEXT,
    is_revert        INTEGER NOT NULL DEFAULT 0,
    reverted_from_id TEXT,
    created_at       TEXT NOT NULL,
    description      TEXT NOT NULL DEFAULT '',
    change_type      TEXT NOT NULL DEFAULT 'generation',
    code_path        TEXT NOT NULL,
    code_hash        TEXT NOT NULL,
    generation_prompt TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_versions_interface_id
    ON versions (interface_id, created_at DESC);
`;

// ─── VersionDB ────────────────────────────────────────────────────────────────

export class VersionDB {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(CREATE_TABLE_SQL);
  }

  /**
   * Insert a new version row.
   * version_number is auto-incremented per interface_id.
   * Returns the id of the created row.
   */
  createVersion(data: Omit<VersionRow, 'version_number'>): string {
    const nextNumber = this.nextVersionNumber(data.interface_id);

    this.db
      .prepare(
        `INSERT INTO versions
           (id, interface_id, version_number, parent_version_id, is_revert,
            reverted_from_id, created_at, description, change_type,
            code_path, code_hash, generation_prompt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        data.id,
        data.interface_id,
        nextNumber,
        data.parent_version_id ?? null,
        data.is_revert,
        data.reverted_from_id ?? null,
        data.created_at,
        data.description,
        data.change_type,
        data.code_path,
        data.code_hash,
        data.generation_prompt ?? null,
      );

    return data.id;
  }

  /**
   * List versions for an interface, newest first.
   * Page is 1-based.
   */
  listVersions(interfaceId: string, page: number, pageSize: number): VersionRow[] {
    const offset = (page - 1) * pageSize;
    return this.db
      .prepare(
        `SELECT * FROM versions
         WHERE interface_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(interfaceId, pageSize, offset) as VersionRow[];
  }

  /** Read the code file referenced by a version row. Returns null if not found. */
  loadCode(versionId: string): string | null {
    const row = this.getVersion(versionId);
    if (!row) return null;
    if (!existsSync(row.code_path)) return null;
    return readFileSync(row.code_path, 'utf8');
  }

  /** Retrieve a single version row by id. */
  getVersion(versionId: string): VersionRow | undefined {
    return this.db.prepare('SELECT * FROM versions WHERE id = ?').get(versionId) as
      | VersionRow
      | undefined;
  }

  /** Close the database connection. */
  close(): void {
    this.db.close();
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private nextVersionNumber(interfaceId: string): number {
    const row = this.db
      .prepare('SELECT MAX(version_number) AS max FROM versions WHERE interface_id = ?')
      .get(interfaceId) as { max: number | null };
    return (row.max ?? 0) + 1;
  }
}
