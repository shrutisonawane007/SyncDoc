import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { getDocumentRole, pushOperations, getOperations, OperationPayload } from '@/lib/queries';
import { pool } from '@/lib/pg';
import { z } from 'zod';

// Strict validation schemas to prevent malicious payloads/OOM
const operationItemSchema = z.object({
  id: z.string().uuid('Invalid operation ID format'),
  type: z.enum(['upsert_block', 'delete_block', 'set_title']),
  block_id: z.string().max(100).nullable(),
  content: z.string().max(50000, 'Content exceeds size limit').nullable(), // limit content length to prevent OOM
  block_type: z.string().max(50).nullable(),
  position: z.string().max(255).nullable(),
  timestamp: z.number().positive(),
  lamport: z.number().nonnegative(),
  client_id: z.string().max(100),
});

const syncPayloadSchema = z.object({
  clientHighestLamport: z.number().nonnegative(),
  operations: z.array(operationItemSchema).max(200, 'Operations batch size exceeded'), // protect against OOM
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: docId } = await params;
    const authUser = getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validation = syncPayloadSchema.safeParse(body);
    if (!validation.success) {
      console.error('Zod sync payload validation failed:', validation.error.format());
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const { clientHighestLamport, operations } = validation.data;

    // Verify role permissions
    const client = await pool.connect();
    let role;
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [authUser.userId]);
      role = await getDocumentRole(client, docId, authUser.userId);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    if (!role) {
      return NextResponse.json({ error: 'Unauthorized: Document access denied' }, { status: 403 });
    }

    // Enforce role-based mutations rules
    if (operations.length > 0) {
      if (role === 'viewer') {
        return NextResponse.json({ error: 'Unauthorized: Viewers cannot save modifications' }, { status: 403 });
      }

      // Save incoming local operations
      await pushOperations(authUser.userId, docId, operations as OperationPayload[]);
    }

    // Retrieve newer remote operations
    const remoteOperations = await getOperations(authUser.userId, docId, clientHighestLamport);

    // Return acknowledgement and remote updates
    return NextResponse.json({
      success: true,
      acknowledgedOpIds: operations.map((op) => op.id),
      remoteOperations,
    });
  } catch (error) {
    console.error('Sync API Error:', error);
    return NextResponse.json({ error: 'Sync failed: ' + ((error as Error).message || 'Internal error') }, { status: 500 });
  }
}
