import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { getDocumentRole } from '@/lib/queries';
import { pool } from '@/lib/pg';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

const aiRequestSchema = z.object({
  action: z.enum(['autocomplete', 'summarize', 'chat']),
  // autocomplete block content
  blockContent: z.string().optional(),
  // full document content
  documentContent: z.string().optional(),
  // chat history / message
  message: z.string().optional(),
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
    const validation = aiRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const { action, blockContent, documentContent, message } = validation.data;

    // Check document access
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

    const geminiKey = process.env.GEMINI_API_KEY;

    // Fallback Mock System if no Gemini Key is provided
    if (!geminiKey || geminiKey.trim() === '') {
      console.warn('GEMINI_API_KEY is not defined. Using mock AI response.');
      let responseText = '';
      if (action === 'autocomplete') {
        responseText = `...and this lets us build a robust local-first flow where offline edits synchronise instantly when connectivity returns! We achieve this through conflict resolution logs and Lamport timestamps.`;
      } else if (action === 'summarize') {
        responseText = `### Document Summary (Mock AI Mode)\n\nThis document outlines the architecture and implementation details for a Local-First Collaborative Document Editor. It highlights client-side persistence with IndexedDB, conflict resolution (CRDT/LWW), and Row-Level Security in PostgreSQL to achieve robust multi-tenant data isolation.`;
      } else if (action === 'chat') {
        responseText = `[Mock AI Assistant]: I see you're editing this document. Since GEMINI_API_KEY is not configured in .env.local, I am running in demo mode. Your document appears to contain the following topic: "${(documentContent || '').substring(0, 150)}..." Let me know if you have any questions about local-first design or CRDT merges!`;
      }
      return NextResponse.json({ result: responseText });
    }

    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(geminiKey);
    let responseText = '';

    let prompt = '';
    if (action === 'autocomplete') {
      if (!blockContent) {
        return NextResponse.json({ error: 'blockContent is required for autocomplete' }, { status: 400 });
      }
      prompt = `You are a smart co-authoring writing assistant. Continue writing the following text naturally. Provide only the continuation of the sentence/paragraph, without any introductory statements, markdown formatting wrappers, quote marks, or pleasantries. Keep it to 1-3 sentences.
      
      Text to continue:
      "${blockContent}"`;
    } else if (action === 'summarize') {
      if (!documentContent) {
        return NextResponse.json({ error: 'documentContent is required for summarization' }, { status: 400 });
      }
      prompt = `Read and summarize the following document content in 2-3 paragraphs. Emphasize key takeaways, using professional formatting.
      
      Document Content:
      "${documentContent}"`;
    } else if (action === 'chat') {
      if (!message || !documentContent) {
        return NextResponse.json({ error: 'message and documentContent are required for chat' }, { status: 400 });
      }
      prompt = `You are a helpful AI co-authoring assistant. Below is the document content we are collaborating on:

---
${documentContent}
---

The user asks the following question about the document:
"${message}"

Write a concise, helpful response. You can reference details from the document as well as apply external knowledge to suggest improvements or clarify concepts.`;
    }

    try {
      console.log('Attempting content generation using gemini-2.5-flash...');
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent(prompt);
      responseText = result.response.text();
    } catch (err) {
      console.warn('gemini-2.5-flash generation failed. Retrying with gemini-1.5-flash...', (err as Error).message);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      responseText = result.response.text();
    }

    return NextResponse.json({ result: responseText });
  } catch (error) {
    console.error('AI API Route Error:', error);
    return NextResponse.json({ error: 'AI processing failed: ' + ((error as Error).message || 'Internal error') }, { status: 500 });
  }
}
