import { LocalOperation } from '../db';

export interface EditorBlock {
  id: string;
  type: string;
  content: string;
  position: string;
}

export interface MergedDocumentState {
  title: string;
  blocks: EditorBlock[];
  lastCompactedLamport: number;
}

interface BlockState {
  id: string;
  type: string;
  content: string;
  position: string;
  lamport: number;
  clientId: string;
  isDeleted: boolean;
}

export function mergeOperations(
  initialTitle: string,
  initialBlocks: EditorBlock[],
  operations: LocalOperation[],
  lastCompactedLamport = 0
): MergedDocumentState {
  let title = initialTitle;
  
  // init block map from baseline
  const blockMap = new Map<string, BlockState>();
  
  for (const block of initialBlocks) {
    blockMap.set(block.id, {
      id: block.id,
      type: block.type,
      content: block.content,
      position: block.position,
      lamport: lastCompactedLamport,
      clientId: 'system',
      isDeleted: false,
    });
  }

  // sort by lamport, tie-break on clientId
  const sortedOps = [...operations].sort((a, b) => {
    if (a.lamport !== b.lamport) {
      return a.lamport - b.lamport;
    }
    return a.clientId.localeCompare(b.clientId);
  });

  // apply ops with LWW
  for (const op of sortedOps) {
    if (op.type === 'set_title') {
      title = op.content || '';
      continue;
    }

    const blockId = op.blockId;
    if (!blockId) continue;

    const existingBlock = blockMap.get(blockId);

    // LWW conflict resolution
    const opWins =
      !existingBlock ||
      op.lamport > existingBlock.lamport ||
      (op.lamport === existingBlock.lamport && op.clientId.localeCompare(existingBlock.clientId) > 0);

    if (opWins) {
      if (op.type === 'delete_block') {
        blockMap.set(blockId, {
          id: blockId,
          type: existingBlock?.type || 'paragraph',
          content: '',
          position: existingBlock?.position || '',
          lamport: op.lamport,
          clientId: op.clientId,
          isDeleted: true,
        });
      } else if (op.type === 'upsert_block') {
        blockMap.set(blockId, {
          id: blockId,
          type: op.blockType || 'paragraph',
          content: op.content || '',
          position: op.position || 'a',
          lamport: op.lamport,
          clientId: op.clientId,
          isDeleted: false,
        });
      }
    }
  }

  // filter active blocks and sort by fractional index position
  const blocks: EditorBlock[] = Array.from(blockMap.values())
    .filter((b) => !b.isDeleted)
    .map((b) => ({
      id: b.id,
      type: b.type,
      content: b.content,
      position: b.position,
    }))
    .sort((a, b) => a.position.localeCompare(b.position));

  return {
    title,
    blocks,
    lastCompactedLamport,
  };
}
