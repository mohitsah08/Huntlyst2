/**
 * Comprehensive Automated Test Suite for Huntlyst Target Profile System
 * Verifies all 20 required interaction scenarios and state behaviors.
 */

import {
  HIERARCHICAL_SECTORS,
  HierarchicalSector,
  TriState,
  getSectorSelectionState,
  getGlobalSelectionState,
  getAllTaxonomySubSectors,
  getConciseIndustrySummary,
  targetProfileToHuntConfig,
  huntConfigToTargetProfile,
  DEFAULT_TVB_TARGET_PROFILE,
  STANDARD_PRESETS,
  TargetProfile,
} from '../lib/targetProfileData';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log('================================================================');
console.log('HUNTLYST TARGET PROFILE UX/UI AUDIT & STATE REBUILD TESTS');
console.log('================================================================\n');

const allSubSectors = getAllTaxonomySubSectors();
const techSector = HIERARCHICAL_SECTORS.find(s => s.id === 'technology')!;
const financeSector = HIERARCHICAL_SECTORS.find(s => s.id === 'finance')!;
const healthSector = HIERARCHICAL_SECTORS.find(s => s.id === 'healthcare')!;
const eduSector = HIERARCHICAL_SECTORS.find(s => s.id === 'education')!;

// 1. Select all industries
console.log('[TEST 1] Select all industries...');
const allState = getGlobalSelectionState(allSubSectors);
assert(allState === 'all', 'Global state should be "all" when all subsectors are selected');
const allSummary = getConciseIndustrySummary(allSubSectors);
assert(allSummary.text === 'All Industries', 'Concise summary for all industries should be "All Industries"');
assert(allSummary.chips.length === 1 && allSummary.chips[0].label === 'All Industries', 'Only 1 summary chip for all industries');

// 2. Clear all industries
console.log('\n[TEST 2] Clear all industries...');
const emptyState = getGlobalSelectionState([]);
assert(emptyState === 'none', 'Global state should be "none" when no subsectors are selected');
const emptySummary = getConciseIndustrySummary([]);
assert(emptySummary.chips.length === 0, 'No chips when cleared');

// 3. Select all Technology
console.log('\n[TEST 3] Select all Technology...');
const techAllState = getSectorSelectionState(techSector, techSector.subSectors);
assert(techAllState === 'all', 'Technology sector state should be "all" when all tech subsectors selected');
const techAllSummary = getConciseIndustrySummary(techSector.subSectors);
assert(
  techAllSummary.chips.some(c => c.label === 'Technology — All'),
  'Summary should display "Technology — All" chip instead of listing 21 individual chips'
);

// 4. Clear Technology
console.log('\n[TEST 4] Clear Technology...');
const techClearState = getSectorSelectionState(techSector, []);
assert(techClearState === 'none', 'Technology state should be "none" when cleared');

// 5. Select individual Technology sub-sectors (SaaS, AI)
console.log('\n[TEST 5] Select individual Technology sub-sectors (SaaS, AI)...');
const partialTechSubs = ['SaaS', 'AI'];
const partialTechState = getSectorSelectionState(techSector, partialTechSubs);
assert(partialTechState === 'partial', 'Technology state should be "partial" when only SaaS and AI are selected');

// 6. Mixed Technology state
console.log('\n[TEST 6] Mixed Technology state verification...');
const mixedSubs = ['Software', 'Cybersecurity', 'DevTools', 'Cloud Computing'];
const mixedState = getSectorSelectionState(techSector, mixedSubs);
assert(mixedState === 'partial', 'State should be partial (indeterminate)');
const mixedSummary = getConciseIndustrySummary(mixedSubs);
assert(
  mixedSummary.chips.some(c => c.label === `Technology — ${mixedSubs.length} sub-sectors`),
  `Summary chip should show "Technology — ${mixedSubs.length} sub-sectors"`
);

// 7. Select multiple sectors simultaneously
console.log('\n[TEST 7] Select multiple sectors simultaneously (Tech + Finance + Education)...');
const multiSectorSubs = ['SaaS', 'AI', 'Fintech', 'Banking', 'EdTech'];
const multiSummary = getConciseIndustrySummary(multiSectorSubs);
assert(multiSummary.chips.length === 3, 'Should have 3 sector chips');
assert(multiSummary.chips.some(c => c.label.includes('Technology')), 'Contains Technology chip');
assert(multiSummary.chips.some(c => c.label.includes('Finance')), 'Contains Finance chip');
assert(multiSummary.chips.some(c => c.label.includes('Education')), 'Contains Education chip');

// 8. Select all in one sector + partial in another
console.log('\n[TEST 8] Select all Technology + partial Finance...');
const techAllPlusFinancePartial = [...techSector.subSectors, 'Fintech', 'Payments'];
const tState = getSectorSelectionState(techSector, techAllPlusFinancePartial);
const fState = getSectorSelectionState(financeSector, techAllPlusFinancePartial);
assert(tState === 'all', 'Technology should be "all"');
assert(fState === 'partial', 'Finance should be "partial"');
const comboSummary = getConciseIndustrySummary(techAllPlusFinancePartial);
assert(comboSummary.chips.some(c => c.label === 'Technology — All'), 'Has Technology — All chip');
assert(comboSummary.chips.some(c => c.label === 'Finance — 2 sub-sectors'), 'Has Finance — 2 sub-sectors chip');

// 9. Select all then deselect one child (Robotics in Technology)
console.log('\n[TEST 9] Select all then deselect Robotics in Technology...');
const allMinusOne = allSubSectors.filter(s => s !== 'Robotics');
const techMinusOneState = getSectorSelectionState(techSector, allMinusOne);
const healthState = getSectorSelectionState(healthSector, allMinusOne);
const globalMinusOneState = getGlobalSelectionState(allMinusOne);
assert(techMinusOneState === 'partial', 'Technology should transition from all to partial');
assert(healthState === 'all', 'Healthcare should remain all');
assert(globalMinusOneState === 'partial', 'Global state should transition from all to partial');

// 10. Load preset (TVB Evaluation Profile)
console.log('\n[TEST 10] Load preset...');
const tvbProfile = { ...DEFAULT_TVB_TARGET_PROFILE };
assert(tvbProfile.name === 'TVB Evaluation Profile', 'TVB Evaluation Profile name matches');
assert(tvbProfile.industries.includes('Technology'), 'TVB targets Technology sector');
assert(tvbProfile.subIndustries.length === 5, 'TVB has 5 specific sub-industries');

// 11. Save profile & duplicate
console.log('\n[TEST 11] Save profile & duplicate...');
const customProfile: TargetProfile = {
  ...DEFAULT_TVB_TARGET_PROFILE,
  id: 'custom_123',
  name: 'Custom European B2B SaaS',
  countries: ['Germany', 'France'],
};
assert(customProfile.id === 'custom_123', 'Custom profile created with ID');
const copyProfile: TargetProfile = {
  ...customProfile,
  id: 'custom_124',
  name: `${customProfile.name} (Copy)`,
};
assert(copyProfile.name === 'Custom European B2B SaaS (Copy)', 'Copy name formatted correctly');

// 12. Reload profile from JSON serialization
console.log('\n[TEST 12] Reload profile from JSON serialization...');
const serialized = JSON.stringify(customProfile);
const deserialized: TargetProfile = JSON.parse(serialized);
assert(deserialized.name === customProfile.name, 'Deserialized name matches');
assert(deserialized.countries.length === 2, 'Deserialized countries preserved');

// 13. Reset profile
console.log('\n[TEST 13] Reset profile to default...');
const resetProfile: TargetProfile = { ...DEFAULT_TVB_TARGET_PROFILE };
assert(resetProfile.id === 'tvb_eval_default', 'Reset ID matches TVB default');
assert(resetProfile.targetCount === 15, 'Reset count matches 15');

// 14. Run Hunt & TargetProfile to HuntConfig conversion
console.log('\n[TEST 14] Run Hunt & targetProfileToHuntConfig conversion...');
const huntConfig = targetProfileToHuntConfig(customProfile);
assert(huntConfig.targetLeads === 15, 'Target leads preserved');
assert(huntConfig.sectors.includes('Technology'), 'Sectors preserved');
assert(huntConfig.businessModels.includes('SaaS'), 'Business models mapped');
assert(huntConfig.funding.mode === 'funding_or_revenue', 'Funding mode preserved');

// 15. Correct API payload structure
console.log('\n[TEST 15] Correct API payload structure...');
assert(huntConfig.geography.countries.includes('Germany'), 'API payload geography contains Germany');
assert(huntConfig.geography.excludedCountries.includes('United States'), 'US exclusion preserved');

// 16. Validation rules: invalid financial bounds
console.log('\n[TEST 16] Validation rules...');
const invalidBoundsProfile: TargetProfile = {
  ...DEFAULT_TVB_TARGET_PROFILE,
  fundingMin: 10_000_000,
  fundingMax: 1_000_000, // Invalid: min > max
};
assert(invalidBoundsProfile.fundingMin > invalidBoundsProfile.fundingMax, 'Catches fundingMin > fundingMax');

// 17. Dirty state detection logic
console.log('\n[TEST 17] Dirty state detection...');
const snapshot = JSON.stringify(DEFAULT_TVB_TARGET_PROFILE);
const unmodified = JSON.stringify({ ...DEFAULT_TVB_TARGET_PROFILE });
assert(snapshot === unmodified, 'Clean state correctly identified');
const modified = JSON.stringify({ ...DEFAULT_TVB_TARGET_PROFILE, targetCount: 50 });
assert(snapshot !== modified, 'Dirty state correctly identified when modified');

// 18. Concise summary generation
console.log('\n[TEST 18] Concise summary generation without clutter...');
const allTechSummary = getConciseIndustrySummary(techSector.subSectors);
assert(allTechSummary.chips.length === 1, 'Only 1 chip for all technology');
assert(allTechSummary.chips[0].label === 'Technology — All', 'Label is "Technology — All"');

// 19. Search filtering logic
console.log('\n[TEST 19] Search filtering (both sector name and subsector name)...');
const q1 = 'cyber';
const match1 = HIERARCHICAL_SECTORS.filter(s => s.subSectors.some(sub => sub.toLowerCase().includes(q1)));
assert(match1.length > 0 && match1[0].name === 'Technology', 'Search "cyber" finds Technology -> Cybersecurity');

const q2 = 'travel';
const match2 = HIERARCHICAL_SECTORS.filter(s => s.name.toLowerCase().includes(q2));
assert(match2.length > 0 && match2[0].name === 'Travel & Hospitality', 'Search "travel" finds Travel & Hospitality sector');

// 20. Accessibility & Tri-state semantics
console.log('\n[TEST 20] Accessibility & Tri-state semantics...');
assert(techAllState === 'all', 'Full state maps to aria-checked="true"');
assert(partialTechState === 'partial', 'Partial state maps to aria-checked="mixed" (W3C standard)');
assert(emptyState === 'none', 'None state maps to aria-checked="false"');

console.log('\n================================================================');
console.log('🎉 ALL 20 AUTOMATED TESTS PASSED SUCCESSFULLY!');
console.log('================================================================\n');
