import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { getDocuments, createDocument } from '@/lib/queries';
import { z } from 'zod';

const createDocSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  id: z.string().uuid('Invalid custom ID format').optional(),
});

export async function GET(req: NextRequest) {
  try {
    const authUser = getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const docs = await getDocuments(authUser.userId);
    return NextResponse.json({ documents: docs });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validation = createDocSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const { title, id } = validation.data;
    const newDoc = await createDocument(authUser.userId, title, id);
    
    return NextResponse.json({ document: newDoc }, { status: 201 });
  } catch (error) {
    console.error('Error creating document:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

