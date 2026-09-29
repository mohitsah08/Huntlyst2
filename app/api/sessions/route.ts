/**
 * API Route: /api/sessions
 * 
 * Manages persistent search sessions, previously-seen domain metrics,
 * and discovery execution telemetry.
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const sessions = dbStore.listSessions();
    const seenDomains = dbStore.getAllSeenDomains();
    const history = dbStore.getSearchHistory();

    return NextResponse.json({
      success: true,
      totalSessions: sessions.length,
      totalSeenDomains: seenDomains.length,
      sessions,
      recentHistory: history.slice(0, 10),
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || 'Failed to list search sessions',
    }, { status: 500 });
  }
}
