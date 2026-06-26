import { test } from 'node:test';
import assert from 'node:assert';
import { mergeOperations } from '../lib/sync/merger';
import { LocalOperation } from '../lib/db';

test('CRDT Merger: compiles empty document when no ops exist', () => {
  const result = mergeOperations('Baseline', [], []);
  assert.strictEqual(result.title, 'Baseline');
  assert.strictEqual(result.blocks.length, 0);
});

test('CRDT Merger: applies title changes and upserts blocks', () => {
  const ops: LocalOperation[] = [
    {
      id: 'op1',
      docId: 'doc1',
      type: 'set_title',
      blockId: null,
      content: 'Updated Title',
      blockType: null,
      position: null,
      timestamp: 1000,
      lamport: 1,
      clientId: 'clientA',
      userId: 'user1',
    },
    {
      id: 'op2',
      docId: 'doc1',
      type: 'upsert_block',
      blockId: 'b1',
      content: 'Hello World',
      blockType: 'paragraph',
      position: 'm',
      timestamp: 1001,
      lamport: 2,
      clientId: 'clientA',
      userId: 'user1',
    },
  ];

  const result = mergeOperations('Original Title', [], ops);
  assert.strictEqual(result.title, 'Updated Title');
  assert.strictEqual(result.blocks.length, 1);
  assert.strictEqual(result.blocks[0].id, 'b1');
  assert.strictEqual(result.blocks[0].content, 'Hello World');
});

test('CRDT Merger: resolves concurrent edits using Last-Write-Wins (Lamport wins)', () => {
  const ops: LocalOperation[] = [
    {
      id: 'opA',
      docId: 'doc1',
      type: 'upsert_block',
      blockId: 'b1',
      content: 'Content from Client A',
      blockType: 'paragraph',
      position: 'm',
      timestamp: 1000,
      lamport: 2, // higher lamport
      clientId: 'clientA',
      userId: 'user1',
    },
    {
      id: 'opB',
      docId: 'doc1',
      type: 'upsert_block',
      blockId: 'b1',
      content: 'Content from Client B',
      blockType: 'paragraph',
      position: 'm',
      timestamp: 1010, // higher wall clock timestamp, but lower lamport
      lamport: 1,      // lower lamport
      clientId: 'clientB',
      userId: 'user2',
    },
  ];

  const result = mergeOperations('Title', [], ops);
  assert.strictEqual(result.blocks.length, 1);
  assert.strictEqual(result.blocks[0].content, 'Content from Client A'); // Client A wins because lamport 2 > 1
});

test('CRDT Merger: resolves tie-breaks using clientID lexicographical order when lamports are equal', () => {
  const ops: LocalOperation[] = [
    {
      id: 'opA',
      docId: 'doc1',
      type: 'upsert_block',
      blockId: 'b1',
      content: 'Content A',
      blockType: 'paragraph',
      position: 'm',
      timestamp: 1000,
      lamport: 2,
      clientId: 'client_A', // smaller clientId
      userId: 'user1',
    },
    {
      id: 'opB',
      docId: 'doc1',
      type: 'upsert_block',
      blockId: 'b1',
      content: 'Content B',
      blockType: 'paragraph',
      position: 'm',
      timestamp: 1000,
      lamport: 2,
      clientId: 'client_B', // larger clientId
      userId: 'user2',
    },
  ];

  const result = mergeOperations('Title', [], ops);
  assert.strictEqual(result.blocks.length, 1);
  // 'client_B' > 'client_A' lexicographically, so client B wins
  assert.strictEqual(result.blocks[0].content, 'Content B');
});

test('CRDT Merger: deletes blocks using tombstones', () => {
  const ops: LocalOperation[] = [
    {
      id: 'op1',
      docId: 'doc1',
      type: 'upsert_block',
      blockId: 'b1',
      content: 'Original Block',
      blockType: 'paragraph',
      position: 'm',
      timestamp: 1000,
      lamport: 1,
      clientId: 'clientA',
      userId: 'user1',
    },
    {
      id: 'op2',
      docId: 'doc1',
      type: 'delete_block',
      blockId: 'b1',
      content: null,
      blockType: null,
      position: null,
      timestamp: 1010,
      lamport: 2, // Deletion is newer
      clientId: 'clientA',
      userId: 'user1',
    },
  ];

  const result = mergeOperations('Title', [], ops);
  assert.strictEqual(result.blocks.length, 0); // Block should be successfully deleted
});
