import { NextRequest, NextResponse } from 'next/server';
import { externalResearchPipeline, InvalidInputError } from '@/lib/research/pipeline';
import { dbStore } from '@/lib/db/store';
import { CompanyResearchProfile } from '@/lib/research/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * WORKFLOW A: Company Research & Scraping API
 * 
 * Responsibilities:
 * - Accepts an official company website URL or company name.
 * - Also supports batch research of multiple companies.
 * - Safely validates input, rejecting prompts, instructions, or deployment messages.
 * - Executes web scraping and evidence extraction via Firecrawl and authoritative sources.
 * - Saves persistent CompanyResearchProfiles to database store.
 * - NEVER triggers qualification or criteria verification.
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companiesToResearch: Array<{ url?: string | null; name?: string | null }> = [];

    if (Array.isArray(body.companies)) {
      for (const item of body.companies) {
        if (typeof item === 'string') {
          const isUrl = item.startsWith('http://') || item.startsWith('https://') || item.includes('.');
          companiesToResearch.push({
            url: isUrl ? item : null,
            name: isUrl ? null : item,
          });
        } else if (typeof item === 'object' && item !== null) {
          companiesToResearch.push({
            url: item.url || item.website || null,
            name: item.name || item.companyName || null,
          });
        }
      }
    } else if (body.url || body.name || body.website) {
      companiesToResearch.push({
        url: body.url || body.website || null,
        name: body.name || null,
      });
    }

    if (companiesToResearch.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please provide at least one company website URL or company name to research.',
        },
        { status: 400 }
      );
    }

    const profiles: CompanyResearchProfile[] = [];
    const errors: Array<{ input: any; error: string }> = [];

    for (const cand of companiesToResearch) {
      try {
        const profile = await externalResearchPipeline.executeResearch(cand);
        // Persist profile to dbStore
        dbStore.saveResearchProfile(profile);
        profiles.push(profile);
      } catch (err: any) {
        if (err instanceof InvalidInputError) {
          errors.push({ input: cand, error: err.message });
        } else {
          console.error('[API Research] Error researching candidate:', cand, err);
          errors.push({ input: cand, error: err.message || 'Internal research execution error' });
        }
      }
    }

    if (profiles.length === 0 && errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: errors[0].error,
          errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      totalRequested: companiesToResearch.length,
      totalResearched: profiles.length,
      profiles,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error('[API Research] Unhandled error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to execute company research workflow',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const domain = searchParams.get('domain');

    if (id) {
      const profile = dbStore.getResearchProfile(id);
      if (!profile) {
        return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, profile });
    }

    if (domain) {
      const profile = dbStore.getResearchProfileByDomain(domain);
      if (!profile) {
        return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, profile });
    }

    const profiles = dbStore.listResearchProfiles();
    return NextResponse.json({
      success: true,
      total: profiles.length,
      profiles,
    });
  } catch (err: any) {
    console.error('[API Research] GET error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing profile id' }, { status: 400 });
    }

    dbStore.removeResearchProfile(id);
    return NextResponse.json({ success: true, message: `Profile ${id} removed` });
  } catch (err: any) {
    console.error('[API Research] DELETE error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
