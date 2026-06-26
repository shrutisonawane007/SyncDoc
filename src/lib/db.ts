import Dexie, { type Table } from 'dexie';

export interface LocalDocument {
  id: string;
  title: string;
  ownerId: string;
  version: number;
  lastCompactedLamport: number;
  updatedAt: number;
  isOfflineCreated: boolean;
  role?: string;
}

export interface LocalOperation {
  id: string;
  docId: string;
  type: 'upsert_block' | 'delete_block' | 'set_title';
  blockId: string | null;
  content: string | null;
  blockType: string | null;
  position: string | null; // Fractional index string
  timestamp: number;
  lamport: number;
  clientId: string;
  userId: string;
}

export interface SyncQueueItem {
  id: string;
  docId: string;
  opId: string;
  timestamp: number;
}

export interface LocalVersion {
  id: string;
  docId: string;
  versionName: string;
  content: string; // JSON string of compiled blocks
  lamport: number;
  createdBy: string;
  createdAt: number;
}

class CollabDocDatabase extends Dexie {
  documents!: Table<LocalDocument, string>;
  operations!: Table<LocalOperation, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  versions!: Table<LocalVersion, string>;

  constructor() {
    super('CollabDocDatabase');
    this.version(1).stores({
      documents: 'id, updatedAt, ownerId',
      operations: 'id, docId, lamport, [docId+lamport], clientId',
      syncQueue: 'id, docId, opId, timestamp',
      versions: 'id, docId, createdAt',
    });
  }
}

export const db = new CollabDocDatabase();
export default db;
