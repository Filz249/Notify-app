import * as SQLite from 'expo-sqlite';
import type { Note } from './types';

const databasePromise = SQLite.openDatabaseAsync('notify.db');

async function getDb() {
  const db = await databasePromise;
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY NOT NULL,
      note_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS notes_updated_at_idx ON notes(updated_at DESC);
  `);
  return db;
}

export async function loadNotes(): Promise<Note[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ note_json: string }>(
    'SELECT note_json FROM notes ORDER BY updated_at DESC',
  );
  return rows.map((row) => JSON.parse(row.note_json) as Note);
}

export async function saveNote(note: Note): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO notes (id, note_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET note_json = excluded.note_json, updated_at = excluded.updated_at`,
    note.id,
    JSON.stringify(note),
    note.updatedAt,
  );
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM notes WHERE id = ?', id);
}
