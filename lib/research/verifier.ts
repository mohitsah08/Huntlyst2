/**
 * Huntlyst External: Deterministic Verification Engine
 * 
 * Evaluates already saved CompanyResearchProfiles against independent TargetCriteria.
 * ZERO scraping or network requests happen in this module.
 * 
 * Strict Evaluation Invariants:
 * - Each criterion produces PASS, FAIL, or UNKNOWN.
 * - Missing or undisclosed facts produce UNKNOWN, NEVER PASS.
 * - Facts demonstrably outside bounds produce FAIL.
 * - Missing funding with a funding range produces UNKNOWN.
 * - Undisclosed geography with a country requirement produces UNKNOWN.
 */

import {
  CompanyResearchProfile,
  TargetCriteria,
  VerificationRun,
  CriterionVerificationResult,
  OverallQualificationStatus,
  CriterionOutcome,
} from './types';

export function evaluateCompanyProfile(
  profile: CompanyResearchProfile,
  criteria: TargetCriteria
): VerificationRun {
  const verifiedAt = new Date().toISOString();
  const results: Record<string, CriterionVerificationResult> = {};
  
  let passedCount = 0;
  let failedCount = 0;
  let unknownCount = 0;
  let hasConflicts = false;

  const addResult = (
    key: string,
    name: string,
    status: CriterionOutcome,
    required: string,
    actual: string | null,
    reason: string,
    evidence: string | null = null,
    sourceUrl: string | null = null
  ) => {
    results[key] = {
      criterionKey: key,
      name,
      status,
      required,
      actual,
      reason,
      evidence,
      sourceUrl,
    };

    if (status === 'PASS') passedCount++;
    else if (status === 'FAIL') failedCount++;
    else if (status === 'UNKNOWN') unknownCount++;
  };

  // 1. Funding Evaluation
  const fMin = criteria.fundingMinUsd;
  const fMax = criteria.fundingMaxUsd;
  const fundingReqStr = (fMin !== null || fMax !== null)
    ? `$${(fMin ?? 0).toLocaleString()} – $${(fMax ?? Infinity).toLocaleString()} USD`
    : 'Any funding amount';

  if (fMin !== null || fMax !== null) {
    const totalFunding = profile.funding.totalFundingUsd;
    const latestRound = profile.funding.latestRoundUsd;
    // Relevant candidate figure: prefer total funding, fallback to latest round
    const relevantFunding = totalFunding ?? latestRound;
    const fundingEvidence = profile.fieldEvidence['funding.totalFundingUsd'] || profile.fieldEvidence['funding.latestRoundUsd'];

    if (relevantFunding === null || relevantFunding === undefined) {
      addResult(
        'funding',
        'Funding Range',
        'UNKNOWN',
        fundingReqStr,
        'Undisclosed / Unknown',
        'No verifiable venture funding or financial round documented in public sources',
        null,
        null
      );
    } else {
      const actualStr = `$${Math.round(relevantFunding).toLocaleString()} USD` + 
        (profile.funding.latestRoundType ? ` (${profile.funding.latestRoundType})` : '');

      if (fMin !== null && relevantFunding < fMin) {
        addResult(
          'funding',
          'Funding Range',
          'FAIL',
          fundingReqStr,
          actualStr,
          `Documented funding ($${Math.round(relevantFunding).toLocaleString()} USD) is below required minimum ($${fMin.toLocaleString()} USD)`,
          fundingEvidence?.excerpt || null,
          fundingEvidence?.sourceUrl || null
        );
      } else if (fMax !== null && relevantFunding > fMax) {
        addResult(
          'funding',
          'Funding Range',
          'FAIL',
          fundingReqStr,
          actualStr,
          `Documented funding ($${Math.round(relevantFunding).toLocaleString()} USD) exceeds required maximum ($${fMax.toLocaleString()} USD)`,
          fundingEvidence?.excerpt || null,
          fundingEvidence?.sourceUrl || null
        );
      } else {
        addResult(
          'funding',
          'Funding Range',
          'PASS',
          fundingReqStr,
          actualStr,
          `Documented funding ($${Math.round(relevantFunding).toLocaleString()} USD) falls within the target range`,
          fundingEvidence?.excerpt || null,
          fundingEvidence?.sourceUrl || null
        );
      }
    }
  }

  // 2. Geography / Country Evaluation
  const reqCountries = (criteria.requiredCountries || []).map(c => c.trim().toLowerCase());
  const reqRegions = (criteria.requiredRegions || []).map(r => r.trim().toLowerCase());
  const exclCountries = (criteria.excludedCountries || []).map(c => c.trim().toLowerCase());

  const hasGeoConstraint = reqCountries.length > 0 || reqRegions.length > 0 || exclCountries.length > 0;
  const geoReqStr = reqCountries.length > 0
    ? `Countries: ${criteria.requiredCountries.join(', ')}`
    : reqRegions.length > 0
    ? `Regions: ${criteria.requiredRegions.join(', ')}`
    : 'Global (No restrictions)';

  if (hasGeoConstraint) {
    const hqCountry = profile.headquarters.country;
    const hqEvidence = profile.fieldEvidence['headquarters.country'];

    if (!hqCountry) {
      addResult(
        'geography',
        'Headquarters Geography',
        'UNKNOWN',
        geoReqStr,
        'Undisclosed / Unknown',
        'No supporting geography evidence found for company headquarters location',
        null,
        null
      );
    } else {
      const lowerHq = hqCountry.toLowerCase().trim();
      const isExcluded = exclCountries.some(ex => lowerHq.includes(ex) || ex.includes(lowerHq));

      if (isExcluded) {
        addResult(
          'geography',
          'Headquarters Geography',
          'FAIL',
          `Allowed: ${geoReqStr} (Excluded: ${criteria.excludedCountries.join(', ')})`,
          profile.headquarters.country,
          `Headquarters in excluded country: ${profile.headquarters.country}`,
          hqEvidence?.excerpt || null,
          hqEvidence?.sourceUrl || null
        );
      } else if (reqCountries.length > 0) {
        const matchesRequired = reqCountries.some(rc => 
          lowerHq.includes(rc) || rc.includes(lowerHq) ||
          (rc.includes('united kingdom') && (lowerHq.includes('uk') || lowerHq.includes('england') || lowerHq.includes('scotland'))) ||
          (rc.includes('united states') && (lowerHq.includes('usa') || lowerHq.includes('us')))
        );

        if (matchesRequired) {
          addResult(
            'geography',
            'Headquarters Geography',
            'PASS',
            geoReqStr,
            profile.headquarters.country,
            `Headquarters matches required country: ${profile.headquarters.country}`,
            hqEvidence?.excerpt || null,
            hqEvidence?.sourceUrl || null
          );
        } else {
          addResult(
            'geography',
            'Headquarters Geography',
            'FAIL',
            geoReqStr,
            profile.headquarters.country,
            `Headquarters (${profile.headquarters.country}) does not match required countries (${criteria.requiredCountries.join(', ')})`,
            hqEvidence?.excerpt || null,
            hqEvidence?.sourceUrl || null
          );
        }
      } else {
        // Only region or exclusion
        addResult(
          'geography',
          'Headquarters Geography',
          'PASS',
          geoReqStr,
          profile.headquarters.country,
          `Headquarters located in non-excluded country: ${profile.headquarters.country}`,
          hqEvidence?.excerpt || null,
          hqEvidence?.sourceUrl || null
        );
      }
    }
  }

  // 3. US Presence Evaluation
  if (criteria.usPresenceMode === 'non_us_only') {
    const usPres = profile.usPresence;
    const usEvidence = profile.fieldEvidence['usPresence'];

    if (usPres === null || usPres === undefined) {
      addResult(
        'usPresence',
        'Non-US Presence Only',
        'UNKNOWN',
        'Non-US presence only (no US HQ or major offices)',
        'Undisclosed / Unknown',
        'Insufficient public evidence to verify presence or absence of US operations',
        null,
        null
      );
    } else if (usPres === true) {
      addResult(
        'usPresence',
        'Non-US Presence Only',
        'FAIL',
        'Non-US presence only (no US HQ or major offices)',
        'US Presence Detected',
        `Company has verified US presence (headquarters or major operating office in US: ${profile.headquarters.country || 'USA'})`,
        usEvidence?.excerpt || null,
        usEvidence?.sourceUrl || null
      );
    } else {
      addResult(
        'usPresence',
        'Non-US Presence Only',
        'PASS',
        'Non-US presence only (no US HQ or major offices)',
        'No US Presence',
        'Verified headquarters and primary operations are outside the United States',
        usEvidence?.excerpt || null,
        usEvidence?.sourceUrl || null
      );
    }
  }

  // 4. Industry Evaluation
  const allowedInds = (criteria.allowedIndustries || []).map(i => i.trim().toLowerCase());
  if (allowedInds.length > 0 && !allowedInds.includes('all') && !allowedInds.includes('all industries')) {
    const actualInd = profile.primaryIndustry;
    const actualSub = profile.subIndustry;
    const indEvidence = profile.fieldEvidence['primaryIndustry'];

    if (!actualInd) {
      addResult(
        'industry',
        'Industry Taxonomy',
        'UNKNOWN',
        `Allowed: ${criteria.allowedIndustries.join(', ')}`,
        'Undisclosed / Unknown',
        'No verified industry classification documented from sources',
        null,
        null
      );
    } else {
      const lowerInd = actualInd.toLowerCase();
      const lowerSub = (actualSub || '').toLowerCase();
      const matches = allowedInds.some(ai => 
        lowerInd.includes(ai) || ai.includes(lowerInd) ||
        (lowerSub && (lowerSub.includes(ai) || ai.includes(lowerSub)))
      );

      if (matches) {
        addResult(
          'industry',
          'Industry Taxonomy',
          'PASS',
          `Allowed: ${criteria.allowedIndustries.join(', ')}`,
          actualInd + (actualSub ? ` / ${actualSub}` : ''),
          `Industry classification matches target profile: ${actualInd}`,
          indEvidence?.excerpt || null,
          indEvidence?.sourceUrl || null
        );
      } else {
        addResult(
          'industry',
          'Industry Taxonomy',
          'FAIL',
          `Allowed: ${criteria.allowedIndustries.join(', ')}`,
          actualInd + (actualSub ? ` / ${actualSub}` : ''),
          `Documented industry (${actualInd}) does not match allowed industries (${criteria.allowedIndustries.join(', ')})`,
          indEvidence?.excerpt || null,
          indEvidence?.sourceUrl || null
        );
      }
    }
  }

  // 5. Leadership Roles (e.g. CEO or Founders)
  if (criteria.requireCeo) {
    const ceo = profile.leadership.ceo;
    const ceoEvidence = profile.fieldEvidence['leadership.ceo'];
    if (ceo && ceo.name) {
      addResult(
        'ceo',
        'CEO Identification',
        'PASS',
        'Verified current CEO',
        `${ceo.name} (${ceo.title || 'CEO'})`,
        `Current CEO verified from official or authoritative sources: ${ceo.name}`,
        ceoEvidence?.excerpt || ceo.evidence || null,
        ceoEvidence?.sourceUrl || ceo.sourceUrl || null
      );
    } else {
      addResult(
        'ceo',
        'CEO Identification',
        'UNKNOWN',
        'Verified current CEO',
        'Undisclosed / Unknown',
        'Current Chief Executive Officer could not be verified from public sources',
        null,
        null
      );
    }
  }

  if (criteria.requireFounders) {
    const founders = [...profile.leadership.founders, ...profile.leadership.coFounders];
    const founderEvidence = profile.fieldEvidence['leadership.founders'];
    if (founders.length > 0) {
      const names = Array.from(new Set(founders.map(f => f.name))).join(', ');
      addResult(
        'founders',
        'Founder / Co-Founder Identification',
        'PASS',
        'Documented founder or co-founder',
        names,
        `Founders verified from authoritative sources: ${names}`,
        founderEvidence?.excerpt || null,
        founderEvidence?.sourceUrl || null
      );
    } else {
      addResult(
        'founders',
        'Founder / Co-Founder Identification',
        'UNKNOWN',
        'Documented founder or co-founder',
        'Undisclosed / Unknown',
        'Company founders or co-founders could not be identified from public sources',
        null,
        null
      );
    }
  }

  // 6. Public Contact Email
  if (criteria.requirePublicEmail) {
    const email = profile.contacts.generalEmail || (profile.contacts.executiveEmails[0]?.email ?? null);
    const emailEvidence = profile.fieldEvidence['contacts.generalEmail'] || profile.fieldEvidence['contacts.executiveEmails'];
    if (email) {
      addResult(
        'publicEmail',
        'Public Business Email',
        'PASS',
        'Authentic publicly listed business email',
        email,
        `Public business email verified from source page: ${email}`,
        emailEvidence?.excerpt || null,
        emailEvidence?.sourceUrl || null
      );
    } else {
      addResult(
        'publicEmail',
        'Public Business Email',
        'UNKNOWN',
        'Authentic publicly listed business email',
        'Not Publicly Disclosed',
        'No public business email address disclosed in accessible public sources',
        null,
        null
      );
    }
  }

  // Check for any conflicting evidence flagged in profile
  for (const [k, ev] of Object.entries(profile.fieldEvidence)) {
    if (ev.isConflict) {
      hasConflicts = true;
      break;
    }
  }

  // Compute Overall Status
  let overallStatus: OverallQualificationStatus;
  let summaryReason: string;

  if (failedCount > 0) {
    overallStatus = 'REJECTED';
    const failedItems = Object.values(results).filter(r => r.status === 'FAIL');
    summaryReason = `Failed criteria: ${failedItems.map(f => `${f.name} (${f.reason})`).join('; ')}`;
  } else if (hasConflicts) {
    overallStatus = 'REVIEW';
    summaryReason = 'Competing evidence detected across public sources. Human verification review recommended.';
  } else if (unknownCount > 0) {
    overallStatus = 'UNVERIFIED';
    const unknownItems = Object.values(results).filter(r => r.status === 'UNKNOWN');
    summaryReason = `Missing required evidence for: ${unknownItems.map(u => u.name).join(', ')}`;
  } else {
    overallStatus = 'VERIFIED';
    summaryReason = 'All configured target criteria successfully verified against evidence-backed facts.';
  }

  const totalCriteria = passedCount + failedCount + unknownCount;
  const qualificationScore = totalCriteria > 0 ? Math.round((passedCount / totalCriteria) * 100) : 0;

  return {
    id: `verif_${profile.id}_${Date.now()}`,
    companyId: profile.id,
    canonicalDomain: profile.canonicalDomain,
    targetCriteriaId: criteria.id,
    targetCriteriaVersion: criteria.version,
    targetCriteriaName: criteria.name,
    overallStatus,
    qualificationScore,
    summaryReason,
    criteria: results,
    passedCount,
    failedCount,
    unknownCount,
    verifiedAt,
    isOutdated: false,
  };
}
