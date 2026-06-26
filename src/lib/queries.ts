import { query, withTenant } from './pg';
import { PoolClient } from 'pg';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  created_at: Date;
}

export interface Document {
  id: string;
  title: string;
  owner_id: string;
  version: number;
  last_compacted_lamport: number;
  updated_at: Date;
  role?: 'owner' | 'editor' | 'viewer';
}

export interface Collaborator {
  user_id: string;
  email: string;
  name: string;
  role: 'owner' | 'editor' | 'viewer';
}

export interface OperationPayload {
  id: string;
  type: 'upsert_block' | 'delete_block' | 'set_title';
  block_id: string | null;
  content: string | null;
  block_type: string | null;
  position: string | null;
  timestamp: number;
  lamport: number;
  client_id: string;
}

export interface VersionSnapshot {
  id: string;
  document_id: string;
  version_name: string;
  content_snapshot: string;
  lamport: number;
  created_by: string;
  created_at: Date;
}

// --- User Management ---
export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await query<User>('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0] || null;
}

export async function createUser(name: string, email: string, passwordHash: string): Promise<User> {
  const result = await query<User>(
    'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
    [name, email, passwordHash]
  );
  return result.rows[0];
}

// --- Document Access Checking (Role resolver) ---
export async function getDocumentRole(client: PoolClient, docId: string, userId: string): Promise<'owner' | 'editor' | 'viewer' | null> {
  // Check if owner
  const docResult = await client.query('SELECT owner_id FROM documents WHERE id = $1', [docId]);
  if (docResult.rows.length === 0) return null;
  if (docResult.rows[0].owner_id === userId) return 'owner';

  // Check collaborator role
  const collabResult = await client.query(
    'SELECT role FROM document_collaborators WHERE document_id = $1 AND user_id = $2',
    [docId, userId]
  );
  if (collabResult.rows.length > 0) {
    return collabResult.rows[0].role as 'editor' | 'viewer';
  }

  return null;
}

// --- Document Queries (RLS-Scoped via withTenant) ---
export async function getDocuments(userId: string): Promise<Document[]> {
  return withTenant(userId, async (client) => {
    // Select documents where the user is either the owner or an invited collaborator.
    // Explicit WHERE filtering is used as defense-in-depth because the superuser (postgres)
    // database role bypasses PostgreSQL RLS policies by default.
    const result = await client.query(`
      SELECT d.*, 
             CASE 
               WHEN d.owner_id = $1 THEN 'owner'
               ELSE dc.role
             END as role
      FROM documents d
      LEFT JOIN document_collaborators dc ON dc.document_id = d.id AND dc.user_id = $1
      WHERE d.owner_id = $1 OR dc.user_id = $1
      ORDER BY d.updated_at DESC
    `, [userId]);
    return result.rows;
  });
}

export async function createDocument(userId: string, title: string, docId?: string): Promise<Document> {
  return withTenant(userId, async (client) => {
    // Insert document using custom ID if provided, otherwise let Postgres default UUID
    const queryStr = docId 
      ? 'INSERT INTO documents (id, title, owner_id) VALUES ($1, $2, $3) RETURNING *'
      : 'INSERT INTO documents (title, owner_id) VALUES ($1, $2) RETURNING *';
    
    const params = docId ? [docId, title, userId] : [title, userId];
    const docResult = await client.query(queryStr, params);
    const newDoc = docResult.rows[0];
    
    // Auto-create collaborator entry as owner for consistency
    await client.query(
      'INSERT INTO document_collaborators (document_id, user_id, role) VALUES ($1, $2, $3)',
      [newDoc.id, userId, 'owner']
    );

    return { ...newDoc, role: 'owner' };
  });
}

export async function deleteDocument(userId: string, docId: string): Promise<boolean> {
  return withTenant(userId, async (client) => {
    const role = await getDocumentRole(client, docId, userId);
    if (role !== 'owner') {
      throw new Error('Unauthorized: Only the document owner can delete this document.');
    }
    
    await client.query('DELETE FROM documents WHERE id = $1', [docId]);
    return true;
  });
}

// --- Collaborator Management ---
export async function getCollaborators(userId: string, docId: string): Promise<Collaborator[]> {
  return withTenant(userId, async (client) => {
    const role = await getDocumentRole(client, docId, userId);
    if (!role) {
      throw new Error('Unauthorized: You do not have access to this document.');
    }

    const result = await client.query(`
      SELECT u.id as user_id, u.email, u.name, dc.role
      FROM document_collaborators dc
      JOIN users u ON u.id = dc.user_id
      WHERE dc.document_id = $1
    `, [docId]);
    return result.rows;
  });
}

export async function addCollaborator(
  userId: string,
  docId: string,
  email: string,
  role: 'editor' | 'viewer'
): Promise<Collaborator> {
  return withTenant(userId, async (client) => {
    const userRole = await getDocumentRole(client, docId, userId);
    if (userRole !== 'owner') {
      throw new Error('Unauthorized: Only the owner can manage collaborators.');
    }

    const targetUserResult = await client.query('SELECT id, name, email FROM users WHERE email = $1', [email]);
    if (targetUserResult.rows.length === 0) {
      throw new Error('User not found. They must register first.');
    }
    const targetUser = targetUserResult.rows[0];

    // Check if already a collaborator
    const existing = await client.query(
      'SELECT role FROM document_collaborators WHERE document_id = $1 AND user_id = $2',
      [docId, targetUser.id]
    );

    if (existing.rows.length > 0) {
      await client.query(
        'UPDATE document_collaborators SET role = $3 WHERE document_id = $1 AND user_id = $2',
        [docId, targetUser.id, role]
      );
    } else {
      await client.query(
        'INSERT INTO document_collaborators (document_id, user_id, role) VALUES ($1, $2, $3)',
        [docId, targetUser.id, role]
      );
    }

    return {
      user_id: targetUser.id,
      email: targetUser.email,
      name: targetUser.name,
      role,
    };
  });
}

// --- Synchronization and Operation Syncing ---
export async function getOperations(
  userId: string,
  docId: string,
  sinceLamport: number
): Promise<OperationPayload[]> {
  return withTenant(userId, async (client) => {
    const userRole = await getDocumentRole(client, docId, userId);
    if (!userRole) {
      throw new Error('Unauthorized: You do not have access to this document.');
    }

    const result = await client.query(
      'SELECT id, type, block_id, content, block_type, position, timestamp, lamport, client_id FROM operations WHERE document_id = $1 AND lamport > $2 ORDER BY lamport ASC, client_id ASC',
      [docId, sinceLamport]
    );

    return result.rows.map((row) => ({
      id: row.id,
      type: row.type,
      block_id: row.block_id,
      content: row.content,
      block_type: row.block_type,
      position: row.position,
      timestamp: Number(row.timestamp),
      lamport: Number(row.lamport),
      client_id: row.client_id,
    }));
  });
}

export async function pushOperations(
  userId: string,
  docId: string,
  operations: OperationPayload[]
): Promise<{ addedCount: number; maxLamport: number }> {
  return withTenant(userId, async (client) => {
    const userRole = await getDocumentRole(client, docId, userId);
    if (!userRole || userRole === 'viewer') {
      throw new Error('Unauthorized: Viewers cannot make edits to the document.');
    }

    if (operations.length === 0) {
      return { addedCount: 0, maxLamport: 0 };
    }

    let addedCount = 0;
    let maxLamport = 0;

    for (const op of operations) {
      // Avoid duplicate operations using ID checking
      const dupCheck = await client.query('SELECT 1 FROM operations WHERE id = $1', [op.id]);
      if (dupCheck.rows.length > 0) continue;

      await client.query(
        `INSERT INTO operations (id, document_id, user_id, type, block_id, content, block_type, position, timestamp, lamport, client_id) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          op.id,
          docId,
          userId,
          op.type,
          op.block_id,
          op.content,
          op.block_type,
          op.position,
          op.timestamp,
          op.lamport,
          op.client_id,
        ]
      );

      addedCount++;
      if (op.lamport > maxLamport) {
        maxLamport = op.lamport;
      }
    }

    // Update document timestamp
    await client.query('UPDATE documents SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [docId]);

    return { addedCount, maxLamport };
  });
}

// --- Document Snapshots & Version History ---
export async function createVersionSnapshot(
  userId: string,
  docId: string,
  versionName: string,
  contentSnapshot: string,
  lamport: number
): Promise<VersionSnapshot> {
  return withTenant(userId, async (client) => {
    const role = await getDocumentRole(client, docId, userId);
    if (!role || role === 'viewer') {
      throw new Error('Unauthorized: Viewers cannot create document versions.');
    }

    const result = await client.query(
      `INSERT INTO versions (document_id, version_name, content_snapshot, lamport, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [docId, versionName, contentSnapshot, lamport, userId]
    );

    return result.rows[0];
  });
}

export async function getVersionSnapshots(userId: string, docId: string): Promise<VersionSnapshot[]> {
  return withTenant(userId, async (client) => {
    const role = await getDocumentRole(client, docId, userId);
    if (!role) {
      throw new Error('Unauthorized: Access denied.');
    }

    const result = await client.query(
      'SELECT * FROM versions WHERE document_id = $1 ORDER BY created_at DESC',
      [docId]
    );
    return result.rows;
  });
}
