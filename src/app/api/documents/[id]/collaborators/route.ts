import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { getCollaborators, addCollaborator } from '@/lib/queries';
import { z } from 'zod';

const addCollaboratorSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['editor', 'viewer']),
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

    const list = await getCollaborators(authUser.userId, docId);
    return NextResponse.json({ collaborators: list });
  } catch (error) {
    console.error('Error fetching collaborators:', error);
    return NextResponse.json({ error: (error as Error).message || 'Failed to fetch collaborators' }, { status: 500 });
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
    const validation = addCollaboratorSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const { email, role } = validation.data;
    const collaborator = await addCollaborator(authUser.userId, docId, email, role);

    return NextResponse.json({ success: true, collaborator });
  } catch (error) {
    console.error('Error adding collaborator:', error);
    return NextResponse.json({ error: (error as Error).message || 'Failed to add collaborator' }, { status: 500 });
  }
}
