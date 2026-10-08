/**
 * API Route: /api/leads
 * 
 * Unified Leads Management API:
 * - GET: Fetch unified leads with status, origin, and text search filters.
 * - PATCH: Execute audited individual or bulk PASS / status transition actions.
 * - DELETE: Clear current unified leads.
 */

import { NextRequest, NextResponse } from 'next/server';
import { unifiedLeadStore } from '@/lib/unifiedLeadStore';
import { FinalLeadStatus } from '@/lib/leadPackage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = (searchParams.get('status') || 'ALL') as any;
    const origin = (searchParams.get('origin') || 'ALL') as any;
    const search = searchParams.get('search') || undefined;

    const allLeads = unifiedLeadStore.getLeads();
    const filteredLeads = unifiedLeadStore.getLeads({ status, origin, search });

    const counts = {
      total: allLeads.length,
      verified: allLeads.filter(l => l.currentStatus === 'VERIFIED').length,
      review: allLeads.filter(l => l.currentStatus === 'REVIEW').length,
      unverified: allLeads.filter(l => l.currentStatus === 'UNVERIFIED').length,
      rejected: allLeads.filter(l => l.currentStatus === 'REJECTED').length,
      internal: allLeads.filter(l => l.originDisplay === 'INTERNAL').length,
      external: allLeads.filter(l => l.originDisplay === 'EXTERNAL').length,
      both: allLeads.filter(l => l.originDisplay === 'BOTH').length,
    };

    return NextResponse.json({
      success: true,
      leads: filteredLeads,
      counts,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadId, leadIds, newStatus, overrideReason, overrideBy = 'User Action', workflow = 'INTERNAL' } = body;

    const validStatuses: FinalLeadStatus[] = ['VERIFIED', 'REVIEW', 'UNVERIFIED', 'REJECTED'];
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json({
        success: false,
        error: `Invalid destination status: ${newStatus}. Must be one of: ${validStatuses.join(', ')}`,
      }, { status: 400 });
    }

    if (Array.isArray(leadIds) && leadIds.length > 0) {
      // Bulk update
      const updated = unifiedLeadStore.bulkManualOverrideStatus(
        leadIds,
        newStatus,
        overrideReason || `Bulk manual status transition to ${newStatus}`,
        overrideBy,
        workflow
      );

      return NextResponse.json({
        success: true,
        updatedCount: updated.length,
        leads: updated,
      });
    }

    if (leadId) {
      // Individual update
      const updated = unifiedLeadStore.manualOverrideStatus(
        leadId,
        newStatus,
        overrideReason || `Manual promotion to ${newStatus}`,
        overrideBy,
        workflow
      );

      return NextResponse.json({
        success: true,
        lead: updated,
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Either leadId or leadIds array is required for status transition.',
    }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    unifiedLeadStore.clearLeads();
    return NextResponse.json({ success: true, message: 'Unified leads cleared' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
