/**
 * Claude Company Qualification & Criterion-by-Criterion Evaluator
 * 
 * Evaluates candidate companies strictly against customized TargetProfile criteria.
 * Zero hallucination policy: Every unverified field is explicitly marked UNKNOWN.
 */

import { TargetProfile, DEFAULT_TVB_TARGET_PROFILE } from '@/lib/targetProfileData';
import { HuntConfig, CompanyRecord } from '@/lib/types';
import {
  CriterionEvaluation,
  CriterionResult,
  CriterionStatus,
  CompanyVerificationResult,
  ResearchCandidateInput,
} from '../types';
import {
  checkFundingRange,
  checkIndustryFit,
  checkGeographyMatch,
  checkNoUSPresence,
  parseFundingDetails,
} from '@/lib/validation';
import { detectCountryFromEvidence, findCountry } from '@/lib/geography';
import { findVerifiedEmail } from '@/lib/email';
import { calculateHuntScore } from '@/lib/rank';

export interface RawExtractedProfile {
  name?: string | null;
  website?: string | null;
  description?: string | null;
  industry?: string | null;
  sector?: string | null;
  fundingText?: string | null;
  fundingAmountUsd?: number | null;
  revenueText?: string | null;
  foundedYear?: number | null;
  companyAgeYears?: number | null;
  stage?: string | null;
  businessModel?: string | null;
  employeeCountText?: string | null;
  country?: string | null;
  city?: string | null;
  headquarters?: string | null;
  usPresenceDetails?: string | null;
  hasUsOffice?: boolean | null;
  founderOrCeoName?: string | null;
  founderTitle?: string | null;
  founderLinkedin?: string | null;
  companyLinkedin?: string | null;
  decisionMakerName?: string | null;
  decisionMakerTitle?: string | null;
  emailFound?: string | null;
  sources?: string[];
  evidenceText?: string | null;
}

export function evaluateCriteria(
  profile: RawExtractedProfile,
  target: TargetProfile | HuntConfig,
  mxResult?: { email: string | null; verified: boolean; mxHost?: string | null }
): {
  criteria: CriterionEvaluation;
  status: 'QUALIFIED' | 'REJECTED' | 'PARTIALLY_VERIFIED' | 'UNVERIFIED';
  failedCriteria: string[];
  passedCriteria: string[];
  unknownCriteria: string[];
  rejectionReason?: string;
} {
  // Normalize target parameters
  const isHuntConfig = 'geography' in target && 'funding' in target && !('fundingMin' in target);
  
  const targetMinFunding = isHuntConfig
    ? (target as HuntConfig).funding.min
    : (target as TargetProfile).fundingMin ?? 1_000_000;

  const targetMaxFunding = isHuntConfig
    ? (target as HuntConfig).funding.max
    : (target as TargetProfile).fundingMax ?? 5_000_000;

  const targetCurrency = isHuntConfig
    ? 'USD'
    : (target as TargetProfile).fundingCurrency || 'USD';

  const targetIndustries = isHuntConfig
    ? (target as HuntConfig).sectors || ['all']
    : (target as TargetProfile).industries || ['Technology'];

  const targetSubIndustries = isHuntConfig
    ? (target as HuntConfig).businessModels || []
    : (target as TargetProfile).subIndustries || [];

  const targetCountries = isHuntConfig
    ? (target as HuntConfig).geography.countries || []
    : (target as TargetProfile).countries || [];

  const targetRegions = isHuntConfig
    ? (target as HuntConfig).geography.regions || []
    : (target as TargetProfile).regions || [];

  const excludedCountries = isHuntConfig
    ? (target as HuntConfig).geography.excludedCountries || []
    : (target as TargetProfile).excludedCountries || [];

  const usPresenceMode = isHuntConfig
    ? (target as HuntConfig).geography.usPresence || 'minimal_or_none'
    : (target as TargetProfile).usPresenceMode || 'minimal_or_none';

  const contactRequirement = isHuntConfig
    ? (target as HuntConfig).contactRequirement || 'ceo_or_cofounder'
    : (target as TargetProfile).contactRequirement || 'Required';

  const emailRequirement = isHuntConfig
    ? (target as HuntConfig).emailVerification || 'required'
    : (target as TargetProfile).emailRequirement || 'Required';

  const targetStages = isHuntConfig
    ? (target as HuntConfig).stage || []
    : (target as TargetProfile).companyStages || [];

  const targetFoundedFrom = !isHuntConfig ? (target as TargetProfile).foundedFrom : undefined;
  const targetFoundedTo = !isHuntConfig ? (target as TargetProfile).foundedTo : undefined;
  const targetCompanyAge = !isHuntConfig ? (target as TargetProfile).companyAge : undefined;

  const failedCriteria: string[] = [];
  const passedCriteria: string[] = [];
  const unknownCriteria: string[] = [];

  // 1. FUNDING CRITERION
  let fundingStatus: CriterionStatus = 'UNKNOWN';
  let fundingReason = '';
  const fundingText = profile.fundingText || profile.revenueText || null;
  const targetFundingDesc = `${targetCurrency} ${(targetMinFunding / 1e6).toFixed(1)}M - ${(targetMaxFunding / 1e6).toFixed(1)}M`;

  if (!fundingText) {
    fundingStatus = 'UNKNOWN';
    fundingReason = 'No verifiable public funding or revenue disclosure found';
    unknownCriteria.push('Funding');
  } else {
    const fundingCheck = checkFundingRange(fundingText, targetMinFunding, targetMaxFunding, targetCurrency as any);
    if (fundingCheck.passed) {
      fundingStatus = 'PASS';
      passedCriteria.push('Funding');
    } else {
      fundingStatus = 'FAIL';
      fundingReason = fundingCheck.reason || `Funding outside configured target (${targetFundingDesc})`;
      failedCriteria.push('Funding');
    }
  }

  const fundingResult: CriterionResult = {
    status: fundingStatus,
    value: fundingText || 'Not publicly reported',
    target: targetFundingDesc,
    evidence: profile.fundingText || profile.evidenceText || null,
    reason: fundingReason || (fundingStatus === 'PASS' ? 'Within target range' : 'Unverified funding amount'),
  };

  // 2. INDUSTRY CRITERION
  let industryStatus: CriterionStatus = 'UNKNOWN';
  let industryReason = '';
  const industryValue = profile.industry || profile.sector || null;

  if (!industryValue && !profile.description) {
    industryStatus = 'UNKNOWN';
    industryReason = 'Industry and core business activity unverified';
    unknownCriteria.push('Industry');
  } else {
    const indCheck = checkIndustryFit(
      profile.description || '',
      industryValue,
      'platform_required',
      targetIndustries,
      targetSubIndustries
    );
    if (indCheck.passed) {
      industryStatus = 'PASS';
      passedCriteria.push('Industry');
    } else {
      industryStatus = 'FAIL';
      industryReason = indCheck.reason || `Does not match target sectors (${targetIndustries.join(', ')})`;
      failedCriteria.push('Industry');
    }
  }

  const industryResult: CriterionResult = {
    status: industryStatus,
    value: industryValue || 'Unknown',
    target: targetIndustries.join(', ') || 'Any Industry',
    evidence: profile.description || profile.industry || null,
    reason: industryReason || 'Matches target industry profile',
  };

  // 3. COMPANY AGE / FOUNDED YEAR CRITERION
  let ageStatus: CriterionStatus = 'UNKNOWN';
  let ageReason = '';
  const currentYear = new Date().getFullYear();
  const foundedYear = profile.foundedYear;

  if (targetCompanyAge && targetCompanyAge !== 'Any' && (targetFoundedFrom || targetFoundedTo)) {
    if (!foundedYear) {
      ageStatus = 'UNKNOWN';
      ageReason = 'Founded year not publicly documented';
      unknownCriteria.push('Company Age');
    } else {
      const from = targetFoundedFrom || 1990;
      const to = targetFoundedTo || currentYear;
      if (foundedYear >= from && foundedYear <= to) {
        ageStatus = 'PASS';
        passedCriteria.push('Company Age');
      } else {
        ageStatus = 'FAIL';
        ageReason = `Founded in ${foundedYear}, outside targeted year range (${from}-${to})`;
        failedCriteria.push('Company Age');
      }
    }
  } else {
    // If target doesn't specify strict age, pass or unknown
    ageStatus = foundedYear ? 'PASS' : 'UNKNOWN';
    if (ageStatus === 'PASS') passedCriteria.push('Company Age');
  }

  const ageResult: CriterionResult = {
    status: ageStatus,
    value: foundedYear ? `${foundedYear} (${currentYear - foundedYear} yrs)` : 'Unknown',
    target: targetFoundedFrom && targetFoundedTo ? `${targetFoundedFrom} - ${targetFoundedTo}` : 'Any age',
    evidence: foundedYear ? `Founded year documented as ${foundedYear}` : null,
    reason: ageReason || (foundedYear ? 'Founded year verified' : 'Founding year not verified'),
  };

  // 4. GEOGRAPHY & COUNTRY CRITERION
  let geoStatus: CriterionStatus = 'UNKNOWN';
  let geoReason = '';
  const detectedCountry = profile.country || (profile.headquarters ? detectCountryFromEvidence(profile.headquarters, profile.website || '')?.name : null);

  if (targetCountries.length > 0) {
    if (!detectedCountry) {
      geoStatus = 'UNKNOWN';
      geoReason = 'Headquarters country could not be conclusively determined';
      unknownCriteria.push('Geography');
    } else {
      const normCountry = detectedCountry.toLowerCase();
      const match = targetCountries.some(c => c.toLowerCase() === normCountry);
      if (match) {
        geoStatus = 'PASS';
        passedCriteria.push('Geography');
      } else {
        geoStatus = 'FAIL';
        geoReason = `Located in ${detectedCountry}, not in targeted countries (${targetCountries.join(', ')})`;
        failedCriteria.push('Geography');
      }
    }
  } else if (targetRegions.length > 0 && !targetRegions.includes('Global')) {
    const regionObj = detectedCountry ? findCountry(detectedCountry) : null;
    const region = regionObj?.region || profile.headquarters;
    if (!region) {
      geoStatus = 'UNKNOWN';
      geoReason = 'Regional location undetermined';
      unknownCriteria.push('Geography');
    } else {
      const match = targetRegions.some(r => region.toLowerCase().includes(r.toLowerCase()));
      if (match) {
        geoStatus = 'PASS';
        passedCriteria.push('Geography');
      } else {
        geoStatus = 'FAIL';
        geoReason = `Regional location (${region}) outside targeted regions (${targetRegions.join(', ')})`;
        failedCriteria.push('Geography');
      }
    }
  } else {
    geoStatus = detectedCountry ? 'PASS' : 'UNKNOWN';
    if (geoStatus === 'PASS') passedCriteria.push('Geography');
    else unknownCriteria.push('Geography');
  }

  // Check excluded countries
  if (detectedCountry && excludedCountries.some(e => e.toLowerCase() === detectedCountry.toLowerCase())) {
    geoStatus = 'FAIL';
    geoReason = `Located in excluded country: ${detectedCountry}`;
    if (!failedCriteria.includes('Geography')) failedCriteria.push('Geography');
  }

  const geoResult: CriterionResult = {
    status: geoStatus,
    value: detectedCountry || profile.headquarters || 'Unknown',
    target: targetCountries.length > 0 ? targetCountries.join(', ') : (targetRegions.join(', ') || 'Global'),
    evidence: profile.headquarters || profile.usPresenceDetails || detectedCountry || null,
    reason: geoReason || 'Location confirmed within target territory',
  };

  // 5. US PRESENCE CRITERION
  let usStatus: CriterionStatus = 'UNKNOWN';
  let usReason = '';
  const usEvidence = `${profile.usPresenceDetails || ''} ${profile.headquarters || ''} ${profile.evidenceText || ''}`;
  const usVerdict = checkNoUSPresence(usEvidence, profile.website || '', usPresenceMode as any);

  if (usPresenceMode === 'any' || usPresenceMode === 'dont_care') {
    usStatus = 'PASS';
    passedCriteria.push('US Presence');
  } else if (usVerdict === true) {
    usStatus = 'FAIL';
    usReason = 'Significant US headquarters or primary operational entity identified';
    failedCriteria.push('US Presence');
  } else if (usVerdict === false) {
    usStatus = 'PASS';
    passedCriteria.push('US Presence');
  } else {
    usStatus = 'UNKNOWN';
    usReason = 'Insufficient evidence to verify absence of US entity';
    unknownCriteria.push('US Presence');
  }

  const usResult: CriterionResult = {
    status: usStatus,
    value: usVerdict === true ? 'US Presence Detected' : (usVerdict === false ? 'Non-US Confirmed' : 'Undetermined'),
    target: usPresenceMode === 'strictly_none' ? 'Strictly None' : (usPresenceMode === 'minimal_or_none' ? 'Minimal / None' : 'Any'),
    evidence: profile.usPresenceDetails || profile.headquarters || null,
    reason: usReason || 'Meets US presence policy',
  };

  // 6. COMPANY STAGE CRITERION
  let stageStatus: CriterionStatus = 'UNKNOWN';
  let stageReason = '';
  const detectedStage = profile.stage;

  if (targetStages.length > 0 && !targetStages.includes('All Stages')) {
    if (!detectedStage) {
      stageStatus = 'UNKNOWN';
      stageReason = 'Funding stage not publicly reported';
      unknownCriteria.push('Company Stage');
    } else {
      const match = targetStages.some(s => detectedStage.toLowerCase().includes(s.toLowerCase()));
      if (match) {
        stageStatus = 'PASS';
        passedCriteria.push('Company Stage');
      } else {
        stageStatus = 'FAIL';
        stageReason = `Stage (${detectedStage}) does not match targeted stages (${targetStages.join(', ')})`;
        failedCriteria.push('Company Stage');
      }
    }
  } else {
    stageStatus = detectedStage ? 'PASS' : 'UNKNOWN';
    if (stageStatus === 'PASS') passedCriteria.push('Company Stage');
  }

  const stageResult: CriterionResult = {
    status: stageStatus,
    value: detectedStage || 'Unknown',
    target: targetStages.length > 0 ? targetStages.join(', ') : 'Any Stage',
    evidence: detectedStage ? `Identified stage: ${detectedStage}` : null,
    reason: stageReason || 'Company stage verified',
  };

  // 7. FOUNDER / CEO / DECISION MAKER CRITERION
  let founderStatus: CriterionStatus = 'UNKNOWN';
  let founderReason = '';
  const founderName = profile.founderOrCeoName || profile.decisionMakerName;
  const isFounderRequired = contactRequirement === 'Required' || contactRequirement === 'ceo_only' || contactRequirement === 'cofounder_only' || contactRequirement === 'ceo_or_cofounder';

  if (founderName && founderName.trim().length >= 2) {
    founderStatus = 'PASS';
    passedCriteria.push('CEO/Founder');
  } else {
    if (isFounderRequired) {
      founderStatus = 'FAIL';
      founderReason = 'CEO or Co-founder identity not verified';
      failedCriteria.push('CEO/Founder');
    } else {
      founderStatus = 'UNKNOWN';
      founderReason = 'Decision maker not identified';
      unknownCriteria.push('CEO/Founder');
    }
  }

  const founderResult: CriterionResult = {
    status: founderStatus,
    value: founderName ? `${founderName} (${profile.founderTitle || 'Executive'})` : 'Unverified',
    target: 'CEO / Co-founder / Decision Maker',
    evidence: profile.founderLinkedin ? `LinkedIn: ${profile.founderLinkedin}` : (founderName ? `Verified name: ${founderName}` : null),
    reason: founderReason || 'Executive identity verified',
  };

  // 8. PROFESSIONAL EMAIL CRITERION
  let emailStatus: CriterionStatus = 'UNKNOWN';
  let emailReason = '';
  const finalEmail = mxResult?.email || profile.emailFound;
  const isEmailRequired = emailRequirement === 'Required' || emailRequirement === 'required';

  if (mxResult && mxResult.verified && mxResult.email) {
    emailStatus = 'PASS';
    passedCriteria.push('Professional Email');
  } else if (mxResult && (mxResult as any).status === 'PARTIALLY VERIFIED') {
    emailReason = (mxResult as any).reason || 'Domain MX active; Mailbox-level verification unavailable';
    if (!isEmailRequired) {
      emailStatus = 'PASS';
      passedCriteria.push('Professional Email');
    } else {
      emailStatus = 'UNKNOWN';
      unknownCriteria.push('Professional Email');
    }
  } else if (finalEmail && finalEmail.includes('@')) {
    if (isEmailRequired) {
      emailStatus = (mxResult as any)?.status === 'REJECTED' ? 'FAIL' : 'UNKNOWN';
      emailReason = (mxResult as any)?.reason || 'Email candidate identified but mailbox deliverability unconfirmed';
      if (emailStatus === 'FAIL') failedCriteria.push('Professional Email');
      else unknownCriteria.push('Professional Email');
    } else {
      emailStatus = 'PASS';
      passedCriteria.push('Professional Email');
    }
  } else {
    if (isEmailRequired) {
      emailStatus = 'FAIL';
      emailReason = (mxResult as any)?.reason || 'No verifiable executive email identified';
      failedCriteria.push('Professional Email');
    } else {
      emailStatus = 'UNKNOWN';
      emailReason = 'No email address documented';
      unknownCriteria.push('Professional Email');
    }
  }

  const emailResult: CriterionResult = {
    status: emailStatus,
    value: finalEmail || 'Undeliverable / Unverified',
    target: isEmailRequired ? 'Required (MX Verified)' : 'Preferred',
    evidence: mxResult?.mxHost ? `MX Host: ${mxResult.mxHost}` : (finalEmail ? `Email candidate: ${finalEmail}` : null),
    reason: emailReason || 'Mailbox routability verified on live DNS MX',
  };

  // 9. LINKEDIN / SOCIAL REQUIREMENT
  let linkedinStatus: CriterionStatus = 'UNKNOWN';
  const hasLinkedin = !!(profile.founderLinkedin || profile.companyLinkedin);
  if (hasLinkedin) {
    linkedinStatus = 'PASS';
    passedCriteria.push('LinkedIn');
  } else {
    linkedinStatus = 'UNKNOWN';
    unknownCriteria.push('LinkedIn');
  }

  const linkedinResult: CriterionResult = {
    status: linkedinStatus,
    value: profile.founderLinkedin || profile.companyLinkedin || 'Not found',
    target: 'Public Profile',
    evidence: profile.founderLinkedin || profile.companyLinkedin || null,
    reason: hasLinkedin ? 'LinkedIn profile verified' : 'No public LinkedIn profile identified',
  };

  // DETERMINE OVERALL STATUS
  let overallStatus: 'QUALIFIED' | 'REJECTED' | 'PARTIALLY_VERIFIED' | 'UNVERIFIED' = 'UNVERIFIED';
  let rejectionReason: string | undefined;

  if (failedCriteria.length > 0) {
    overallStatus = 'REJECTED';
    const firstFail = failedCriteria[0];
    if (firstFail === 'Funding') rejectionReason = fundingResult.reason || 'Funding outside configured range.';
    else if (firstFail === 'Industry') rejectionReason = industryResult.reason || 'Industry does not match target profile.';
    else if (firstFail === 'Geography') rejectionReason = geoResult.reason || 'Headquarters outside target territory.';
    else if (firstFail === 'US Presence') rejectionReason = usResult.reason || 'US presence detected while excluded.';
    else if (firstFail === 'CEO/Founder') rejectionReason = founderResult.reason || 'CEO or Co-founder identity not verified.';
    else if (firstFail === 'Professional Email') rejectionReason = emailResult.reason || 'Executive email deliverability unverified on live MX.';
    else rejectionReason = `${firstFail} failed requirement.`;
  } else if (
    fundingStatus === 'PASS' &&
    industryStatus === 'PASS' &&
    geoStatus === 'PASS' &&
    usStatus === 'PASS' &&
    founderStatus === 'PASS' &&
    (emailStatus === 'PASS' || !isEmailRequired)
  ) {
    overallStatus = 'QUALIFIED';
  } else if (passedCriteria.length >= 2) {
    overallStatus = 'PARTIALLY_VERIFIED';
  } else {
    overallStatus = 'UNVERIFIED';
  }

  return {
    criteria: {
      funding: fundingResult,
      industry: industryResult,
      companyAge: ageResult,
      geography: geoResult,
      usPresence: usResult,
      companyStage: stageResult,
      founderOrCeo: founderResult,
      professionalEmail: emailResult,
      linkedinProfile: linkedinResult,
    },
    status: overallStatus,
    failedCriteria,
    passedCriteria,
    unknownCriteria,
    rejectionReason,
  };
}

export function buildCompanyRecordFromProfile(
  profile: RawExtractedProfile,
  evaluation: ReturnType<typeof evaluateCriteria>,
  candidateUrl: string,
  sourceType: string
): CompanyRecord {
  const comp: CompanyRecord = {
    name: profile.name || 'Unknown Company',
    website: profile.website || candidateUrl,
    description: profile.description || null,
    industry: profile.industry || profile.sector || 'Technology Platform',
    fundingOrRevenue: profile.fundingText || profile.revenueText || null,
    usPresence: evaluation.criteria.usPresence.status === 'PASS',
    founderOrCeoName: profile.founderOrCeoName || null,
    founderOrCeoEmail: evaluation.criteria.professionalEmail.value?.includes('@')
      ? evaluation.criteria.professionalEmail.value
      : null,
    emailVerified: evaluation.criteria.professionalEmail.status === 'PASS',
    confidenceScore: evaluation.status === 'QUALIFIED' ? 95 : (evaluation.status === 'PARTIALLY_VERIFIED' ? 65 : 40),
    sourceType,
    country: evaluation.criteria.geography.value || profile.country || null,
    headquarters: profile.headquarters || profile.city || profile.country || null,
    sector: profile.sector || profile.industry || 'Technology',
    location: evaluation.criteria.geography.value || profile.country || 'Global',
    founder: {
      name: profile.founderOrCeoName || undefined,
      title: profile.founderTitle || 'Executive',
      linkedinUrl: profile.founderLinkedin || undefined,
      confidence: profile.founderOrCeoName ? 90 : 0,
    },
    email: {
      address: evaluation.criteria.professionalEmail.value?.includes('@')
        ? evaluation.criteria.professionalEmail.value
        : undefined,
      status: evaluation.criteria.professionalEmail.status === 'PASS' ? 'verified' : 'unverified',
      confidence: evaluation.criteria.professionalEmail.status === 'PASS' ? 95 : 0,
    },
    evidence: {
      fundingSource: evaluation.criteria.funding.evidence || undefined,
      techEvidence: evaluation.criteria.industry.evidence || undefined,
      geoEvidence: evaluation.criteria.geography.evidence || undefined,
      founderSource: evaluation.criteria.founderOrCeo.evidence || undefined,
      emailVerificationDetail: evaluation.criteria.professionalEmail.evidence || undefined,
      sources: profile.sources || [candidateUrl],
    },
    auditDetails: {
      fundingStatus: evaluation.criteria.funding.status,
      locationStatus: evaluation.criteria.geography.status,
      techStatus: evaluation.criteria.industry.status,
      emailStatus: evaluation.criteria.professionalEmail.status,
      rawEvidence: profile.evidenceText || undefined,
    },
    validation: {
      isTechPlatform: evaluation.criteria.industry.status === 'PASS',
      hasMinFunding: evaluation.criteria.funding.status === 'PASS',
      isNonUS: evaluation.criteria.usPresence.status === 'PASS',
      hasFounder: evaluation.criteria.founderOrCeo.status === 'PASS',
      hasVerifiedEmail: evaluation.criteria.professionalEmail.status === 'PASS',
      overallQualified: evaluation.status === 'QUALIFIED',
      checks: {
        funding: { passed: evaluation.criteria.funding.status === 'PASS', evidence: evaluation.criteria.funding.evidence || undefined },
        technology: { passed: evaluation.criteria.industry.status === 'PASS', evidence: evaluation.criteria.industry.evidence || undefined },
        geography: { passed: evaluation.criteria.geography.status === 'PASS', evidence: evaluation.criteria.geography.evidence || undefined },
        founder: { passed: evaluation.criteria.founderOrCeo.status === 'PASS', evidence: evaluation.criteria.founderOrCeo.evidence || undefined },
        email: { passed: evaluation.criteria.professionalEmail.status === 'PASS', evidence: evaluation.criteria.professionalEmail.evidence || undefined },
      },
    },
    firstDiscoveredAt: new Date().toISOString(),
    lastVerifiedAt: new Date().toISOString(),
    statusTag: 'NEW',
  };

  // Calculate 5-Pillar Hunt Score (0-100)
  const { score, breakdown } = calculateHuntScore(comp);
  comp.huntScore = score;
  comp.scoreBreakdown = breakdown;

  return comp;
}
