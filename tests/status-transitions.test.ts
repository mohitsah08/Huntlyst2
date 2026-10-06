/**
 * Test Suite: Status Transitions, Manual Overrides & Audit Trail
 * Verifies Requirements 5, 7, 8, 25:
 * - Tests all allowed manual status transitions:
 *   REVIEW -> VERIFIED
 *   UNVERIFIED -> REVIEW
 *   UNVERIFIED -> VERIFIED
 *   REJECTED -> UNVERIFIED
 *   REJECTED -> REVIEW
 *   REJECTED -> VERIFIED
 * - Individual promotion & bulk PASS ALL
 * - Partial selection (e.g. 10 REVIEW leads -> select 5 -> Pass selected -> VERIFIED; 5 remain REVIEW)
 * - Complete audit history records created with override_reason, override_by, override_at
 * - Never destroys original machine status or prior history
 */

import { unifiedLeadStore } from '../lib/unifiedLeadStore';
import { LeadPackage, FinalLeadStatus } from '../lib/leadPackage';
import { DEFAULT_TVB_TARGET_PROFILE } from '../lib/targetProfileData';

function buildMockPackage(companyName: string, domain: string): LeadPackage {
  return {
    candidate_id: `pkg-${domain}`,
    source: {
      file_name: 'test_intake.csv',
      file_type: 'text/csv',
      row_number: 1,
    },
    seed_data: {
      raw_fields: { 'Company Name': companyName, Website: `https://${domain}` },
      normalized: {
        company_name: companyName,
        website: `https://${domain}`,
        canonical_domain: domain,
        country: 'Germany',
        industry: 'Software',
        funding: '$2,000,000',
        founder_or_ceo: 'Max Mustermann',
        company_email: `contact@${domain}`,
        company_linkedin: null,
        ceo_linkedin: null,
      },
    },
    audit: {
      fields_present: ['Company Name', 'Website'],
      fields_missing: [],
      placeholders: [],
      malformed_fields: [],
      duplicate_signals: [],
    },
  };
}

async function runStatusTransitionTests() {
  console.log('================================================================');
  console.log('STATUS TRANSITIONS, MANUAL OVERRIDES & AUDIT TRAIL TESTS');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ PASSED: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAILED: ${message}`);
      failed++;
    }
  }

  // Clear store before tests
  unifiedLeadStore.clear();

  // --- TEST 1: ALL SIX INDIVIDUAL TRANSITIONS & AUDIT HISTORY ---
  const transitions: Array<{ from: FinalLeadStatus; to: FinalLeadStatus; name: string; domain: string }> = [
    { from: 'REVIEW', to: 'VERIFIED', name: 'Alpha Tech', domain: 'alphatech.de' },
    { from: 'UNVERIFIED', to: 'REVIEW', name: 'Beta Systems', domain: 'betasystems.com' },
    { from: 'UNVERIFIED', to: 'VERIFIED', name: 'Gamma Labs', domain: 'gammalabs.io' },
    { from: 'REJECTED', to: 'UNVERIFIED', name: 'Delta Security', domain: 'deltasec.org' },
    { from: 'REJECTED', to: 'REVIEW', name: 'Epsilon AI', domain: 'epsilon.ai' },
    { from: 'REJECTED', to: 'VERIFIED', name: 'Zeta Cloud', domain: 'zetac物を.cloud' },
  ];

  for (const t of transitions) {
    const pkg = buildMockPackage(t.name, t.domain);
    // Insert with simulated machine status
    const lead = unifiedLeadStore.upsertLeadFromInternal(pkg, DEFAULT_TVB_TARGET_PROFILE);
    lead.currentStatus = t.from;
    if (lead.internal) {
      lead.internal.status = t.from;
    }

    const overrideReason = `Manually promoted from ${t.from} to ${t.to} by QA Lead`;
    const overrideBy = 'QA Lead';

    const updated = unifiedLeadStore.manualStatusOverride(
      lead.id,
      t.to,
      overrideReason,
      overrideBy
    );

    assert(updated !== null, `Transition ${t.from} -> ${t.to} executed successfully for ${t.name}`);
    assert(updated?.currentStatus === t.to, `Current status updated to ${t.to}`);

    // Verify audit record exists
    const lastAudit = updated?.auditTrail[updated.auditTrail.length - 1];
    assert(lastAudit !== undefined, `Audit record created for transition ${t.from} -> ${t.to}`);
    assert(lastAudit?.original_status === t.from, `Audit record captures original status: ${t.from}`);
    assert(lastAudit?.new_status === t.to, `Audit record captures new status: ${t.to}`);
    assert(lastAudit?.manual_override === true, 'Audit record flagged as manual_override');
    assert(lastAudit?.override_by === overrideBy, `Audit record captures override_by: ${overrideBy}`);
    assert(lastAudit?.override_reason === overrideReason, 'Audit record captures override_reason');
    assert(typeof lastAudit?.override_at === 'string', 'Audit record captures override_at timestamp');

    // Verify status history
    assert(updated?.statusHistory.length! >= 2, `Status history preserved previous and current states (length ${updated?.statusHistory.length})`);
    const historyLast = updated?.statusHistory[updated.statusHistory.length - 1];
    assert(historyLast?.status === t.to, `Chronological history ends with new status ${t.to}`);
    assert(historyLast?.source === 'MANUAL_OVERRIDE', 'Chronological history identifies MANUAL_OVERRIDE source');
  }

  // --- TEST 2: PARTIAL SELECTION TRANSITION (REQUIREMENT 25 EXAMPLE) ---
  console.log('\n--- Running Requirement 25 Partial Selection Test (10 REVIEW leads, select 5) ---');
  unifiedLeadStore.clear();

  const reviewLeads: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const pkg = buildMockPackage(`Batch Corp ${i}`, `batchcorp${i}.com`);
    const lead = unifiedLeadStore.upsertLeadFromInternal(pkg, DEFAULT_TVB_TARGET_PROFILE);
    lead.currentStatus = 'REVIEW';
    if (lead.internal) lead.internal.status = 'REVIEW';
    reviewLeads.push(lead.id);
  }

  assert(unifiedLeadStore.getAllLeads().length === 10, 'Created 10 initial REVIEW leads');

  // Select 5 leads to promote to VERIFIED
  const selectedLeadIds = reviewLeads.slice(0, 5);
  const unselectedLeadIds = reviewLeads.slice(5, 10);

  const bulkResult = unifiedLeadStore.bulkManualStatusOverride(
    selectedLeadIds,
    'VERIFIED',
    'Approved batch of 5 after human diligence',
    'Investment Analyst'
  );

  assert(bulkResult.length === 5, 'bulkManualStatusOverride returned 5 updated leads');

  const allLeadsAfter = unifiedLeadStore.getAllLeads();
  const verifiedCount = allLeadsAfter.filter(l => l.currentStatus === 'VERIFIED').length;
  const reviewCount = allLeadsAfter.filter(l => l.currentStatus === 'REVIEW').length;

  assert(verifiedCount === 5, `Expected exactly 5 VERIFIED leads, found ${verifiedCount}`);
  assert(reviewCount === 5, `Expected exactly 5 remaining REVIEW leads, found ${reviewCount}`);

  // Check unselected leads were NOT altered
  for (const id of unselectedLeadIds) {
    const unselectedLead = unifiedLeadStore.getLeadById(id);
    assert(unselectedLead?.currentStatus === 'REVIEW', `Unselected lead ${unselectedLead?.identity.company_name} remained in REVIEW`);
    assert(unselectedLead?.auditTrail.length === 0, `Unselected lead ${unselectedLead?.identity.company_name} has no manual overrides`);
  }

  // Check selected leads HAVE audit records
  for (const id of selectedLeadIds) {
    const selectedLead = unifiedLeadStore.getLeadById(id);
    assert(selectedLead?.currentStatus === 'VERIFIED', `Selected lead ${selectedLead?.identity.company_name} is now VERIFIED`);
    assert(selectedLead?.auditTrail.length === 1, `Selected lead ${selectedLead?.identity.company_name} has audit entry`);
    assert(selectedLead?.auditTrail[0].override_reason === 'Approved batch of 5 after human diligence', 'Audit reason recorded');
  }

  // --- TEST 3: ATTEMPT INVALID TRANSITION FROM VERIFIED ---
  console.log('\n--- Testing Invalid Pass Behavior on Final VERIFIED ---');
  const verifiedLeadId = selectedLeadIds[0];
  const invalidTransition = unifiedLeadStore.manualStatusOverride(
    verifiedLeadId,
    'VERIFIED',
    'No-op transition',
    'User'
  );
  // VERIFIED to VERIFIED is a no-op / returns current
  assert(invalidTransition?.currentStatus === 'VERIFIED', 'VERIFIED leads require no pass action');

  console.log('\n================================================================');
  if (failed === 0) {
    console.log(`🎉 ALL ${passed} STATUS TRANSITION TESTS PASSED!`);
  } else {
    console.error(`💥 ${failed} TESTS FAILED out of ${passed + failed}`);
    process.exit(1);
  }
  console.log('================================================================');
}

runStatusTransitionTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
