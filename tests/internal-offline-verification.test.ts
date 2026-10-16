import { DEFAULT_INTERNAL_SETTINGS, InternalWorkflowSettings } from '../lib/internalSettings';
import { evaluateInternalRecord, parseOfflineAmount, OfflineVerificationInput } from '../lib/internal/offlineVerification';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error('FAILED: ' + message);
  console.log('PASSED: ' + message);
}

function settings(): InternalWorkflowSettings {
  const copy = JSON.parse(JSON.stringify(DEFAULT_INTERNAL_SETTINGS)) as InternalWorkflowSettings;
  copy.targetProfile.searchMode = 'offline';
  copy.targetProfile.industries = ['Technology'];
  copy.targetProfile.subIndustries = [];
  copy.targetProfile.geographies = [];
  copy.targetProfile.fundingMin = 2_000_000;
  copy.targetProfile.fundingMax = 10_000_000;
  copy.targetProfile.fundingBasis = 'total';
  copy.targetProfile.stages = ['Seed', 'Series A'];
  copy.targetProfile.mandatoryCriteria = ['industry', 'funding', 'stage'];
  copy.targetProfile.requiredFields = ['companyName', 'domain'];
  copy.targetProfile.websiteRequirement = 'Optional';
  copy.targetProfile.minCompanyAge = null;
  copy.targetProfile.maxCompanyAge = null;
  copy.verificationRules.requireActiveStatus = true;
  copy.targetProfile.executiveRequired.ceo = true;
  copy.targetProfile.emailRequirement = 'Required';
  return copy;
}

function validInput(overrides: Partial<OfflineVerificationInput> = {}): OfflineVerificationInput {
  return {
    id: 'acme-1',
    companyName: 'Acme AI',
    domain: 'acme.ai',
    website: 'https://acme.ai',
    industry: 'Technology',
    geography: 'India',
    revenue: '$4M',
    totalFunding: '$4.2M',
    latestRoundFunding: '$2M',
    companyStage: 'Seed',
    foundingYear: 2020,
    companyAge: 6,
    companyStatus: 'Active',
    executiveNames: ['A Founder'],
    emails: ['founder@acme.ai'],
    ambiguousFields: [],
    ...overrides,
  };
}

const cfg = settings();
assert(parseOfflineAmount('$4.2M') === 4_200_000, 'parses compact funding values such as $4.2M');
assert(parseOfflineAmount('25 lakh') === 2_500_000, 'parses lakh values');
assert(evaluateInternalRecord(validInput(), cfg, 2026).status === 'VERIFIED', 'returns VERIFIED when every required configured check passes');
assert(evaluateInternalRecord(validInput({ companyName: '' }), cfg, 2026).status === 'UNVERIFIED', 'missing company name is UNVERIFIED');
assert(evaluateInternalRecord(validInput({ domain: '', website: '' }), cfg, 2026).status === 'UNVERIFIED', 'missing domain and website is UNVERIFIED');
assert(evaluateInternalRecord(validInput({ totalFunding: '' }), cfg, 2026).status === 'UNVERIFIED', 'missing required funding is UNVERIFIED');
assert(evaluateInternalRecord(validInput({ ambiguousFields: ['industry'] }), cfg, 2026).status === 'REVIEW', 'ambiguous imported fields are sent to REVIEW');
assert(evaluateInternalRecord(validInput({ industry: 'Agriculture' }), cfg, 2026).status === 'REJECTED', 'definite mandatory industry mismatch is REJECTED');
assert(evaluateInternalRecord(validInput({ totalFunding: '$20M' }), cfg, 2026).status === 'REJECTED', 'definite funding range failure is REJECTED');

const optionalCfg = settings();
optionalCfg.targetProfile.mandatoryCriteria = ['funding', 'stage'];
assert(evaluateInternalRecord(validInput({ industry: 'Agriculture' }), optionalCfg, 2026).status === 'VERIFIED', 'an optional industry preference does not reject an otherwise qualified company');

const offlineNoEvidence = settings();
offlineNoEvidence.verificationRules.requireActiveStatus = false;
offlineNoEvidence.targetProfile.emailRequirement = 'Not Required';
offlineNoEvidence.targetProfile.executiveRequired.ceo = false;
assert(evaluateInternalRecord(validInput({ companyStatus: '', executiveNames: [], emails: [] }), offlineNoEvidence, 2026).status === 'VERIFIED', 'optional company status, executive, and email fields do not block verification');

console.log('Internal offline verification tests completed.');
