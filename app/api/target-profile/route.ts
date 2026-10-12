import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { TargetCriteria, DEFAULT_TARGET_CRITERIA } from '@/lib/research/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * WORKFLOW B: Target Criteria Configuration API
 * 
 * Responsibilities:
 * - Creates, updates, and retrieves target criteria independently.
 * - Does NOT control or alter what facts are extracted or stored during scraping.
 * - Supports funding min/max, geography, US presence, industries, and executive constraints.
 * - Versioned for historical traceability of verification runs.
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const criteria = dbStore.getTargetCriteria(id);
      return NextResponse.json({ success: true, criteria });
    }

    const allCriteria = dbStore.listTargetCriteria();
    const active = dbStore.getTargetCriteria();

    return NextResponse.json({
      success: true,
      active,
      criteriaList: allCriteria,
    });
  } catch (err: any) {
    console.error('[API Target Profile] GET error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const existingId = body.id || 'default_target_criteria';
    const existing = dbStore.getTargetCriteria(existingId);
    const nextVersion = (existing?.version || 0) + 1;

    const criteria: TargetCriteria = {
      id: existingId,
      name: body.name || existing?.name || 'Custom Target Criteria',
      version: nextVersion,
      fundingMinUsd: body.fundingMinUsd !== undefined ? (body.fundingMinUsd === null ? null : Number(body.fundingMinUsd)) : (existing?.fundingMinUsd ?? 1_000_000),
      fundingMaxUsd: body.fundingMaxUsd !== undefined ? (body.fundingMaxUsd === null ? null : Number(body.fundingMaxUsd)) : (existing?.fundingMaxUsd ?? 5_000_000),
      allowedFundingStages: Array.isArray(body.allowedFundingStages) ? body.allowedFundingStages : (existing?.allowedFundingStages ?? ['Seed', 'Series A']),
      requiredCountries: Array.isArray(body.requiredCountries) ? body.requiredCountries : (existing?.requiredCountries ?? []),
      requiredRegions: Array.isArray(body.requiredRegions) ? body.requiredRegions : (existing?.requiredRegions ?? []),
      excludedCountries: Array.isArray(body.excludedCountries) ? body.excludedCountries : (existing?.excludedCountries ?? []),
      usPresenceMode: body.usPresenceMode || existing?.usPresenceMode || 'some_allowed',
      allowedIndustries: Array.isArray(body.allowedIndustries) ? body.allowedIndustries : (existing?.allowedIndustries ?? []),
      allowedSubIndustries: Array.isArray(body.allowedSubIndustries) ? body.allowedSubIndustries : (existing?.allowedSubIndustries ?? []),
      minCompanyAgeYears: body.minCompanyAgeYears !== undefined ? (body.minCompanyAgeYears === null ? null : Number(body.minCompanyAgeYears)) : (existing?.minCompanyAgeYears ?? null),
      maxCompanyAgeYears: body.maxCompanyAgeYears !== undefined ? (body.maxCompanyAgeYears === null ? null : Number(body.maxCompanyAgeYears)) : (existing?.maxCompanyAgeYears ?? null),
      requireCeo: body.requireCeo !== undefined ? Boolean(body.requireCeo) : (existing?.requireCeo ?? true),
      requireFounders: body.requireFounders !== undefined ? Boolean(body.requireFounders) : (existing?.requireFounders ?? false),
      requirePublicEmail: body.requirePublicEmail !== undefined ? Boolean(body.requirePublicEmail) : (existing?.requirePublicEmail ?? false),
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    dbStore.saveTargetCriteria(criteria);

    return NextResponse.json({
      success: true,
      message: `Target criteria updated to version ${criteria.version}`,
      criteria,
    });
  } catch (err: any) {
    console.error('[API Target Profile] POST error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
