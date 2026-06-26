import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { mergeOperations } from '@/lib/sync/merger';
import { syncEngine, SyncStatus } from '@/lib/sync/syncEngine';

export function useDocument(docId: string, currentUserId: string | null) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(syncEngine.getStatus());

  useEffect(() => {
    const unsubscribe = syncEngine.registerStatusListener((status) => {
      setSyncStatus(status);
    });
    return () => unsubscribe();
  }, []);

  // poll sync every 5s if online
  useEffect(() => {
    if (!docId || !currentUserId) return;
    
    syncEngine.triggerSync(docId);

    const interval = setInterval(() => {
      if (syncEngine.getStatus() !== 'offline') {
        syncEngine.triggerSync(docId);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [docId, currentUserId]);

  // compile doc state from local ops
  const docState = useLiveQuery(async () => {
    if (!docId) return null;

    const documentRecord = await db.documents.get(docId);
    if (!documentRecord) return null;

    const operations = await db.operations.where('docId').equals(docId).toArray();
    
    const compiled = mergeOperations(
      documentRecord.title,
      [], // no snapshots yet, replay all ops
      operations,
      documentRecord.lastCompactedLamport
    );

    return {
      id: documentRecord.id,
      title: compiled.title,
      blocks: compiled.blocks,
      ownerId: documentRecord.ownerId,
      updatedAt: documentRecord.updatedAt,
      isOfflineCreated: documentRecord.isOfflineCreated,
      role: documentRecord.role,
    };
  }, [docId]);

  const updateTitle = async (title: string) => {
    if (!docId || !currentUserId) return;
    await syncEngine.addLocalOperation(
      docId,
      currentUserId,
      'set_title',
      null,
      title,
      null,
      null
    );
  };

  const upsertBlock = async (
    blockId: string,
    content: string,
    blockType: string = 'paragraph',
    position: string = 'a'
  ) => {
    if (!docId || !currentUserId) return;
    await syncEngine.addLocalOperation(
      docId,
      currentUserId,
      'upsert_block',
      blockId,
      content,
      blockType,
      position
    );
  };

  const deleteBlock = async (blockId: string) => {
    if (!docId || !currentUserId) return;
    await syncEngine.addLocalOperation(
      docId,
      currentUserId,
      'delete_block',
      blockId,
      null,
      null,
      null
    );
  };

  const forceSync = async () => {
    if (!docId) return;
    await syncEngine.triggerSync(docId);
  };

  return {
    document: docState,
    syncStatus,
    updateTitle,
    upsertBlock,
    deleteBlock,
    forceSync,
    clientId: syncEngine.clientId,
  };
}
