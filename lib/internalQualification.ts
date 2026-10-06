/**
 * Internal Target Profile Qualification Engine
 * 
 * Strict Specification Rules:
 * 1. Operates SOLELY on the supplied uploaded LeadPackage (ZERO external web research).
 * 2. Evaluates every lead against the ACTIVE configurable Target Profile.
 * 3. Enforces the EXACT FOUR visible final statuses:
 *    - VERIFIED: All active required criteria are satisfied by the uploaded data.
 *    - REVIEW: Ambiguous or conflicting or unresolved data that needs human judgment.
 *    - UNVERIFIED: Required information is missing or placeholder or insufficient.
 *    - REJECTED: At least one active required criterion definitely fails.
 * 4. Error resilience: Any processing error normalizes to UNVERIFIED with error audit.
 * 5. Deterministic scoring based ONLY on active scoring criteria.
 */

import { TargetProfile, DEFAULT_TVB_TARGET_PROFILE } from '@/lib/targetProfileData';
import { HuntConfig } from '@/lib/types';
import { LeadPackage, FinalLeadStatus, LeadQualificationSummary } from '@/lib/leadPackage';
import { checkGeographyMatch, checkIndustryFit } from '@/lib/validation';

export type { TargetProfile };

export interface InternalEvaluationResult {
  finalStatus: FinalLeadStatus;
  qualification: LeadQualificationSummary;
  verdictReason: string;
  rejectionReason?: string;
  reviewReason?: string;
  unverifiedReason?: string;
}

export function evaluateInternalLeadPackage(
  pkg: LeadPackage,
  targetInput?: TargetProfile | HuntConfig
): InternalEvaluationResult {
  try {
    const target: any = targetInput || DEFAULT_TVB_TARGET_PROFILE;
    const isHunt = 'geography' in target && 'funding' in target && !('fundingMin' in target);

    // 1. Funding parameters
    const fMin: number = isHunt ? target.funding.min : (target.fundingMin ?? 100_000);
    const fMax: number = isHunt ? target.funding.max : (target.fundingMax ?? 10_000_000);
    const fCurrency: string = isHunt ? 'USD' : (target.fundingCurrency ?? 'USD');

    // 2. Geography parameters
    const continents: string[] = isHunt
      ? (target.geography.continents || target.geography.regions || []).filter((r: string) => r.toLowerCase() !== 'global')
      : (target.continents || target.regions || []).filter((r: string) => r.toLowerCase() !== 'global');
    const countries: string[] = isHunt ? (target.geography.countries || []) : (target.countries || []);
    const excludedCountries: string[] = isHunt ? (target.geography.excludedCountries || []) : (target.excludedCountries || []);

    const hasSpecificGeography = continents.length > 0 || countries.length > 0;
    const isGlobal = isHunt
      ? (target.geography.mode === 'global' && !hasSpecificGeography)
      : (!hasSpecificGeography);

    // 3. Industry parameters
    const rawIndustries: string[] = isHunt ? (target.sectors || []) : (target.industries || []);
    const isAllIndustries = !rawIndustries.length ||
      rawIndustries.some((i: string) => i.toLowerCase() === 'all' || i.toLowerCase() === 'all industries');
    const industries = isAllIndustries ? [] : rawIndustries;
    const subIndustries: string[] = isHunt ? (target.businessModels || []) : (target.subIndustries || []);

    // 4. Normalized fields
    const norm = pkg.seed_data.normalized;
    const raw = pkg.seed_data.raw_fields;

    const criteria: LeadQualificationSummary['criteria'] = {};
    const passedCriteria: string[] = [];
    const failedCriteria: string[] = [];
    const missingCriteria: string[] = [];
    const reviewCriteria: string[] = [];

    // Helper for criteria mode & weights
    const getSetting = (key: string, defMode: 'enabled' | 'disabled' | 'informational', defReq: 'required' | 'optional', defWeight: number) => {
      const custom = target.criteriaSettings?.[key] || {};
      let mode = custom.mode ?? defMode;
      let req = custom.requirement ?? defReq;
      let weight = custom.weight ?? defWeight;

      if (key === 'ceo' && target.ceoRequired !== undefined) {
        req = target.ceoRequired ? 'required' : 'optional';
        mode = target.ceoRequired ? 'enabled' : (target.ceoMode || 'optional');
      }
      if (key === 'companyEmail' && target.companyEmailRequired !== undefined) {
        req = target.companyEmailRequired ? 'required' : 'optional';
        mode = target.companyEmailRequired ? 'enabled' : (target.companyEmailMode || 'enabled');
      }
      if (key === 'ceoEmail' && target.ceoEmailRequired !== undefined) {
        req = target.ceoEmailRequired ? 'required' : 'optional';
        mode = target.ceoEmailRequired ? 'enabled' : (target.ceoEmailMode || 'disabled');
      }
      if (key === 'companyLinkedIn' && target.companyLinkedInRequired !== undefined) {
        req = target.companyLinkedInRequired ? 'required' : 'optional';
        mode = target.companyLinkedInRequired ? 'enabled' : (target.companyLinkedInMode || 'disabled');
      }
      if (key === 'ceoLinkedIn' && target.ceoLinkedInRequired !== undefined) {
        req = target.ceoLinkedInRequired ? 'required' : 'optional';
        mode = target.ceoLinkedInRequired ? 'enabled' : (target.ceoLinkedInMode || 'disabled');
      }

      return { mode, req, weight };
    };

    const addCrit = (
      key: string,
      name: string,
      category: string,
      status: 'PASS' | 'FAIL' | 'UNKNOWN' | 'CONTRADICTED',
      requiredVal: string,
      actualVal: string,
      reason: string,
      evidence: string | undefined,
      defSetting: { mode: 'enabled' | 'disabled' | 'informational'; req: 'required' | 'optional'; weight: number }
    ) => {
      const setting = getSetting(key, defSetting.mode, defSetting.req, defSetting.weight);
      let active = setting.mode === 'enabled';
      let effStatus: any = status;
      let effWeight = setting.weight;

      if (setting.mode === 'disabled') {
        active = false;
        effStatus = 'DISABLED';
        effWeight = 0;
      } else if (setting.mode === 'informational') {
        active = false;
        effWeight = 0;
        if (status === 'FAIL') effStatus = 'INFORMATIONAL';
      }

      criteria[key] = {
        name,
        category,
        active,
        status: effStatus,
        requiredValue: requiredVal,
        actualValue: actualVal,
        reason,
        evidence,
        weight: effWeight,
      };

      if (active) {
        if (effStatus === 'PASS') {
          passedCriteria.push(reason);
        } else if (effStatus === 'FAIL') {
          if (setting.req === 'required') failedCriteria.push(reason);
        } else if (effStatus === 'UNKNOWN') {
          if (setting.req === 'required') missingCriteria.push(reason);
        } else if (effStatus === 'CONTRADICTED') {
          reviewCriteria.push(reason);
        }
      } else {
        if (effStatus === 'PASS' || effStatus === 'INFORMATIONAL') {
          passedCriteria.push(`${name} (Informational)`);
        }
      }
    }

    // --- 1. CRITERION: Company Identity & Website ---
    const hasName = Boolean(norm.company_name && norm.company_name.trim().length >= 2 && norm.company_name !== 'Unknown Entity');
    const hasWebsite = Boolean(norm.website && norm.website.trim().length >= 3);

    if (hasName && hasWebsite) {
      addCrit(
        'identity',
        'Company Identity',
        'identity',
        'PASS',
        'Authentic name & active website',
        `${norm.company_name} (${norm.website})`,
        `Company identity confirmed in internal dataset: ${norm.company_name}`,
        norm.website || undefined,
        { mode: 'enabled', req: 'required', weight: 20 }
      );
    } else if (!hasName) {
      addCrit(
        'identity',
        'Company Identity',
        'identity',
        'FAIL',
        'Authentic name',
        'Missing / blank name',
        'Company name is missing from uploaded record',
        undefined,
        { mode: 'enabled', req: 'required', weight: 20 }
      );
    } else {
      // Name present but website missing or placeholder
      addCrit(
        'identity',
        'Company Identity',
        'identity',
        'UNKNOWN',
        'Active company website',
        norm.website || 'Missing website',
        'Company website is missing or malformed in uploaded record',
        undefined,
        { mode: 'enabled', req: 'required', weight: 20 }
      );
    }

    // --- 2. CRITERION: Geography ---
    const candCountry = norm.country || '';
    if (isGlobal) {
      addCrit(
        'geography',
        'Geography',
        'geography',
        'PASS',
        'Global — all countries allowed',
        candCountry || norm.location || 'Global',
        'Global coverage — all countries allowed (no geographic restrictions)',
        norm.location || candCountry || undefined,
        { mode: 'informational', req: 'optional', weight: 0 }
      );
    } else {
      const targetLabels = [...continents, ...countries];
      const isExcluded = candCountry && excludedCountries.some(e =>
        candCountry.toLowerCase().includes(e.toLowerCase()) || e.toLowerCase().includes(candCountry.toLowerCase())
      );

      if (isExcluded) {
        addCrit(
          'geography',
          'Geography',
          'geography',
          'FAIL',
          `Allowed: ${targetLabels.join(', ')}`,
          candCountry,
          `Location in excluded country (${candCountry})`,
          norm.location || candCountry,
          { mode: 'enabled', req: 'required', weight: 25 }
        );
      } else if (!candCountry && !norm.location) {
        addCrit(
          'geography',
          'Geography',
          'geography',
          'UNKNOWN',
          targetLabels.join(', '),
          'Missing country / location',
          'Country/location is not specified in uploaded record',
          undefined,
          { mode: 'enabled', req: 'required', weight: 25 }
        );
      } else {
        const mockHuntConfig: HuntConfig = isHunt ? target : {
          geography: {
            mode: continents.length > 0 && countries.length > 0 ? 'union' : continents.length > 0 ? 'continents' : 'countries',
            regions: continents,
            continents,
            countries,
            excludedCountries,
          },
          sectors: [],
          businessModels: [],
          stage: [],
          funding: { min: fMin, max: fMax, mode: 'funding' },
          techProfile: 'platform_required',
          contactRequirement: 'ceo_or_cofounder',
          emailVerification: 'required',
          depth: 'balanced',
          targetLeads: 15,
        };

        const geoCheck = checkGeographyMatch(
          `Location: ${norm.city || ''} ${candCountry} ${norm.location || ''}`,
          norm.website || '',
          mockHuntConfig
        );

        if (geoCheck.passed) {
          addCrit(
            'geography',
            'Geography',
            'geography',
            'PASS',
            targetLabels.join(', '),
            geoCheck.detectedCountry || candCountry,
            `Matches target geography: ${geoCheck.detectedCountry || candCountry}`,
            norm.location || candCountry,
            { mode: 'enabled', req: 'required', weight: 25 }
          );
        } else {
          addCrit(
            'geography',
            'Geography',
            'geography',
            'FAIL',
            targetLabels.join(', '),
            candCountry || 'Unknown',
            `Location (${candCountry || 'Unknown'}) does not match target geography: ${targetLabels.join(', ')}`,
            norm.location || candCountry,
            { mode: 'enabled', req: 'required', weight: 25 }
          );
        }
      }
    }

    // --- 3. CRITERION: Funding ---
    const formatUsd = (n: number) => `$${Math.round(n).toLocaleString()} USD`;
    const fAmount = norm.funding_amount_usd;

    if (fAmount !== null && fAmount !== undefined) {
      if (fAmount > fMax) {
        addCrit(
          'funding',
          'Funding',
          'funding',
          'FAIL',
          `${formatUsd(fMin)} – ${formatUsd(fMax)}`,
          formatUsd(fAmount),
          `Funding ${formatUsd(fAmount)} exceeds configured maximum ${formatUsd(fMax)}`,
          norm.funding || undefined,
          { mode: 'enabled', req: 'required', weight: 25 }
        );
      } else if (fAmount < fMin) {
        addCrit(
          'funding',
          'Funding',
          'funding',
          'FAIL',
          `${formatUsd(fMin)} – ${formatUsd(fMax)}`,
          formatUsd(fAmount),
          `Funding ${formatUsd(fAmount)} is below configured minimum ${formatUsd(fMin)}`,
          norm.funding || undefined,
          { mode: 'enabled', req: 'required', weight: 25 }
        );
      } else {
        addCrit(
          'funding',
          'Funding',
          'funding',
          'PASS',
          `${formatUsd(fMin)} – ${formatUsd(fMax)}`,
          formatUsd(fAmount),
          `Funding ${formatUsd(fAmount)} satisfies target range ${formatUsd(fMin)} – ${formatUsd(fMax)}`,
          norm.funding || undefined,
          { mode: 'enabled', req: 'required', weight: 25 }
        );
      }
    } else {
      // Check if placeholder or empty
      const hasFundingPlaceholder = pkg.audit.placeholders.some(p => p.field.toLowerCase().includes('funding'));
      addCrit(
        'funding',
        'Funding',
        'funding',
        'UNKNOWN',
        `${formatUsd(fMin)} – ${formatUsd(fMax)}`,
        hasFundingPlaceholder ? 'Placeholder / Locked' : (norm.funding || 'Missing in file'),
        hasFundingPlaceholder
          ? 'Funding figure is locked/placeholder in internal dataset'
          : 'No funding amount documented in internal dataset',
        undefined,
        { mode: 'enabled', req: 'required', weight: 25 }
      );
    }

    // --- 4. CRITERION: Industry ---
    if (isAllIndustries) {
      addCrit(
        'industry',
        'Industry',
        'industry',
        'PASS',
        'All Industries',
        norm.industry || 'All',
        'All industries allowed — industry is informational',
        norm.industry || undefined,
        { mode: 'informational', req: 'optional', weight: 0 }
      );
    } else {
      if (!norm.industry && !norm.description) {
        addCrit(
          'industry',
          'Industry',
          'industry',
          'UNKNOWN',
          industries.join(', '),
          'Missing industry',
          'Industry is not specified in internal record',
          undefined,
          { mode: 'enabled', req: 'required', weight: 20 }
        );
      } else {
        const indCheck = checkIndustryFit(
          norm.description || null,
          norm.industry || null,
          'platform_required',
          industries,
          subIndustries
        );

        if (indCheck.passed) {
          addCrit(
            'industry',
            'Industry',
            'industry',
            'PASS',
            industries.join(', '),
            norm.industry || 'Matched',
            `Matches target industry (${norm.industry || 'Technology'})`,
            norm.industry || undefined,
            { mode: 'enabled', req: 'required', weight: 20 }
          );
        } else {
          addCrit(
            'industry',
            'Industry',
            'industry',
            'FAIL',
            industries.join(', '),
            norm.industry || 'Non-matching',
            indCheck.reason || `Industry (${norm.industry || 'Unknown'}) does not match target industries: ${industries.join(', ')}`,
            norm.industry || undefined,
            { mode: 'enabled', req: 'required', weight: 20 }
          );
        }
      }
    }

    // --- 5. CRITERION: CEO / Founder ---
    const founderVal = norm.founder_or_ceo;
    const isFounderPlaceholder = pkg.audit.placeholders.some(p =>
      p.field.toLowerCase().includes('ceo') || p.field.toLowerCase().includes('founder')
    );

    if (founderVal && !isFounderPlaceholder) {
      addCrit(
        'ceo',
        'CEO / Founder',
        'leadership',
        'PASS',
        'Identified Executive Leadership',
        founderVal,
        `Executive leader documented in internal file: ${founderVal}`,
        founderVal,
        { mode: 'enabled', req: 'optional', weight: 15 }
      );
    } else if (isFounderPlaceholder) {
      addCrit(
        'ceo',
        'CEO / Founder',
        'leadership',
        'UNKNOWN',
        'Identified Executive Leadership',
        'UPGRADE TO UNLOCK / Placeholder',
        'CEO/Founder is paywalled/placeholder in uploaded record',
        undefined,
        { mode: 'enabled', req: 'optional', weight: 15 }
      );
    } else {
      addCrit(
        'ceo',
        'CEO / Founder',
        'leadership',
        'UNKNOWN',
        'Identified Executive Leadership',
        'Not documented in record',
        'CEO/Founder not provided in internal record',
        undefined,
        { mode: 'enabled', req: 'optional', weight: 15 }
      );
    }

    // --- 6. CRITERION: Company Email ---
    const compEmail = norm.company_email;
    if (compEmail) {
      addCrit(
        'companyEmail',
        'Company Email',
        'contact',
        'PASS',
        'Valid company contact email',
        compEmail,
        `Company email documented in internal file: ${compEmail}`,
        compEmail,
        { mode: 'enabled', req: 'optional', weight: 10 }
      );
    } else {
      addCrit(
        'companyEmail',
        'Company Email',
        'contact',
        'UNKNOWN',
        'Valid company contact email',
        'Not documented in record',
        'Company contact email not provided in internal record',
        undefined,
        { mode: 'enabled', req: 'optional', weight: 10 }
      );
    }

    // --- 7. CRITERION: CEO Email ---
    const ceoEmailVal = norm.ceo_email;
    if (ceoEmailVal) {
      addCrit(
        'ceoEmail',
        'CEO Professional Email',
        'contact',
        'PASS',
        'Direct executive email',
        ceoEmailVal,
        `Direct CEO email documented in internal file: ${ceoEmailVal}`,
        ceoEmailVal,
        { mode: 'disabled', req: 'optional', weight: 10 }
      );
    } else {
      addCrit(
        'ceoEmail',
        'CEO Professional Email',
        'contact',
        'UNKNOWN',
        'Direct executive email',
        'Not documented in record',
        'Direct executive email not documented in internal record',
        undefined,
        { mode: 'disabled', req: 'optional', weight: 10 }
      );
    }

    // --- 8. CRITERION: Company LinkedIn ---
    const compLi = norm.company_linkedin;
    if (compLi) {
      addCrit(
        'companyLinkedIn',
        'Company LinkedIn',
        'social',
        'PASS',
        'Company LinkedIn profile',
        compLi,
        `Company LinkedIn documented in internal file: ${compLi}`,
        compLi,
        { mode: 'enabled', req: 'optional', weight: 10 }
      );
    } else {
      addCrit(
        'companyLinkedIn',
        'Company LinkedIn',
        'social',
        'UNKNOWN',
        'Company LinkedIn profile',
        'Not documented in record',
        'Company LinkedIn not documented in internal record',
        undefined,
        { mode: 'enabled', req: 'optional', weight: 10 }
      );
    }

    // --- 9. CRITERION: CEO LinkedIn ---
    const ceoLi = norm.ceo_linkedin;
    if (ceoLi) {
      addCrit(
        'ceoLinkedIn',
        'CEO LinkedIn',
        'social',
        'PASS',
        'CEO LinkedIn profile',
        ceoLi,
        `CEO LinkedIn profile documented in internal file: ${ceoLi}`,
        ceoLi,
        { mode: 'enabled', req: 'optional', weight: 10 }
      );
    } else {
      addCrit(
        'ceoLinkedIn',
        'CEO LinkedIn',
        'social',
        'UNKNOWN',
        'CEO LinkedIn profile',
        'Not documented in record',
        'CEO LinkedIn profile not documented in internal record',
        undefined,
        { mode: 'enabled', req: 'optional', weight: 10 }
      );
    }

    // --- 10. SCORING & FINAL STATUS MAPPING ---
    let totalActiveWeight = 0;
    let earnedPoints = 0;

    for (const c of Object.values(criteria)) {
      if (c.active) {
        totalActiveWeight += c.weight;
        if (c.status === 'PASS') {
          earnedPoints += c.weight;
        }
      }
    }

    const matchScore = totalActiveWeight > 0 ? Math.round((earnedPoints / totalActiveWeight) * 100) : 100;
    const matchPercentage = `${matchScore}%`;

    // EXACT FOUR VISIBLE STATUSES:
    // VERIFIED: The supplied uploaded data satisfies all active required Target Profile criteria.
    // REVIEW: The supplied data contains ambiguous, conflicting, or unresolved information that needs human judgment.
    // UNVERIFIED: Required information is missing or insufficient to verify the criterion.
    // REJECTED: At least one active required criterion definitely fails.

    let finalStatus: FinalLeadStatus;
    let verdictReason = '';
    let rejectionReason: string | undefined;
    let reviewReason: string | undefined;
    let unverifiedReason: string | undefined;

    if (failedCriteria.length > 0) {
      finalStatus = 'REJECTED';
      rejectionReason = failedCriteria[0];
      verdictReason = `Definite criterion mismatch: ${failedCriteria.join('; ')}`;
    } else if (reviewCriteria.length > 0) {
      finalStatus = 'REVIEW';
      reviewReason = reviewCriteria.join('; ');
      verdictReason = `Ambiguous or conflicting internal data: ${reviewCriteria.join('; ')}`;
    } else if (missingCriteria.length > 0) {
      finalStatus = 'UNVERIFIED';
      unverifiedReason = missingCriteria.join('; ');
      verdictReason = `Required criteria missing in internal record: ${missingCriteria.join('; ')}`;
    } else {
      finalStatus = 'VERIFIED';
      verdictReason = 'All active required Target Profile criteria satisfied by uploaded record.';
    }

    const qualification: LeadQualificationSummary = {
      target_profile_id: target.id || 'target_profile_active',
      match_percentage: matchPercentage,
      match_score: matchScore,
      criteria,
      passedCriteria,
      failedCriteria,
      missingCriteria,
      reviewCriteria,
      exactReason: verdictReason,
    };

    return {
      finalStatus,
      qualification,
      verdictReason,
      rejectionReason,
      reviewReason,
      unverifiedReason,
    };
  } catch (err: any) {
    // Normalization rule: processing errors MUST NOT become a fifth visible status.
    // Normalize to UNVERIFIED with error audit.
    const errMessage = err.message || 'Internal qualification evaluation failed';
    return {
      finalStatus: 'UNVERIFIED',
      verdictReason: `Evaluation error: ${errMessage}`,
      unverifiedReason: `Evaluation error: ${errMessage}`,
      qualification: {
        match_percentage: '0%',
        match_score: 0,
        criteria: {
          error: {
            name: 'Processing Error',
            category: 'error',
            active: true,
            status: 'UNKNOWN',
            reason: errMessage,
            weight: 0,
          },
        },
        passedCriteria: [],
        failedCriteria: [],
        missingCriteria: [errMessage],
        reviewCriteria: [],
        exactReason: `Error during evaluation: ${errMessage}`,
      },
    };
  }
}
