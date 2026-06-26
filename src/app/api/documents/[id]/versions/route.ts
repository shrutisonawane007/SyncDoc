import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { getDocumentRole, createVersionSnapshot, getVersionSnapshots } from '@/lib/queries';
import { pool } from '@/lib/pg';
import { z } from 'zod';

const createVersionSchema = z.object({
  versionName: z.string().min(1, 'Version name is required').max(100),
  contentSnapshot: z.string().min(2, 'Snapshot content is required'),
  lamport: z.number().nonnegative(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: docId } = await params;
    const authUser = getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const versions = await getVersionSnapshots(authUser.userId, docId);
    return NextResponse.json({ versions });
  } catch (error) {
    console.error('Error fetching versions:', error);
    return NextResponse.json({ error: 'Failed to fetch versions' }, { status: 500 });
  }
}

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
    const validation = createVersionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const { versionName, contentSnapshot, lamport } = validation.data;

    // Check permissions
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

    if (role === 'viewer') {
      return NextResponse.json({ error: 'Unauthorized: Viewers cannot create snapshots' }, { status: 403 });
    }

    const newVersion = await createVersionSnapshot(
      authUser.userId,
      docId,
      versionName,
      contentSnapshot,
      lamport
    );

    return NextResponse.json({ version: newVersion }, { status: 201 });
  } catch (error) {
    console.error('Error creating version:', error);
    return NextResponse.json({ error: 'Failed to create version: ' + (error as Error).message }, { status: 500 });
  }
}
