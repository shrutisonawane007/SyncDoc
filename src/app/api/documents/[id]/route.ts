import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { getDocumentRole, deleteDocument } from '@/lib/queries';
import { pool } from '@/lib/pg';

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

    const client = await pool.connect();
    let role;
    let docDetails;
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [authUser.userId]);
      role = await getDocumentRole(client, docId, authUser.userId);
      if (role) {
        const docResult = await client.query('SELECT * FROM documents WHERE id = $1', [docId]);
        docDetails = docResult.rows[0];
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    if (!role || !docDetails) {
      return NextResponse.json({ error: 'Unauthorized or Document not found' }, { status: 403 });
    }

    return NextResponse.json({
      document: {
        id: docDetails.id,
        title: docDetails.title,
        owner_id: docDetails.owner_id,
        version: docDetails.version,
        last_compacted_lamport: Number(docDetails.last_compacted_lamport),
        updated_at: docDetails.updated_at,
        role,
      },
    });
  } catch (error) {
    console.error('Error fetching document details:', error);
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: docId } = await params;
    const authUser = getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await deleteDocument(authUser.userId, docId);
    return NextResponse.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json({ error: (error as Error).message || 'Failed to delete document' }, { status: 500 });
  }
}
