import { db, LocalOperation } from '../db';
import { mergeOperations, EditorBlock } from './merger';

export type SyncStatus = 'connected' | 'syncing' | 'offline' | 'error';
type StatusListener = (status: SyncStatus) => void;

interface RemoteSyncOperation {
  id: string;
  type: 'upsert_block' | 'delete_block' | 'set_title';
  block_id: string | null;
  content: string | null;
  block_type: string | null;
  position: string | null;
  timestamp: string | number;
  lamport: string | number;
  client_id: string;
  user_id?: string;
}

class SyncEngine {
  private statusListeners = new Set<StatusListener>();
  private activeStatus: SyncStatus = 'offline';
  private syncInProgress = false;
  public clientId: string = '';

  constructor() {
    if (typeof window !== 'undefined') {
      this.clientId = this.getOrCreateClientId();
      this.activeStatus = navigator.onLine ? 'connected' : 'offline';
      
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
    }
  }

  private getOrCreateClientId(): string {
    let id = localStorage.getItem('sync_client_id');
    if (!id) {
      id = 'client_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('sync_client_id', id);
    }
    return id;
  }

  public registerStatusListener(listener: StatusListener) {
    this.statusListeners.add(listener);
    listener(this.activeStatus);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(status: SyncStatus) {
    this.activeStatus = status;
    this.statusListeners.forEach((l) => l(status));
  }

  public getStatus(): SyncStatus {
    return this.activeStatus;
  }

  private handleNetworkChange(isOnline: boolean) {
    if (isOnline) {
      this.setStatus('connected');
      this.triggerSyncAll();
    } else {
      this.setStatus('offline');
    }
  }

  /**
   * Increments and returns the next logical Lamport timestamp.
   */
  public async getNextLamport(docId: string): Promise<number> {
    const lastOp = await db.operations
      .where('docId')
      .equals(docId)
      .sortBy('lamport');
    
    const maxLamport = lastOp.length > 0 ? lastOp[lastOp.length - 1].lamport : 0;
    return maxLamport + 1;
  }

  /**
   * Adds a new user operation locally, queues it for sync, and triggers synchronization.
   */
  public async addLocalOperation(
    docId: string,
    userId: string,
    type: 'upsert_block' | 'delete_block' | 'set_title',
    blockId: string | null,
    content: string | null,
    blockType: string | null,
    position: string | null
  ): Promise<LocalOperation> {
    const lamport = await this.getNextLamport(docId);
    const timestamp = Date.now();
    
    const op: LocalOperation = {
      id: crypto.randomUUID(),
      docId,
      type,
      blockId,
      content,
      blockType,
      position,
      timestamp,
      lamport,
      clientId: this.clientId,
      userId,
    };

    // Store operation locally
    await db.operations.put(op);

    // Queue for background sync
    await db.syncQueue.put({
      id: crypto.randomUUID(),
      docId,
      opId: op.id,
      timestamp,
    });

    // Recalculate local document representation immediately (optimistic UI rendering)
    await this.refreshLocalDocumentState(docId);

    // Trigger asynchronous upload
    this.triggerSync(docId);

    return op;
  }

  /**
   * Triggers synchronization for a specific document.
   */
  public async triggerSync(docId: string): Promise<void> {
    if (this.syncInProgress || typeof window === 'undefined' || !navigator.onLine) {
      return;
    }

    this.syncInProgress = true;
    this.setStatus('syncing');

    try {
      const doc = await db.documents.get(docId);
      if (!doc) {
        this.syncInProgress = false;
        return;
      }

      // If document was created offline, register it on the server first
      if (doc.isOfflineCreated) {
        try {
          const createRes = await fetch('/api/documents', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: doc.id,
              title: doc.title,
            }),
          });

          if (!createRes.ok) {
            throw new Error('Failed to register offline document');
          }

          await db.documents.update(docId, { isOfflineCreated: false });
        } catch (err) {
          console.error('Offline document registration failed:', err);
          this.setStatus('error');
          this.syncInProgress = false;
          return;
        }
      }

      // get unsynced ops
      const queuedItems = await db.syncQueue.where('docId').equals(docId).toArray();
      const opIds = queuedItems.map((item) => item.opId);
      
      const opsToPush: LocalOperation[] = [];
      if (opIds.length > 0) {
        const matchingOps = await db.operations.where('id').anyOf(opIds).toArray();
        opsToPush.push(...matchingOps);
      }

      // find highest lamport timestamp
      const localOps = await db.operations.where('docId').equals(docId).sortBy('lamport');
      const clientHighestLamport = localOps.length > 0 ? localOps[localOps.length - 1].lamport : 0;

      const mappedOps = opsToPush.map((op) => ({
        id: op.id,
        type: op.type,
        block_id: op.blockId,
        content: op.content,
        block_type: op.blockType,
        position: op.position,
        timestamp: op.timestamp,
        lamport: op.lamport,
        client_id: op.clientId,
      }));

      const response = await fetch(`/api/documents/${docId}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientHighestLamport,
          operations: mappedOps,
        }),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Access denied: Unauthorized operation sync.');
        }
        let errorMsg = 'Sync endpoint returned an error status.';
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errorMsg = `Sync failed: ${errData.error}`;
          }
        } catch {
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      const { remoteOperations, acknowledgedOpIds } = data;

      // clean sync queue
      if (acknowledgedOpIds && acknowledgedOpIds.length > 0) {
        const queuedToRemove = queuedItems.filter((qi) => acknowledgedOpIds.includes(qi.opId));
        await db.syncQueue.bulkDelete(queuedToRemove.map((q) => q.id));
      }

      // persist remote operations
      if (remoteOperations && remoteOperations.length > 0) {
        const normalizedRemoteOps: LocalOperation[] = remoteOperations.map((op: RemoteSyncOperation) => ({
          id: op.id,
          docId,
          type: op.type,
          blockId: op.block_id,
          content: op.content,
          blockType: op.block_type,
          position: op.position,
          timestamp: Number(op.timestamp),
          lamport: Number(op.lamport),
          clientId: op.client_id,
          userId: op.user_id || 'remote',
        }));
        
        await db.operations.bulkPut(normalizedRemoteOps);
      }

      await this.refreshLocalDocumentState(docId);
      this.setStatus('connected');
    } catch (error) {
      console.error(`Sync failed for doc ${docId}:`, error);
      this.setStatus('error');
    } finally {
      this.syncInProgress = false;
    }
  }

  public async refreshLocalDocumentState(docId: string): Promise<void> {
    const doc = await db.documents.get(docId);
    if (!doc) return;

    const ops = await db.operations.where('docId').equals(docId).toArray();
    const initialBlocks: EditorBlock[] = [];
    const baseTitle = doc.isOfflineCreated ? doc.title : '';
    
    const mergedState = mergeOperations(
      baseTitle,
      initialBlocks,
      ops,
      doc.lastCompactedLamport
    );

    await db.documents.update(docId, {
      title: mergedState.title,
      updatedAt: Date.now(),
    });
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(`doc_updated_${docId}`, { detail: mergedState }));
    }
  }

  public async triggerSyncAll(): Promise<void> {
    const docs = await db.documents.toArray();
    for (const doc of docs) {
      await this.triggerSync(doc.id);
    }
  }
}

export const syncEngine = new SyncEngine();
export default syncEngine;
