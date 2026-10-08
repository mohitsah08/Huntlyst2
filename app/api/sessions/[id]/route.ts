/**
 * API Route: /api/sessions/[id]
 * 
 * Retrieves details, queries, and candidates for a specific search session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;
    const session = dbStore.getSession(sessionId);

    if (!session) {
      return NextResponse.json({
        success: false,
        error: `Search session '${sessionId}' not found`,
      }, { status: 404 });
    }

    const queries = dbStore.getSessionQueries(sessionId);

    return NextResponse.json({
      success: true,
      session,
      queries,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || 'Failed to fetch search session',
    }, { status: 500 });
  }
}
