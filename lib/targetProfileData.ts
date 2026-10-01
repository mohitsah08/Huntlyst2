/**
 * Target Profile Taxonomy & Predefined Options
 * 
 * Provides comprehensive, predefined selections for:
 * - Target company count
 * - Financial metric, currency, and calibrated minimum/maximum values (USD & INR & EUR/GBP)
 * - 16 Industry/Sector categories with all sub-industries
 * - Company Age & dynamic year range
 * - Freshness & activity types
 * - Company Stage & Company Type
 * - Geography & US presence modes
 * - Contact person roles & Email verification tiers
 * - Social platform requirements
 * - Employee count ranges
 * - Research sources
 * - Built-in preset profiles (TVB, Agriculture, Health, Automotive, etc.)
 */

export interface IndustryCategory {
  category: string;
  industries: string[];
}

export const INDUSTRY_TAXONOMY: IndustryCategory[] = [
  {
    category: 'TECHNOLOGY & SOFTWARE',
    industries: [
      'Technology',
      'Software',
      'SaaS',
      'AI',
      'Artificial Intelligence',
      'Machine Learning',
      'DeepTech',
      'Cloud Computing',
      'Cybersecurity',
      'DevTools',
      'IT Services',
      'Enterprise Software',
      'Web Technology',
      'Mobile Technology',
      'Data & Analytics',
      'IoT',
      'Blockchain',
      'Web3',
      'AR/VR',
      'Robotics',
      'Semiconductors',
      'Electronics',
    ],
  },
  {
    category: 'FINANCE',
    industries: [
      'Fintech',
      'Banking',
      'Payments',
      'Lending',
      'Insurance',
      'InsurTech',
      'WealthTech',
      'Investment',
      'Accounting',
      'Financial Services',
      'Crypto / Digital Assets',
    ],
  },
  {
    category: 'HEALTHCARE',
    industries: [
      'Healthcare',
      'HealthTech',
      'Pharmaceuticals',
      'Medicine',
      'Medical Devices',
      'Biotechnology',
      'Life Sciences',
      'Mental Wellness',
      'Digital Health',
      'Diagnostics',
      'Hospital / Care Services',
    ],
  },
  {
    category: 'AGRICULTURE & FOOD',
    industries: [
      'Agriculture',
      'AgriTech',
      'Agro',
      'Agro Processing',
      'Dairy',
      'Milk / Dairy Technology',
      'Farming',
      'Animal Husbandry',
      'Fisheries',
      'Food',
      'FoodTech',
      'Beverages',
      'Food Processing',
      'Agricultural Equipment',
      'Agricultural Supply Chain',
    ],
  },
  {
    category: 'AUTOMOTIVE & MOBILITY',
    industries: [
      'Automotive',
      'Motor',
      'Electric Vehicles',
      'EV',
      'EV Infrastructure',
      'Mobility',
      'Transportation',
      'Automotive Manufacturing',
      'Auto Components',
      'Vehicle Technology',
      'Logistics',
    ],
  },
  {
    category: 'MANUFACTURING & INDUSTRIAL',
    industries: [
      'Manufacturing',
      'Industrial',
      'Industrial Automation',
      'Machinery',
      'Engineering',
      'Chemical',
      'Chemicals',
      'Materials',
      'Mining',
      'Metals',
      'Steel',
      'Construction Materials',
      'Industrial Technology',
    ],
  },
  {
    category: 'ENERGY & ENVIRONMENT',
    industries: [
      'Energy',
      'Renewable Energy',
      'Solar',
      'Wind Energy',
      'CleanTech',
      'ClimateTech',
      'Environmental Services',
      'Waste Management',
      'Recycling',
      'Water Technology',
      'Sustainability',
    ],
  },
  {
    category: 'REAL ESTATE & CONSTRUCTION',
    industries: [
      'Real Estate',
      'PropTech',
      'Construction',
      'Architecture',
      'Infrastructure',
      'Smart Buildings',
      'Property Management',
    ],
  },
  {
    category: 'EDUCATION',
    industries: [
      'Education',
      'EdTech',
      'Online Learning',
      'Training',
      'Professional Education',
      'Higher Education',
    ],
  },
  {
    category: 'RETAIL & COMMERCE',
    industries: [
      'Retail',
      'E-commerce',
      'Marketplace',
      'Consumer Goods',
      'Consumer Services',
      'Fashion',
      'Beauty',
      'Luxury',
      'Home & Lifestyle',
    ],
  },
  {
    category: 'TRAVEL & HOSPITALITY',
    industries: [
      'Travel',
      'TravelTech',
      'Tourism',
      'Hospitality',
      'Hotels',
      'Restaurants',
      'Food Services',
    ],
  },
  {
    category: 'MEDIA & ENTERTAINMENT',
    industries: [
      'Media',
      'Entertainment',
      'Gaming',
      'GameTech',
      'SportsTech',
      'Music',
      'Video',
      'Content',
      'Creator Economy',
    ],
  },
  {
    category: 'LOGISTICS & SUPPLY CHAIN',
    industries: [
      'Logistics',
      'Supply Chain',
      'Warehousing',
      'Delivery',
      'Shipping',
      'Freight',
      'Transportation Technology',
    ],
  },
  {
    category: 'TELECOMMUNICATIONS',
    industries: [
      'Telecommunications',
      'Networking',
      '5G',
      'Internet Services',
      'Communication Technology',
    ],
  },
  {
    category: 'BUSINESS & PROFESSIONAL SERVICES',
    industries: [
      'Legal',
      'LegalTech',
      'HR',
      'HRTech',
      'Recruitment',
      'Marketing',
      'MarTech',
      'Advertising',
      'Consulting',
      'Business Services',
    ],
  },
  {
    category: 'OTHER INDUSTRIES',
    industries: [
      'Aerospace',
      'Defence',
      'Government Technology',
      'GovTech',
      'SpaceTech',
      'Marine',
      'FashionTech',
      'BeautyTech',
      'PetTech',
      'Other',
    ],
  },
];

export interface HierarchicalSector {
  id: string;
  name: string;
  categoryKey: string;
  subSectors: string[];
}

export const HIERARCHICAL_SECTORS: HierarchicalSector[] = [
  {
    id: 'technology',
    name: 'Technology',
    categoryKey: 'TECHNOLOGY & SOFTWARE',
    subSectors: [
      'Software',
      'SaaS',
      'AI',
      'Artificial Intelligence',
      'Machine Learning',
      'DeepTech',
      'Cloud Computing',
      'Cybersecurity',
      'DevTools',
      'IT Services',
      'Enterprise Software',
      'Web Technology',
      'Mobile Technology',
      'Data & Analytics',
      'IoT',
      'Blockchain',
      'Web3',
      'AR/VR',
      'Robotics',
      'Semiconductors',
      'Electronics',
    ],
  },
  {
    id: 'finance',
    name: 'Finance',
    categoryKey: 'FINANCE',
    subSectors: [
      'Fintech',
      'Banking',
      'Payments',
      'Lending',
      'Insurance',
      'InsurTech',
      'WealthTech',
      'Investment',
      'Accounting',
      'Financial Services',
      'Crypto / Digital Assets',
    ],
  },
  {
    id: 'healthcare',
    name: 'Healthcare',
    categoryKey: 'HEALTHCARE',
    subSectors: [
      'Healthcare',
      'HealthTech',
      'Pharmaceuticals',
      'Medicine',
      'Medical Devices',
      'Biotechnology',
      'Life Sciences',
      'Mental Wellness',
      'Digital Health',
      'Diagnostics',
      'Hospital / Care Services',
    ],
  },
  {
    id: 'agriculture',
    name: 'Agriculture & Food',
    categoryKey: 'AGRICULTURE & FOOD',
    subSectors: [
      'Agriculture',
      'AgriTech',
      'Agro',
      'Agro Processing',
      'Dairy',
      'Milk / Dairy Technology',
      'Farming',
      'Animal Husbandry',
      'Fisheries',
      'Food',
      'FoodTech',
      'Beverages',
      'Food Processing',
      'Agricultural Equipment',
      'Agricultural Supply Chain',
    ],
  },
  {
    id: 'automotive',
    name: 'Automotive & Mobility',
    categoryKey: 'AUTOMOTIVE & MOBILITY',
    subSectors: [
      'Automotive',
      'Motor',
      'Electric Vehicles',
      'EV',
      'EV Infrastructure',
      'Mobility',
      'Transportation',
      'Automotive Manufacturing',
      'Auto Components',
      'Vehicle Technology',
      'Logistics',
    ],
  },
  {
    id: 'manufacturing',
    name: 'Manufacturing & Industrial',
    categoryKey: 'MANUFACTURING & INDUSTRIAL',
    subSectors: [
      'Manufacturing',
      'Industrial',
      'Industrial Automation',
      'Machinery',
      'Engineering',
      'Chemical',
      'Chemicals',
      'Materials',
      'Mining',
      'Metals',
      'Steel',
      'Construction Materials',
      'Industrial Technology',
    ],
  },
  {
    id: 'energy',
    name: 'Energy & Environment',
    categoryKey: 'ENERGY & ENVIRONMENT',
    subSectors: [
      'Energy',
      'Renewable Energy',
      'Solar',
      'Wind Energy',
      'CleanTech',
      'ClimateTech',
      'Environmental Services',
      'Waste Management',
      'Recycling',
      'Water Technology',
      'Sustainability',
    ],
  },
  {
    id: 'real_estate',
    name: 'Real Estate & Construction',
    categoryKey: 'REAL ESTATE & CONSTRUCTION',
    subSectors: [
      'Real Estate',
      'PropTech',
      'Construction',
      'Architecture',
      'Infrastructure',
      'Smart Buildings',
      'Property Management',
    ],
  },
  {
    id: 'education',
    name: 'Education',
    categoryKey: 'EDUCATION',
    subSectors: [
      'Education',
      'EdTech',
      'Online Learning',
      'Training',
      'Professional Education',
      'Higher Education',
    ],
  },
  {
    id: 'retail',
    name: 'Retail & Commerce',
    categoryKey: 'RETAIL & COMMERCE',
    subSectors: [
      'Retail',
      'E-commerce',
      'Marketplace',
      'Consumer Goods',
      'Consumer Services',
      'Fashion',
      'Beauty',
      'Luxury',
      'Home & Lifestyle',
    ],
  },
  {
    id: 'travel',
    name: 'Travel & Hospitality',
    categoryKey: 'TRAVEL & HOSPITALITY',
    subSectors: [
      'Travel',
      'TravelTech',
      'Tourism',
      'Hospitality',
      'Hotels',
      'Restaurants',
      'Food Services',
    ],
  },
  {
    id: 'media',
    name: 'Media & Entertainment',
    categoryKey: 'MEDIA & ENTERTAINMENT',
    subSectors: [
      'Media',
      'Entertainment',
      'Gaming',
      'GameTech',
      'SportsTech',
      'Music',
      'Video',
      'Content',
      'Creator Economy',
    ],
  },
  {
    id: 'logistics',
    name: 'Logistics & Supply Chain',
    categoryKey: 'LOGISTICS & SUPPLY CHAIN',
    subSectors: [
      'Logistics',
      'Supply Chain',
      'Warehousing',
      'Delivery',
      'Shipping',
      'Freight',
      'Transportation Technology',
    ],
  },
  {
    id: 'telecommunications',
    name: 'Telecommunications',
    categoryKey: 'TELECOMMUNICATIONS',
    subSectors: [
      'Telecommunications',
      'Networking',
      '5G',
      'Internet Services',
      'Communication Technology',
    ],
  },
  {
    id: 'services',
    name: 'Business & Professional Services',
    categoryKey: 'BUSINESS & PROFESSIONAL SERVICES',
    subSectors: [
      'Legal',
      'LegalTech',
      'HR',
      'HRTech',
      'Recruitment',
      'Marketing',
      'MarTech',
      'Advertising',
      'Consulting',
      'Business Services',
    ],
  },
  {
    id: 'other',
    name: 'Other Industries',
    categoryKey: 'OTHER INDUSTRIES',
    subSectors: [
      'Aerospace',
      'Defence',
      'Government Technology',
      'GovTech',
      'SpaceTech',
      'Marine',
      'FashionTech',
      'BeautyTech',
      'PetTech',
      'Other',
    ],
  },
];

export type TriState = 'none' | 'partial' | 'all';

export function getSectorSelectionState(sector: HierarchicalSector, selectedSubSectors: string[]): TriState {
  if (!selectedSubSectors || selectedSubSectors.length === 0) return 'none';
  const selectedCount = sector.subSectors.filter(s => selectedSubSectors.includes(s)).length;
  if (selectedCount === 0) return 'none';
  if (selectedCount >= sector.subSectors.length) return 'all';
  return 'partial';
}

export function getGlobalSelectionState(selectedSubSectors: string[]): TriState {
  if (!selectedSubSectors || selectedSubSectors.length === 0) return 'none';
  const allSubSectors = HIERARCHICAL_SECTORS.flatMap(s => s.subSectors);
  const selectedCount = allSubSectors.filter(s => selectedSubSectors.includes(s)).length;
  if (selectedCount === 0) return 'none';
  if (selectedCount >= allSubSectors.length) return 'all';
  return 'partial';
}

export function getAllTaxonomySubSectors(): string[] {
  const set = new Set<string>();
  for (const s of HIERARCHICAL_SECTORS) {
    for (const sub of s.subSectors) set.add(sub);
  }
  return Array.from(set);
}

export interface IndustrySummaryDetail {
  globalState: TriState;
  text: string;
  chips: Array<{
    id: string;
    label: string;
    type: 'all_industries' | 'sector_all' | 'sector_partial' | 'custom';
    sectorId?: string;
  }>;
}

export function getConciseIndustrySummary(
  selectedSubSectors: string[],
  customIndustries: string[] = []
): IndustrySummaryDetail {
  const globalState = getGlobalSelectionState(selectedSubSectors);
  if (globalState === 'all' && customIndustries.length === 0) {
    return {
      globalState: 'all',
      text: 'All Industries',
      chips: [
        {
          id: 'all_industries',
          label: 'All Industries',
          type: 'all_industries',
        },
      ],
    };
  }

  if (selectedSubSectors.length === 0 && customIndustries.length === 0) {
    return {
      globalState: 'none',
      text: 'No industries selected (Hunting all sectors)',
      chips: [],
    };
  }

  const chips: IndustrySummaryDetail['chips'] = [];
  const sectorSummaries: string[] = [];

  for (const sector of HIERARCHICAL_SECTORS) {
    const state = getSectorSelectionState(sector, selectedSubSectors);
    if (state === 'all') {
      chips.push({
        id: `sector_${sector.id}`,
        label: `${sector.name} — All`,
        type: 'sector_all',
        sectorId: sector.id,
      });
      sectorSummaries.push(`${sector.name} (All)`);
    } else if (state === 'partial') {
      const count = sector.subSectors.filter(s => selectedSubSectors.includes(s)).length;
      chips.push({
        id: `sector_${sector.id}`,
        label: `${sector.name} — ${count} sub-sectors`,
        type: 'sector_partial',
        sectorId: sector.id,
      });
      sectorSummaries.push(`${sector.name} (${count})`);
    }
  }

  for (const custom of customIndustries) {
    chips.push({
      id: `custom_${custom}`,
      label: custom,
      type: 'custom',
    });
    sectorSummaries.push(custom);
  }

  const text = sectorSummaries.join(', ');
  return {
    globalState,
    text,
    chips,
  };
}

export const ALL_PREDEFINED_INDUSTRIES: string[] = INDUSTRY_TAXONOMY.flatMap(c => c.industries);

// Dynamic Sub-Industries Mapping based on parent industry or category
export const SUB_INDUSTRY_MAP: Record<string, string[]> = {
  'Agriculture': ['AgriTech', 'Farming', 'Dairy', 'Agricultural Equipment', 'Food Processing', 'Agricultural Supply Chain', 'Animal Husbandry', 'Precision Agriculture', 'Hydroponics', 'Soil Intelligence'],
  'AgriTech': ['Precision Farming', 'Farm Automation', 'Drone AgriTech', 'Post-Harvest Supply Chain', 'Smart Irrigation', 'Seed Technology'],
  'Dairy': ['Milk Processing', 'Dairy Cold Chain', 'Dairy IoT', 'Cattle Health Monitoring', 'Automated Milking Systems', 'Artisanal Dairy'],
  'Technology': ['SaaS', 'AI', 'Cybersecurity', 'Cloud Infrastructure', 'DevTools', 'Data & Analytics', 'IoT', 'Robotics', 'DeepTech', 'Web3'],
  'Software': ['B2B SaaS', 'Enterprise Software', 'Developer Tools', 'Open Source', 'Workflow Automation', 'Microservices'],
  'AI': ['Generative AI', 'LLM Infrastructure', 'Computer Vision', 'NLP', 'Agentic AI', 'Predictive Modeling', 'Synthetic Data', 'MLOps'],
  'Artificial Intelligence': ['Generative AI', 'Agentic AI', 'Computer Vision', 'Deep Learning', 'Autonomous Systems'],
  'Cybersecurity': ['Cloud Security', 'Zero Trust', 'Identity & Access Management (IAM)', 'Threat Detection', 'Application Security', 'Endpoint Protection'],
  'Fintech': ['Payments & Gateway', 'Lending & Credit', 'Banking as a Service (BaaS)', 'InsurTech', 'WealthTech', 'Cross-Border Remittance', 'RegTech'],
  'Healthcare': ['HealthTech', 'Telemedicine', 'Clinical Diagnostics', 'Electronic Health Records (EHR)', 'Hospital SaaS', 'Remote Patient Monitoring'],
  'Pharmaceuticals': ['Drug Discovery AI', 'Clinical Trials Tech', 'Formulation Tech', 'Pharma Supply Chain', 'Generics Manufacturing'],
  'Automotive': ['Electric Vehicles (EV)', 'EV Charging Infrastructure', 'Battery Management Systems (BMS)', 'Auto Components', 'Fleet Telematics', 'Connected Vehicles'],
  'Electric Vehicles': ['Two-Wheeler EV', 'Commercial EV', 'EV Battery Tech', 'Swappable Battery Networks', 'EV Powertrain'],
  'Manufacturing': ['Industrial Automation', 'Industry 4.0', 'Smart Factory', 'Robotics', 'Additive Manufacturing (3D Printing)', 'Quality Inspection AI'],
  'Energy': ['Solar Power', 'Wind Energy', 'Energy Storage / Grid', 'Renewable Energy', 'CleanTech', 'Carbon Accounting', 'Hydrogen Tech'],
  'Renewable Energy': ['Solar Rooftop & Utility', 'Wind Power', 'Green Hydrogen', 'Battery Storage Systems', 'Smart Microgrids'],
  'Real Estate': ['PropTech', 'Smart Buildings', 'Property Management Software', 'Construction Tech', 'Virtual Staging', 'Tenant Experience'],
  'Education': ['EdTech', 'K-12 Learning Platforms', 'Upskilling & Certifications', 'Higher Ed SaaS', 'AI Tutor', 'Corporate Training'],
  'Retail': ['E-commerce', 'Quick Commerce', 'D2C Brands', 'Omnichannel Retail', 'Supply Chain Visibility', 'Inventory AI'],
  'Logistics': ['Warehousing Automation', 'Last-Mile Delivery', 'Freight Forwarding', 'Cold Chain', 'Route Optimization', 'Fleet Tracking'],
};

// Target Count selectable options
export const TARGET_COUNT_OPTIONS = [15, 25, 50, 100, 250, 500, 1000] as const;

// Financial Metrics
export const FINANCIAL_METRICS = [
  { value: 'funding', label: 'Funding' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'funding_or_revenue', label: 'Funding OR Revenue' },
  { value: 'funding_and_revenue', label: 'Funding AND Revenue' },
] as const;

export type FinancialMetric = typeof FINANCIAL_METRICS[number]['value'];

// Currency Options
export const CURRENCY_OPTIONS = [
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'INR', symbol: '₹', label: 'INR (₹)' },
  { code: 'EUR', symbol: '€', label: 'EUR (€)' },
  { code: 'GBP', symbol: '£', label: 'GBP (£)' },
  { code: 'AUD', symbol: 'A$', label: 'AUD (A$)' },
  { code: 'CAD', symbol: 'C$', label: 'CAD (C$)' },
  { code: 'SGD', symbol: 'S$', label: 'SGD (S$)' },
];

export interface FinancialPresetOption {
  label: string;
  value: number; // in local currency units
}

export const FINANCIAL_VALUES_USD: FinancialPresetOption[] = [
  { label: '$100K', value: 100_000 },
  { label: '$250K', value: 250_000 },
  { label: '$500K', value: 500_000 },
  { label: '$1M', value: 1_000_000 },
  { label: '$2M', value: 2_000_000 },
  { label: '$5M', value: 5_000_000 },
  { label: '$10M', value: 10_000_000 },
  { label: '$25M', value: 25_000_000 },
  { label: '$50M', value: 50_000_000 },
  { label: '$100M', value: 100_000_000 },
  { label: '$250M', value: 250_000_000 },
  { label: '$500M', value: 500_000_000 },
  { label: '$1B', value: 1_000_000_000 },
];

export const FINANCIAL_VALUES_INR: FinancialPresetOption[] = [
  { label: '₹10 Lakh', value: 1_000_000 },
  { label: '₹25 Lakh', value: 2_500_000 },
  { label: '₹50 Lakh', value: 5_000_000 },
  { label: '₹1 Crore', value: 10_000_000 },
  { label: '₹2 Crore', value: 20_000_000 },
  { label: '₹5 Crore', value: 50_000_000 },
  { label: '₹10 Crore', value: 100_000_000 },
  { label: '₹25 Crore', value: 250_000_000 },
  { label: '₹50 Crore', value: 500_000_000 },
  { label: '₹100 Crore', value: 1_000_000_000 },
  { label: '₹500 Crore', value: 5_000_000_000 },
  { label: '₹1000 Crore', value: 10_000_000_000 },
];

export const FINANCIAL_VALUES_EUR: FinancialPresetOption[] = [
  { label: '€100K', value: 100_000 },
  { label: '€250K', value: 250_000 },
  { label: '€500K', value: 500_000 },
  { label: '€1M', value: 1_000_000 },
  { label: '€2M', value: 2_000_000 },
  { label: '€5M', value: 5_000_000 },
  { label: '€10M', value: 10_000_000 },
  { label: '€25M', value: 25_000_000 },
  { label: '€50M', value: 50_000_000 },
  { label: '€100M', value: 100_000_000 },
  { label: '€250M', value: 250_000_000 },
  { label: '€500M', value: 500_000_000 },
  { label: '€1B', value: 1_000_000_000 },
];

export const FINANCIAL_VALUES_GBP: FinancialPresetOption[] = [
  { label: '£100K', value: 100_000 },
  { label: '£250K', value: 250_000 },
  { label: '£500K', value: 500_000 },
  { label: '£1M', value: 1_000_000 },
  { label: '£2M', value: 2_000_000 },
  { label: '£5M', value: 5_000_000 },
  { label: '£10M', value: 10_000_000 },
  { label: '£25M', value: 25_000_000 },
  { label: '£50M', value: 50_000_000 },
  { label: '£100M', value: 100_000_000 },
  { label: '£250M', value: 250_000_000 },
  { label: '£500M', value: 500_000_000 },
  { label: '£1B', value: 1_000_000_000 },
];

export function getFinancialValuesForCurrency(currency: string): FinancialPresetOption[] {
  switch (currency.toUpperCase()) {
    case 'INR':
      return FINANCIAL_VALUES_INR;
    case 'EUR':
      return FINANCIAL_VALUES_EUR;
    case 'GBP':
      return FINANCIAL_VALUES_GBP;
    default:
      return FINANCIAL_VALUES_USD;
  }
}

// Company Age options
export const COMPANY_AGE_OPTIONS = [
  'Any',
  'Founded within 1 year',
  'Founded within 2 years',
  'Founded within 3 years',
  'Founded within 5 years',
  'Founded within 10 years',
  'Founded more than 10 years ago',
] as const;

// Dynamically generate Year range based on current year
export function getAvailableYears(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear; y >= 1995; y--) {
    years.push(y);
  }
  return years;
}

// Data Freshness options
export const DATA_FRESHNESS_OPTIONS = [
  'Any available data',
  'Today',
  'Last 24 hours',
  'Last 3 days',
  'Last 7 days',
  'Last 14 days',
  'Last 30 days',
  'Last 90 days',
  'Last 6 months',
  'Last 1 year',
] as const;

// Activity Types
export const ACTIVITY_TYPES = [
  'Recently Founded',
  'Recently Funded',
  'Recently Updated',
  'Recently Expanded',
  'Recently Launched',
  'Recently Hiring',
  'Recently Raised Capital',
] as const;

// Company Stages
export const COMPANY_STAGE_OPTIONS = [
  'Any',
  'Idea / Very Early',
  'Pre-Seed',
  'Seed',
  'Series A',
  'Series B',
  'Series C',
  'Series D+',
  'Growth',
  'Scale-up',
  'Mature',
  'Established',
] as const;

// Company Types
export const COMPANY_TYPE_OPTIONS = [
  'Startup',
  'Emerging Company',
  'High-Growth Company',
  'Scale-up',
  'SME',
  'Enterprise',
  'Established Company',
  'Any',
] as const;

// Regions
export const REGION_OPTIONS = [
  'Global',
  'Asia',
  'Europe',
  'North America',
  'South America',
  'Africa',
  'Middle East',
  'Oceania',
] as const;

// US Presence Modes
export const US_PRESENCE_OPTIONS = [
  { value: 'strictly_none', label: 'No US Presence', badge: 'Strict 0%' },
  { value: 'minimal_or_none', label: 'Minimal / No US Presence', badge: 'Standard' },
  { value: 'some_allowed', label: 'Some US Presence Allowed', badge: 'Permissive' },
  { value: 'any', label: 'Any US Presence', badge: 'Global' },
  { value: 'exclude_us', label: 'Exclude US Companies', badge: 'Non-US' },
  { value: 'dont_care', label: "Don't Care", badge: 'Unchecked' },
  { value: 'unknown', label: 'Unknown (Strict verification required)', badge: 'Requires Proof' },
] as const;

// Decision Maker Roles
export const DECISION_MAKER_OPTIONS = [
  'CEO',
  'Founder',
  'Co-founder',
  'CEO OR Co-founder',
  'CEO AND Co-founder',
  'CTO',
  'COO',
  'CFO',
  'CMO',
  'Head of Sales',
  'Head of Partnerships',
  'Business Development',
  'Growth',
  'Product Lead',
  'Engineering Lead',
  'Country Head',
  'Regional Head',
  'Any Decision Maker',
  'Not Required',
] as const;

// Email Requirements
export const EMAIL_REQUIREMENT_OPTIONS = ['Required', 'Preferred', 'Not Required'] as const;

export const EMAIL_VERIFICATION_LEVELS = [
  { value: 'any', label: 'Any' },
  { value: 'email_found', label: 'Email Found' },
  { value: 'public_professional', label: 'Public Professional Email' },
  { value: 'mx_verified', label: 'MX Verified' },
  { value: 'deliverability_verified', label: 'Deliverability Verified' },
] as const;

// Social Profiles
export const COMPANY_SOCIAL_OPTIONS = [
  'LinkedIn',
  'Instagram',
  'X / Twitter',
  'Facebook',
  'YouTube',
  'Other',
] as const;

export const PERSON_SOCIAL_OPTIONS = [
  'LinkedIn',
  'X / Twitter',
  'Other Professional Profile',
] as const;

// Employee Count
export const EMPLOYEE_COUNT_OPTIONS = [
  'Any',
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1001-5000',
  '5000+',
  'Custom',
] as const;

// Research Sources
export const RESEARCH_SOURCES_OPTIONS = [
  'All Available Sources',
  'Search Engines',
  'Company Websites',
  'Public Professional Profiles',
  'Public LinkedIn Pages',
  'Public Naukri Pages',
  'Funding Sources',
  'Startup Directories',
  'News Sources',
  'Industry Directories',
  'Public Social Profiles',
  'RSS Sources',
  'Configured APIs',
] as const;

// TargetProfile Full Data Model
export interface TargetProfile {
  id?: string;
  name?: string;
  targetCount: number | 'Custom';
  customTargetCount?: number;

  financialMetric: FinancialMetric;
  fundingMin: number;
  fundingMax: number;
  fundingCurrency: string;
  fundingUnit?: string;

  revenueMin?: number;
  revenueMax?: number;
  revenueCurrency?: string;
  revenueUnit?: string;

  industries: string[];
  subIndustries: string[];
  customIndustry?: string;
  industrySelection?: {
    allIndustries: boolean;
    sectors: Record<string, {
      all: boolean;
      subIndustries: string[];
    }>;
  };

  companyAge: string;
  foundedFrom?: number;
  foundedTo?: number;

  companyStages: string[];
  companyTypes: string[];

  regions: string[];
  countries: string[];
  excludedCountries?: string[];

  usPresenceMode: 'strictly_none' | 'minimal_or_none' | 'some_allowed' | 'any' | 'exclude_us' | 'dont_care' | 'unknown';

  contactPersonTypes: string[];
  contactRequirement: 'Required' | 'Preferred' | 'Not Required';

  emailRequirement: 'Required' | 'Preferred' | 'Not Required';
  emailVerificationLevel: 'any' | 'email_found' | 'public_professional' | 'mx_verified' | 'deliverability_verified';

  companySocialRequirements: string[];
  personSocialRequirements: string[];
  socialProfileMode: 'Required' | 'Preferred' | 'Not Required';

  employeeCountPreset: string;
  employeeMin?: number;
  employeeMax?: number;

  freshnessWindow: string;
  activityTypes: string[];

  selectedSources: string[];
}

export const DEFAULT_TVB_TARGET_PROFILE: TargetProfile = {
  id: 'tvb_eval_default',
  name: 'TVB Evaluation Profile',
  targetCount: 15,
  financialMetric: 'funding_or_revenue',
  fundingMin: 1_000_000,
  fundingMax: 5_000_000,
  fundingCurrency: 'USD',
  industries: ['Technology'],
  subIndustries: ['SaaS', 'AI', 'Cloud Computing', 'Cybersecurity', 'DevTools'],
  companyAge: 'Any',
  foundedFrom: new Date().getFullYear() - 5,
  foundedTo: new Date().getFullYear(),
  companyStages: ['Seed', 'Series A'],
  companyTypes: ['Startup', 'Scale-up'],
  regions: ['Global'],
  countries: [],
  excludedCountries: ['United States'],
  usPresenceMode: 'minimal_or_none',
  contactPersonTypes: ['CEO', 'Founder', 'Co-founder'],
  contactRequirement: 'Required',
  emailRequirement: 'Required',
  emailVerificationLevel: 'mx_verified',
  companySocialRequirements: ['LinkedIn'],
  personSocialRequirements: ['LinkedIn'],
  socialProfileMode: 'Preferred',
  employeeCountPreset: 'Any',
  freshnessWindow: 'Last 30 days',
  activityTypes: ['Recently Funded', 'Recently Launched'],
  selectedSources: ['All Available Sources'],
};

export const STANDARD_PRESETS: TargetProfile[] = [
  {
    id: 'preset_general_technology',
    name: 'General Technology',
    targetCount: 15,
    financialMetric: 'funding_or_revenue',
    fundingMin: 1_000_000,
    fundingMax: 5_000_000,
    fundingCurrency: 'USD',
    industries: ['Technology', 'Software', 'Cloud Computing', 'Enterprise Software'],
    subIndustries: ['Cloud Computing', 'Enterprise Software', 'DevTools', 'Data & Analytics'],
    companyAge: 'Founded within 5 years',
    foundedFrom: new Date().getFullYear() - 5,
    foundedTo: new Date().getFullYear(),
    companyStages: ['Seed', 'Series A', 'Scale-up'],
    companyTypes: ['Startup', 'Scale-up'],
    regions: ['Global'],
    countries: [],
    excludedCountries: ['United States'],
    usPresenceMode: 'minimal_or_none',
    contactPersonTypes: ['CEO', 'Founder', 'Co-founder'],
    contactRequirement: 'Required',
    emailRequirement: 'Required',
    emailVerificationLevel: 'mx_verified',
    companySocialRequirements: ['LinkedIn'],
    personSocialRequirements: ['LinkedIn'],
    socialProfileMode: 'Preferred',
    employeeCountPreset: 'Any',
    freshnessWindow: 'Last 30 days',
    activityTypes: ['Recently Funded', 'Recently Launched'],
    selectedSources: ['All Available Sources'],
  },
  {
    id: 'preset_saas_companies',
    name: 'SaaS Companies',
    targetCount: 15,
    financialMetric: 'funding_or_revenue',
    fundingMin: 1_000_000,
    fundingMax: 5_000_000,
    fundingCurrency: 'USD',
    industries: ['SaaS', 'Software', 'Enterprise Software', 'DevTools'],
    subIndustries: ['B2B SaaS', 'Workflow Automation', 'Cloud Software', 'Enterprise Software'],
    companyAge: 'Founded within 5 years',
    foundedFrom: new Date().getFullYear() - 5,
    foundedTo: new Date().getFullYear(),
    companyStages: ['Seed', 'Series A', 'Scale-up'],
    companyTypes: ['Startup', 'Scale-up'],
    regions: ['Global'],
    countries: [],
    excludedCountries: ['United States'],
    usPresenceMode: 'minimal_or_none',
    contactPersonTypes: ['CEO', 'Founder', 'Co-founder'],
    contactRequirement: 'Required',
    emailRequirement: 'Required',
    emailVerificationLevel: 'mx_verified',
    companySocialRequirements: ['LinkedIn'],
    personSocialRequirements: ['LinkedIn'],
    socialProfileMode: 'Preferred',
    employeeCountPreset: 'Any',
    freshnessWindow: 'Last 30 days',
    activityTypes: ['Recently Funded', 'Recently Launched'],
    selectedSources: ['All Available Sources'],
  },
  {
    id: 'preset_agriculture',
    name: 'Agriculture',
    targetCount: 15,
    financialMetric: 'funding_or_revenue',
    fundingMin: 1_000_000,
    fundingMax: 5_000_000,
    fundingCurrency: 'USD',
    industries: ['Agriculture', 'AgriTech', 'Farming', 'Agro'],
    subIndustries: ['AgriTech', 'Farming', 'Precision Farming', 'Agricultural Equipment', 'Agricultural Supply Chain'],
    companyAge: 'Founded within 5 years',
    foundedFrom: new Date().getFullYear() - 5,
    foundedTo: new Date().getFullYear(),
    companyStages: ['Seed', 'Series A', 'Scale-up'],
    companyTypes: ['Startup', 'Scale-up'],
    regions: ['Global'],
    countries: [],
    excludedCountries: ['United States'],
    usPresenceMode: 'minimal_or_none',
    contactPersonTypes: ['CEO', 'Founder', 'Co-founder'],
    contactRequirement: 'Required',
    emailRequirement: 'Required',
    emailVerificationLevel: 'mx_verified',
    companySocialRequirements: ['LinkedIn'],
    personSocialRequirements: ['LinkedIn'],
    socialProfileMode: 'Preferred',
    employeeCountPreset: 'Any',
    freshnessWindow: 'Last 30 days',
    activityTypes: ['Recently Funded', 'Recently Launched'],
    selectedSources: ['All Available Sources'],
  },
  {
    id: 'preset_healthcare_pharma',
    name: 'Healthcare & Pharma',
    targetCount: 15,
    financialMetric: 'funding_or_revenue',
    fundingMin: 1_000_000,
    fundingMax: 5_000_000,
    fundingCurrency: 'USD',
    industries: ['Healthcare', 'Pharmaceuticals', 'HealthTech', 'Medicine', 'Medical Devices'],
    subIndustries: ['Digital Health', 'Diagnostics', 'Pharmaceuticals', 'Medical Devices', 'Clinical Trials Tech'],
    companyAge: 'Founded within 5 years',
    foundedFrom: new Date().getFullYear() - 5,
    foundedTo: new Date().getFullYear(),
    companyStages: ['Seed', 'Series A', 'Scale-up'],
    companyTypes: ['Startup', 'Scale-up'],
    regions: ['Global'],
    countries: [],
    excludedCountries: ['United States'],
    usPresenceMode: 'minimal_or_none',
    contactPersonTypes: ['CEO', 'Founder', 'Co-founder'],
    contactRequirement: 'Required',
    emailRequirement: 'Required',
    emailVerificationLevel: 'mx_verified',
    companySocialRequirements: ['LinkedIn'],
    personSocialRequirements: ['LinkedIn'],
    socialProfileMode: 'Preferred',
    employeeCountPreset: 'Any',
    freshnessWindow: 'Last 30 days',
    activityTypes: ['Recently Funded', 'Recently Launched'],
    selectedSources: ['All Available Sources'],
  },
  {
    id: 'preset_automotive',
    name: 'Automotive',
    targetCount: 15,
    financialMetric: 'funding_or_revenue',
    fundingMin: 1_000_000,
    fundingMax: 5_000_000,
    fundingCurrency: 'USD',
    industries: ['Automotive', 'Electric Vehicles', 'Mobility', 'Vehicle Technology'],
    subIndustries: ['Electric Vehicles', 'EV Infrastructure', 'Connected Vehicles', 'Auto Components', 'Fleet Telematics'],
    companyAge: 'Founded within 5 years',
    foundedFrom: new Date().getFullYear() - 5,
    foundedTo: new Date().getFullYear(),
    companyStages: ['Seed', 'Series A', 'Scale-up'],
    companyTypes: ['Startup', 'Scale-up'],
    regions: ['Global'],
    countries: [],
    excludedCountries: ['United States'],
    usPresenceMode: 'minimal_or_none',
    contactPersonTypes: ['CEO', 'Founder', 'Co-founder'],
    contactRequirement: 'Required',
    emailRequirement: 'Required',
    emailVerificationLevel: 'mx_verified',
    companySocialRequirements: ['LinkedIn'],
    personSocialRequirements: ['LinkedIn'],
    socialProfileMode: 'Preferred',
    employeeCountPreset: 'Any',
    freshnessWindow: 'Last 30 days',
    activityTypes: ['Recently Funded', 'Recently Launched'],
    selectedSources: ['All Available Sources'],
  },
  {
    id: 'preset_cybersecurity',
    name: 'Cybersecurity',
    targetCount: 15,
    financialMetric: 'funding_or_revenue',
    fundingMin: 1_000_000,
    fundingMax: 5_000_000,
    fundingCurrency: 'USD',
    industries: ['Cybersecurity', 'Cloud Computing', 'Technology'],
    subIndustries: ['Zero Trust', 'Cloud Security', 'Threat Detection', 'IAM', 'Network Security'],
    companyAge: 'Founded within 5 years',
    foundedFrom: new Date().getFullYear() - 5,
    foundedTo: new Date().getFullYear(),
    companyStages: ['Seed', 'Series A', 'Scale-up'],
    companyTypes: ['Startup', 'Scale-up'],
    regions: ['Global'],
    countries: [],
    excludedCountries: ['United States'],
    usPresenceMode: 'minimal_or_none',
    contactPersonTypes: ['CEO', 'Founder', 'Co-founder'],
    contactRequirement: 'Required',
    emailRequirement: 'Required',
    emailVerificationLevel: 'mx_verified',
    companySocialRequirements: ['LinkedIn'],
    personSocialRequirements: ['LinkedIn'],
    socialProfileMode: 'Preferred',
    employeeCountPreset: 'Any',
    freshnessWindow: 'Last 30 days',
    activityTypes: ['Recently Funded', 'Recently Launched'],
    selectedSources: ['All Available Sources'],
  },
  {
    id: 'preset_fintech',
    name: 'FinTech',
    targetCount: 15,
    financialMetric: 'funding_or_revenue',
    fundingMin: 1_000_000,
    fundingMax: 5_000_000,
    fundingCurrency: 'USD',
    industries: ['Fintech', 'Banking', 'Payments', 'Financial Services'],
    subIndustries: ['Payments', 'Lending', 'InsurTech', 'WealthTech', 'Digital Banking'],
    companyAge: 'Founded within 5 years',
    foundedFrom: new Date().getFullYear() - 5,
    foundedTo: new Date().getFullYear(),
    companyStages: ['Seed', 'Series A', 'Scale-up'],
    companyTypes: ['Startup', 'Scale-up'],
    regions: ['Global'],
    countries: [],
    excludedCountries: ['United States'],
    usPresenceMode: 'minimal_or_none',
    contactPersonTypes: ['CEO', 'Founder', 'Co-founder'],
    contactRequirement: 'Required',
    emailRequirement: 'Required',
    emailVerificationLevel: 'mx_verified',
    companySocialRequirements: ['LinkedIn'],
    personSocialRequirements: ['LinkedIn'],
    socialProfileMode: 'Preferred',
    employeeCountPreset: 'Any',
    freshnessWindow: 'Last 30 days',
    activityTypes: ['Recently Funded', 'Recently Launched'],
    selectedSources: ['All Available Sources'],
  },
  {
    id: 'preset_edtech',
    name: 'EdTech',
    targetCount: 15,
    financialMetric: 'funding_or_revenue',
    fundingMin: 1_000_000,
    fundingMax: 5_000_000,
    fundingCurrency: 'USD',
    industries: ['Education', 'EdTech', 'Online Learning', 'Training'],
    subIndustries: ['Online Learning', 'E-Learning', 'Corporate Training', 'Educational Software'],
    companyAge: 'Founded within 5 years',
    foundedFrom: new Date().getFullYear() - 5,
    foundedTo: new Date().getFullYear(),
    companyStages: ['Seed', 'Series A', 'Scale-up'],
    companyTypes: ['Startup', 'Scale-up'],
    regions: ['Global'],
    countries: [],
    excludedCountries: ['United States'],
    usPresenceMode: 'minimal_or_none',
    contactPersonTypes: ['CEO', 'Founder', 'Co-founder'],
    contactRequirement: 'Required',
    emailRequirement: 'Required',
    emailVerificationLevel: 'mx_verified',
    companySocialRequirements: ['LinkedIn'],
    personSocialRequirements: ['LinkedIn'],
    socialProfileMode: 'Preferred',
    employeeCountPreset: 'Any',
    freshnessWindow: 'Last 30 days',
    activityTypes: ['Recently Funded', 'Recently Launched'],
    selectedSources: ['All Available Sources'],
  },
  {
    id: 'preset_ecommerce',
    name: 'E-commerce',
    targetCount: 15,
    financialMetric: 'funding_or_revenue',
    fundingMin: 1_000_000,
    fundingMax: 5_000_000,
    fundingCurrency: 'USD',
    industries: ['E-commerce', 'Retail', 'Marketplace', 'Consumer Goods'],
    subIndustries: ['B2B E-commerce', 'D2C', 'Online Marketplace', 'RetailTech', 'Omnichannel'],
    companyAge: 'Founded within 5 years',
    foundedFrom: new Date().getFullYear() - 5,
    foundedTo: new Date().getFullYear(),
    companyStages: ['Seed', 'Series A', 'Scale-up'],
    companyTypes: ['Startup', 'Scale-up'],
    regions: ['Global'],
    countries: [],
    excludedCountries: ['United States'],
    usPresenceMode: 'minimal_or_none',
    contactPersonTypes: ['CEO', 'Founder', 'Co-founder'],
    contactRequirement: 'Required',
    emailRequirement: 'Required',
    emailVerificationLevel: 'mx_verified',
    companySocialRequirements: ['LinkedIn'],
    personSocialRequirements: ['LinkedIn'],
    socialProfileMode: 'Preferred',
    employeeCountPreset: 'Any',
    freshnessWindow: 'Last 30 days',
    activityTypes: ['Recently Funded', 'Recently Launched'],
    selectedSources: ['All Available Sources'],
  },
  {
    id: 'preset_manufacturing',
    name: 'Manufacturing',
    targetCount: 15,
    financialMetric: 'funding_or_revenue',
    fundingMin: 1_000_000,
    fundingMax: 5_000_000,
    fundingCurrency: 'USD',
    industries: ['Manufacturing', 'Industrial', 'Industrial Automation', 'Machinery'],
    subIndustries: ['Industrial Automation', 'Smart Manufacturing', 'Machinery', 'Robotics', 'Advanced Materials'],
    companyAge: 'Founded within 5 years',
    foundedFrom: new Date().getFullYear() - 5,
    foundedTo: new Date().getFullYear(),
    companyStages: ['Seed', 'Series A', 'Scale-up'],
    companyTypes: ['Startup', 'Scale-up'],
    regions: ['Global'],
    countries: [],
    excludedCountries: ['United States'],
    usPresenceMode: 'minimal_or_none',
    contactPersonTypes: ['CEO', 'Founder', 'Co-founder'],
    contactRequirement: 'Required',
    emailRequirement: 'Required',
    emailVerificationLevel: 'mx_verified',
    companySocialRequirements: ['LinkedIn'],
    personSocialRequirements: ['LinkedIn'],
    socialProfileMode: 'Preferred',
    employeeCountPreset: 'Any',
    freshnessWindow: 'Last 30 days',
    activityTypes: ['Recently Funded', 'Recently Launched'],
    selectedSources: ['All Available Sources'],
  },
  {
    id: 'preset_energy_cleantech',
    name: 'Energy & CleanTech',
    targetCount: 15,
    financialMetric: 'funding_or_revenue',
    fundingMin: 1_000_000,
    fundingMax: 5_000_000,
    fundingCurrency: 'USD',
    industries: ['Energy', 'Renewable Energy', 'CleanTech', 'ClimateTech', 'Solar'],
    subIndustries: ['Solar', 'Wind Energy', 'CleanTech', 'ClimateTech', 'Energy Storage', 'Sustainability'],
    companyAge: 'Founded within 5 years',
    foundedFrom: new Date().getFullYear() - 5,
    foundedTo: new Date().getFullYear(),
    companyStages: ['Seed', 'Series A', 'Scale-up'],
    companyTypes: ['Startup', 'Scale-up'],
    regions: ['Global'],
    countries: [],
    excludedCountries: ['United States'],
    usPresenceMode: 'minimal_or_none',
    contactPersonTypes: ['CEO', 'Founder', 'Co-founder'],
    contactRequirement: 'Required',
    emailRequirement: 'Required',
    emailVerificationLevel: 'mx_verified',
    companySocialRequirements: ['LinkedIn'],
    personSocialRequirements: ['LinkedIn'],
    socialProfileMode: 'Preferred',
    employeeCountPreset: 'Any',
    freshnessWindow: 'Last 30 days',
    activityTypes: ['Recently Funded', 'Recently Launched'],
    selectedSources: ['All Available Sources'],
  },
  {
    id: 'preset_logistics_supply_chain',
    name: 'Logistics & Supply Chain',
    targetCount: 15,
    financialMetric: 'funding_or_revenue',
    fundingMin: 1_000_000,
    fundingMax: 5_000_000,
    fundingCurrency: 'USD',
    industries: ['Logistics', 'Supply Chain', 'Warehousing', 'Freight', 'Shipping'],
    subIndustries: ['Freight Tech', 'Supply Chain Visibility', 'Fleet Management', 'Warehouse Automation', 'Last-Mile Delivery'],
    companyAge: 'Founded within 5 years',
    foundedFrom: new Date().getFullYear() - 5,
    foundedTo: new Date().getFullYear(),
    companyStages: ['Seed', 'Series A', 'Scale-up'],
    companyTypes: ['Startup', 'Scale-up'],
    regions: ['Global'],
    countries: [],
    excludedCountries: ['United States'],
    usPresenceMode: 'minimal_or_none',
    contactPersonTypes: ['CEO', 'Founder', 'Co-founder'],
    contactRequirement: 'Required',
    emailRequirement: 'Required',
    emailVerificationLevel: 'mx_verified',
    companySocialRequirements: ['LinkedIn'],
    personSocialRequirements: ['LinkedIn'],
    socialProfileMode: 'Preferred',
    employeeCountPreset: 'Any',
    freshnessWindow: 'Last 30 days',
    activityTypes: ['Recently Funded', 'Recently Launched'],
    selectedSources: ['All Available Sources'],
  },
  {
    id: 'preset_food_agriculture',
    name: 'Food & Agriculture',
    targetCount: 15,
    financialMetric: 'funding_or_revenue',
    fundingMin: 1_000_000,
    fundingMax: 5_000_000,
    fundingCurrency: 'USD',
    industries: ['Agriculture', 'Food', 'FoodTech', 'AgriTech', 'Agro Processing'],
    subIndustries: ['Food Processing', 'FoodTech', 'AgriTech', 'Dairy', 'Supply Chain Logistics'],
    companyAge: 'Founded within 5 years',
    foundedFrom: new Date().getFullYear() - 5,
    foundedTo: new Date().getFullYear(),
    companyStages: ['Seed', 'Series A', 'Scale-up'],
    companyTypes: ['Startup', 'Scale-up'],
    regions: ['Global'],
    countries: [],
    excludedCountries: ['United States'],
    usPresenceMode: 'minimal_or_none',
    contactPersonTypes: ['CEO', 'Founder', 'Co-founder'],
    contactRequirement: 'Required',
    emailRequirement: 'Required',
    emailVerificationLevel: 'mx_verified',
    companySocialRequirements: ['LinkedIn'],
    personSocialRequirements: ['LinkedIn'],
    socialProfileMode: 'Preferred',
    employeeCountPreset: 'Any',
    freshnessWindow: 'Last 30 days',
    activityTypes: ['Recently Funded', 'Recently Launched'],
    selectedSources: ['All Available Sources'],
  },
  {
    id: 'preset_media_entertainment',
    name: 'Media & Entertainment',
    targetCount: 15,
    financialMetric: 'funding_or_revenue',
    fundingMin: 1_000_000,
    fundingMax: 5_000_000,
    fundingCurrency: 'USD',
    industries: ['Media', 'Entertainment', 'Gaming', 'Content', 'Video'],
    subIndustries: ['Digital Media', 'Gaming', 'Creator Economy', 'Streaming', 'GameTech'],
    companyAge: 'Founded within 5 years',
    foundedFrom: new Date().getFullYear() - 5,
    foundedTo: new Date().getFullYear(),
    companyStages: ['Seed', 'Series A', 'Scale-up'],
    companyTypes: ['Startup', 'Scale-up'],
    regions: ['Global'],
    countries: [],
    excludedCountries: ['United States'],
    usPresenceMode: 'minimal_or_none',
    contactPersonTypes: ['CEO', 'Founder', 'Co-founder'],
    contactRequirement: 'Required',
    emailRequirement: 'Required',
    emailVerificationLevel: 'mx_verified',
    companySocialRequirements: ['LinkedIn'],
    personSocialRequirements: ['LinkedIn'],
    socialProfileMode: 'Preferred',
    employeeCountPreset: 'Any',
    freshnessWindow: 'Last 30 days',
    activityTypes: ['Recently Funded', 'Recently Launched'],
    selectedSources: ['All Available Sources'],
  },
  {
    id: 'preset_real_estate_proptech',
    name: 'Real Estate & PropTech',
    targetCount: 15,
    financialMetric: 'funding_or_revenue',
    fundingMin: 1_000_000,
    fundingMax: 5_000_000,
    fundingCurrency: 'USD',
    industries: ['Real Estate', 'PropTech', 'Construction', 'Smart Buildings'],
    subIndustries: ['PropTech', 'Property Management', 'Commercial Real Estate Tech', 'Smart Buildings', 'ConTech'],
    companyAge: 'Founded within 5 years',
    foundedFrom: new Date().getFullYear() - 5,
    foundedTo: new Date().getFullYear(),
    companyStages: ['Seed', 'Series A', 'Scale-up'],
    companyTypes: ['Startup', 'Scale-up'],
    regions: ['Global'],
    countries: [],
    excludedCountries: ['United States'],
    usPresenceMode: 'minimal_or_none',
    contactPersonTypes: ['CEO', 'Founder', 'Co-founder'],
    contactRequirement: 'Required',
    emailRequirement: 'Required',
    emailVerificationLevel: 'mx_verified',
    companySocialRequirements: ['LinkedIn'],
    personSocialRequirements: ['LinkedIn'],
    socialProfileMode: 'Preferred',
    employeeCountPreset: 'Any',
    freshnessWindow: 'Last 30 days',
    activityTypes: ['Recently Funded', 'Recently Launched'],
    selectedSources: ['All Available Sources'],
  },
  {
    id: 'preset_travel_hospitality',
    name: 'Travel & Hospitality',
    targetCount: 15,
    financialMetric: 'funding_or_revenue',
    fundingMin: 1_000_000,
    fundingMax: 5_000_000,
    fundingCurrency: 'USD',
    industries: ['Travel', 'TravelTech', 'Hospitality', 'Tourism'],
    subIndustries: ['TravelTech', 'Booking Platforms', 'HotelTech', 'Tourism Software'],
    companyAge: 'Founded within 5 years',
    foundedFrom: new Date().getFullYear() - 5,
    foundedTo: new Date().getFullYear(),
    companyStages: ['Seed', 'Series A', 'Scale-up'],
    companyTypes: ['Startup', 'Scale-up'],
    regions: ['Global'],
    countries: [],
    excludedCountries: ['United States'],
    usPresenceMode: 'minimal_or_none',
    contactPersonTypes: ['CEO', 'Founder', 'Co-founder'],
    contactRequirement: 'Required',
    emailRequirement: 'Required',
    emailVerificationLevel: 'mx_verified',
    companySocialRequirements: ['LinkedIn'],
    personSocialRequirements: ['LinkedIn'],
    socialProfileMode: 'Preferred',
    employeeCountPreset: 'Any',
    freshnessWindow: 'Last 30 days',
    activityTypes: ['Recently Funded', 'Recently Launched'],
    selectedSources: ['All Available Sources'],
  },
  {
    id: 'preset_telecommunications',
    name: 'Telecommunications',
    targetCount: 15,
    financialMetric: 'funding_or_revenue',
    fundingMin: 1_000_000,
    fundingMax: 5_000_000,
    fundingCurrency: 'USD',
    industries: ['Telecommunications', 'Networking', '5G', 'Communication Technology'],
    subIndustries: ['5G', 'Telecom Infrastructure', 'Network Software', 'IoT Connectivity'],
    companyAge: 'Founded within 5 years',
    foundedFrom: new Date().getFullYear() - 5,
    foundedTo: new Date().getFullYear(),
    companyStages: ['Seed', 'Series A', 'Scale-up'],
    companyTypes: ['Startup', 'Scale-up'],
    regions: ['Global'],
    countries: [],
    excludedCountries: ['United States'],
    usPresenceMode: 'minimal_or_none',
    contactPersonTypes: ['CEO', 'Founder', 'Co-founder'],
    contactRequirement: 'Required',
    emailRequirement: 'Required',
    emailVerificationLevel: 'mx_verified',
    companySocialRequirements: ['LinkedIn'],
    personSocialRequirements: ['LinkedIn'],
    socialProfileMode: 'Preferred',
    employeeCountPreset: 'Any',
    freshnessWindow: 'Last 30 days',
    activityTypes: ['Recently Funded', 'Recently Launched'],
    selectedSources: ['All Available Sources'],
  },
  {
    id: 'preset_biotechnology',
    name: 'Biotechnology',
    targetCount: 15,
    financialMetric: 'funding_or_revenue',
    fundingMin: 1_000_000,
    fundingMax: 5_000_000,
    fundingCurrency: 'USD',
    industries: ['Biotechnology', 'Life Sciences', 'Healthcare', 'Pharmaceuticals'],
    subIndustries: ['Biotech', 'Genomics', 'Bio-Manufacturing', 'Therapeutics', 'Synthetic Biology'],
    companyAge: 'Founded within 5 years',
    foundedFrom: new Date().getFullYear() - 5,
    foundedTo: new Date().getFullYear(),
    companyStages: ['Seed', 'Series A', 'Scale-up'],
    companyTypes: ['Startup', 'Scale-up'],
    regions: ['Global'],
    countries: [],
    excludedCountries: ['United States'],
    usPresenceMode: 'minimal_or_none',
    contactPersonTypes: ['CEO', 'Founder', 'Co-founder'],
    contactRequirement: 'Required',
    emailRequirement: 'Required',
    emailVerificationLevel: 'mx_verified',
    companySocialRequirements: ['LinkedIn'],
    personSocialRequirements: ['LinkedIn'],
    socialProfileMode: 'Preferred',
    employeeCountPreset: 'Any',
    freshnessWindow: 'Last 30 days',
    activityTypes: ['Recently Funded', 'Recently Launched'],
    selectedSources: ['All Available Sources'],
  },
  {
    id: 'preset_deeptech',
    name: 'DeepTech',
    targetCount: 15,
    financialMetric: 'funding_or_revenue',
    fundingMin: 1_000_000,
    fundingMax: 5_000_000,
    fundingCurrency: 'USD',
    industries: ['DeepTech', 'Robotics', 'Semiconductors', 'AI'],
    subIndustries: ['Robotics', 'Semiconductors', 'Advanced Hardware', 'Quantum Technology', 'Photonics'],
    companyAge: 'Founded within 5 years',
    foundedFrom: new Date().getFullYear() - 5,
    foundedTo: new Date().getFullYear(),
    companyStages: ['Seed', 'Series A', 'Scale-up'],
    companyTypes: ['Startup', 'Scale-up'],
    regions: ['Global'],
    countries: [],
    excludedCountries: ['United States'],
    usPresenceMode: 'minimal_or_none',
    contactPersonTypes: ['CEO', 'Founder', 'Co-founder'],
    contactRequirement: 'Required',
    emailRequirement: 'Required',
    emailVerificationLevel: 'mx_verified',
    companySocialRequirements: ['LinkedIn'],
    personSocialRequirements: ['LinkedIn'],
    socialProfileMode: 'Preferred',
    employeeCountPreset: 'Any',
    freshnessWindow: 'Last 30 days',
    activityTypes: ['Recently Funded', 'Recently Launched'],
    selectedSources: ['All Available Sources'],
  },
  {
    id: 'preset_ai_machine_learning',
    name: 'AI & Machine Learning',
    targetCount: 15,
    financialMetric: 'funding_or_revenue',
    fundingMin: 1_000_000,
    fundingMax: 5_000_000,
    fundingCurrency: 'USD',
    industries: ['AI', 'Artificial Intelligence', 'Machine Learning', 'Data & Analytics'],
    subIndustries: ['Generative AI', 'LLMs', 'Computer Vision', 'NLP', 'Predictive Analytics'],
    companyAge: 'Founded within 5 years',
    foundedFrom: new Date().getFullYear() - 5,
    foundedTo: new Date().getFullYear(),
    companyStages: ['Seed', 'Series A', 'Scale-up'],
    companyTypes: ['Startup', 'Scale-up'],
    regions: ['Global'],
    countries: [],
    excludedCountries: ['United States'],
    usPresenceMode: 'minimal_or_none',
    contactPersonTypes: ['CEO', 'Founder', 'Co-founder'],
    contactRequirement: 'Required',
    emailRequirement: 'Required',
    emailVerificationLevel: 'mx_verified',
    companySocialRequirements: ['LinkedIn'],
    personSocialRequirements: ['LinkedIn'],
    socialProfileMode: 'Preferred',
    employeeCountPreset: 'Any',
    freshnessWindow: 'Last 30 days',
    activityTypes: ['Recently Funded', 'Recently Launched'],
    selectedSources: ['All Available Sources'],
  },
  {
    id: 'preset_software_it_services',
    name: 'Software & IT Services',
    targetCount: 15,
    financialMetric: 'funding_or_revenue',
    fundingMin: 1_000_000,
    fundingMax: 5_000_000,
    fundingCurrency: 'USD',
    industries: ['Software', 'IT Services', 'Enterprise Software', 'Cloud Computing'],
    subIndustries: ['Custom Software Development', 'IT Consulting', 'Cloud Migration', 'Managed IT Services'],
    companyAge: 'Founded within 5 years',
    foundedFrom: new Date().getFullYear() - 5,
    foundedTo: new Date().getFullYear(),
    companyStages: ['Seed', 'Series A', 'Scale-up'],
    companyTypes: ['Startup', 'Scale-up'],
    regions: ['Global'],
    countries: [],
    excludedCountries: ['United States'],
    usPresenceMode: 'minimal_or_none',
    contactPersonTypes: ['CEO', 'Founder', 'Co-founder'],
    contactRequirement: 'Required',
    emailRequirement: 'Required',
    emailVerificationLevel: 'mx_verified',
    companySocialRequirements: ['LinkedIn'],
    personSocialRequirements: ['LinkedIn'],
    socialProfileMode: 'Preferred',
    employeeCountPreset: 'Any',
    freshnessWindow: 'Last 30 days',
    activityTypes: ['Recently Funded', 'Recently Launched'],
    selectedSources: ['All Available Sources'],
  },
  {
    id: 'preset_consumer_products',
    name: 'Consumer Products',
    targetCount: 15,
    financialMetric: 'funding_or_revenue',
    fundingMin: 1_000_000,
    fundingMax: 5_000_000,
    fundingCurrency: 'USD',
    industries: ['Consumer Goods', 'Retail', 'E-commerce', 'Home & Lifestyle', 'Fashion'],
    subIndustries: ['D2C Brands', 'Consumer Packaged Goods (CPG)', 'Personal Care', 'Sustainable Products'],
    companyAge: 'Founded within 5 years',
    foundedFrom: new Date().getFullYear() - 5,
    foundedTo: new Date().getFullYear(),
    companyStages: ['Seed', 'Series A', 'Scale-up'],
    companyTypes: ['Startup', 'Scale-up'],
    regions: ['Global'],
    countries: [],
    excludedCountries: ['United States'],
    usPresenceMode: 'minimal_or_none',
    contactPersonTypes: ['CEO', 'Founder', 'Co-founder'],
    contactRequirement: 'Required',
    emailRequirement: 'Required',
    emailVerificationLevel: 'mx_verified',
    companySocialRequirements: ['LinkedIn'],
    personSocialRequirements: ['LinkedIn'],
    socialProfileMode: 'Preferred',
    employeeCountPreset: 'Any',
    freshnessWindow: 'Last 30 days',
    activityTypes: ['Recently Funded', 'Recently Launched'],
    selectedSources: ['All Available Sources'],
  },
  {
    id: 'preset_professional_services',
    name: 'Professional Services',
    targetCount: 15,
    financialMetric: 'funding_or_revenue',
    fundingMin: 1_000_000,
    fundingMax: 5_000_000,
    fundingCurrency: 'USD',
    industries: ['Consulting', 'Legal', 'LegalTech', 'HR', 'HRTech', 'Accounting'],
    subIndustries: ['LegalTech', 'HRTech', 'Corporate Consulting', 'Tax & Compliance Tech'],
    companyAge: 'Founded within 5 years',
    foundedFrom: new Date().getFullYear() - 5,
    foundedTo: new Date().getFullYear(),
    companyStages: ['Seed', 'Series A', 'Scale-up'],
    companyTypes: ['Startup', 'Scale-up'],
    regions: ['Global'],
    countries: [],
    excludedCountries: ['United States'],
    usPresenceMode: 'minimal_or_none',
    contactPersonTypes: ['CEO', 'Founder', 'Co-founder'],
    contactRequirement: 'Required',
    emailRequirement: 'Required',
    emailVerificationLevel: 'mx_verified',
    companySocialRequirements: ['LinkedIn'],
    personSocialRequirements: ['LinkedIn'],
    socialProfileMode: 'Preferred',
    employeeCountPreset: 'Any',
    freshnessWindow: 'Last 30 days',
    activityTypes: ['Recently Funded', 'Recently Launched'],
    selectedSources: ['All Available Sources'],
  },
  {
    id: 'preset_other_custom',
    name: 'Other / Custom',
    targetCount: 15,
    financialMetric: 'funding_or_revenue',
    fundingMin: 1_000_000,
    fundingMax: 5_000_000,
    fundingCurrency: 'USD',
    industries: [],
    subIndustries: [],
    companyAge: 'Founded within 5 years',
    foundedFrom: new Date().getFullYear() - 5,
    foundedTo: new Date().getFullYear(),
    companyStages: ['Seed', 'Series A', 'Scale-up'],
    companyTypes: ['Startup', 'Scale-up'],
    regions: ['Global'],
    countries: [],
    excludedCountries: ['United States'],
    usPresenceMode: 'minimal_or_none',
    contactPersonTypes: ['CEO', 'Founder', 'Co-founder'],
    contactRequirement: 'Required',
    emailRequirement: 'Required',
    emailVerificationLevel: 'mx_verified',
    companySocialRequirements: ['LinkedIn'],
    personSocialRequirements: ['LinkedIn'],
    socialProfileMode: 'Preferred',
    employeeCountPreset: 'Any',
    freshnessWindow: 'Last 30 days',
    activityTypes: ['Recently Funded', 'Recently Launched'],
    selectedSources: ['All Available Sources'],
  },
];

export const BUILTIN_SAVED_PROFILES: TargetProfile[] = [
  DEFAULT_TVB_TARGET_PROFILE,
];

/**
 * Format active target profile into concise single-line or multi-line summary banner (Section 22)
 * Example:
 * 100 companies | Agriculture | ₹50 Lakh - ₹50 Crore | India | Emerging + Scale-up | Minimal/No US | CEO + Co-founder | Email Required | Freshness: 7 Days
 */
export function formatTargetSummary(profile: TargetProfile): string {
  const parts: string[] = [];

  // Target count
  const count = profile.targetCount === 'Custom' ? (profile.customTargetCount || 15) : (profile.targetCount ?? 15);
  parts.push(`${count} companies`);

  // Industries
  const customs = profile.customIndustry ? [profile.customIndustry] : [];
  const indSummary = getConciseIndustrySummary(profile.subIndustries || [], customs);
  if (indSummary.text && indSummary.globalState !== 'none') {
    parts.push(indSummary.text);
  } else if (profile.industries && profile.industries.length > 0 && !profile.industries.includes('all')) {
    parts.push(profile.industries.slice(0, 3).join(', ') + (profile.industries.length > 3 ? ` +${profile.industries.length - 3}` : ''));
  } else {
    parts.push('All Industries');
  }

  // Financial Range with Currency
  const formatAmt = (val: number | string | undefined | null, cur: string) => {
    if (val === undefined || val === null) return '';
    if (typeof val === 'string') return val;
    if (cur === 'INR') {
      if (val >= 10_000_000) return `₹${(val / 10_000_000).toFixed(val % 10_000_000 === 0 ? 0 : 1)} Crore`;
      if (val >= 100_000) return `₹${(val / 100_000).toFixed(val % 100_000 === 0 ? 0 : 1)} Lakh`;
      return `₹${val.toLocaleString()}`;
    }
    const sym = cur === 'EUR' ? '€' : cur === 'GBP' ? '£' : '$';
    if (val >= 1_000_000_000) return `${sym}${(val / 1_000_000_000).toFixed(val % 1_000_000_000 === 0 ? 0 : 1)}B`;
    if (val >= 1_000_000) return `${sym}${(val / 1_000_000).toFixed(val % 1_000_000 === 0 ? 0 : 1)}M`;
    if (val >= 1_000) return `${sym}${(val / 1_000).toFixed(0)}K`;
    return `${sym}${val.toLocaleString()}`;
  };

  const fMin = profile.fundingMin ?? (profile as any).financialMin;
  const fMax = profile.fundingMax ?? (profile as any).financialMax;
  const fCur = profile.fundingCurrency ?? (profile as any).financialCurrency ?? 'USD';
  const minStr = formatAmt(fMin, fCur);
  const maxStr = formatAmt(fMax, fCur);
  if (minStr || maxStr) {
    parts.push(`${minStr || '$0'} – ${maxStr || 'Any'}`);
  }

  // Geography
  const countries = profile.countries || [];
  const regions = profile.regions || [];
  if (countries.length > 0) {
    parts.push(countries.slice(0, 2).join(', ') + (countries.length > 2 ? ` +${countries.length - 2}` : ''));
  } else if (regions.length > 0 && !regions.includes('Global')) {
    parts.push(regions.join(', '));
  } else {
    parts.push('Global');
  }

  // Types / Stages
  const companyTypes = profile.companyTypes || [];
  const companyStages = profile.companyStages || [];
  if (companyTypes.length > 0 && !companyTypes.includes('Any')) {
    parts.push(companyTypes.slice(0, 2).join(' + '));
  } else if (companyStages.length > 0 && !companyStages.includes('Any')) {
    parts.push(companyStages.slice(0, 2).join(' + '));
  }

  // US Presence
  if (profile.usPresenceMode === 'strictly_none') parts.push('Zero US');
  else if (profile.usPresenceMode === 'minimal_or_none') parts.push('Minimal/No US');
  else if (profile.usPresenceMode === 'exclude_us') parts.push('Exclude US');
  else if (profile.usPresenceMode === 'any') parts.push('Any US');

  // People
  const contactPersonTypes = profile.contactPersonTypes || [];
  if (contactPersonTypes.length > 0 && !contactPersonTypes.includes('Not Required')) {
    parts.push(contactPersonTypes.slice(0, 2).join(' + '));
  }

  // Email
  if (profile.emailRequirement === 'Required') parts.push('Email Required');

  // Freshness
  if (profile.freshnessWindow && profile.freshnessWindow !== 'Any available data') {
    parts.push(`Freshness: ${profile.freshnessWindow}`);
  }

  return parts.join(' | ');
}

import type { HuntConfig } from './types';
import { parseFundingDetails } from './validation';

/**
 * Converts a TargetProfile into a full HuntConfig for pipeline execution
 */
export function targetProfileToHuntConfig(profile: TargetProfile): HuntConfig {
  const targetLeads = profile.targetCount === 'Custom' ? (profile.customTargetCount || 15) : profile.targetCount;

  // Resolve numerical funding values if strings were provided (e.g. '₹50 Lakh' or '$1M')
  let rawMin = typeof profile.fundingMin === 'number' ? profile.fundingMin : 1_000_000;
  let rawMax = typeof profile.fundingMax === 'number' ? profile.fundingMax : 5_000_000;
  if (typeof profile.fundingMin === 'string') {
    const p = parseFundingDetails(profile.fundingMin);
    if (p) rawMin = profile.fundingCurrency === 'INR' ? p.amountInr : p.amountUsd;
  }
  if (typeof profile.fundingMax === 'string') {
    const p = parseFundingDetails(profile.fundingMax);
    if (p) rawMax = profile.fundingCurrency === 'INR' ? p.amountInr : p.amountUsd;
  }

  // Format preset text
  const formatAmt = (val: number, cur: string) => {
    if (cur === 'INR') {
      if (val >= 10_000_000) return `₹${(val / 10_000_000).toFixed(val % 10_000_000 === 0 ? 0 : 1)}Cr`;
      if (val >= 100_000) return `₹${(val / 100_000).toFixed(val % 100_000 === 0 ? 0 : 1)}L`;
      return `₹${val}`;
    }
    const sym = cur === 'EUR' ? '€' : cur === 'GBP' ? '£' : '$';
    if (val >= 1_000_000_000) return `${sym}${(val / 1_000_000_000).toFixed(val % 1_000_000_000 === 0 ? 0 : 1)}B`;
    if (val >= 1_000_000) return `${sym}${(val / 1_000_000).toFixed(val % 1_000_000 === 0 ? 0 : 1)}M`;
    if (val >= 1_000) return `${sym}${(val / 1_000).toFixed(0)}K`;
    return `${sym}${val}`;
  };

  const presetLabel = `${formatAmt(rawMin, profile.fundingCurrency)}–${formatAmt(rawMax, profile.fundingCurrency)}`;

  // Normalization to USD base values
  let usdMin = rawMin;
  let usdMax = rawMax;
  if (profile.fundingCurrency === 'INR') {
    usdMin = Math.round(rawMin / 85);
    usdMax = Math.round(rawMax / 85);
  } else if (profile.fundingCurrency === 'EUR') {
    usdMin = Math.round(rawMin * 1.08);
    usdMax = Math.round(rawMax * 1.08);
  } else if (profile.fundingCurrency === 'GBP') {
    usdMin = Math.round(rawMin * 1.28);
    usdMax = Math.round(rawMax * 1.28);
  }

  const isGlobalIndustries =
    !profile.industries.length ||
    profile.industries.includes('all') ||
    profile.industries.includes('All Industries') ||
    getGlobalSelectionState(profile.subIndustries || []) === 'all';

  const normalizedSectors = isGlobalIndustries
    ? ['all']
    : Array.from(new Set(profile.industries.filter(s => s !== 'all' && s !== 'All Industries')));

  const normalizedBusinessModels = profile.subIndustries && profile.subIndustries.length > 0
    ? Array.from(new Set(profile.subIndustries))
    : ['Platform', 'SaaS'];

  const isTech = isGlobalIndustries || profile.industries.some(i => ['Technology', 'Software', 'SaaS', 'AI', 'Artificial Intelligence', 'Cybersecurity', 'DeepTech'].includes(i)) || (profile.subIndustries || []).some(s => ['SaaS', 'AI', 'Software', 'DevTools', 'Cloud Computing'].includes(s));

  return {
    id: profile.id || `hunt_${Date.now()}`,
    name: profile.name || 'Custom Target Hunt',
    geography: {
      mode: profile.countries.length > 0 ? 'countries' : profile.regions.length > 0 && !profile.regions.includes('Global') ? 'regions' : 'global',
      regions: profile.regions.filter(r => r !== 'Global'),
      countries: profile.countries,
      excludedCountries: profile.excludedCountries || ['United States'],
      usPresence: profile.usPresenceMode === 'strictly_none' ? 'strictly_none' : profile.usPresenceMode === 'any' ? 'any' : 'minimal_or_none',
    },
    sectors: normalizedSectors,
    businessModels: normalizedBusinessModels,
    stage: profile.companyStages.length > 0 ? profile.companyStages : ['Seed', 'Series A'],
    funding: {
      min: usdMin,
      max: usdMax,
      mode: profile.financialMetric === 'funding' ? 'funding' : profile.financialMetric === 'revenue' ? 'revenue' : 'funding_or_revenue',
      preset: presetLabel,
    },
    companySize: profile.employeeCountPreset === 'Any' ? [] : [profile.employeeCountPreset],
    techProfile: isTech ? 'platform_required' : 'any_tech',
    contactRequirement: profile.contactPersonTypes.some(t => t.includes('CEO') && t.includes('Founder'))
      ? 'ceo_or_cofounder'
      : profile.contactPersonTypes.some(t => t === 'CEO')
      ? 'ceo_only'
      : profile.contactPersonTypes.some(t => t === 'Founder' || t === 'Co-founder')
      ? 'cofounder_only'
      : 'any_executive',
    emailVerification: profile.emailRequirement === 'Required' ? 'required' : profile.emailRequirement === 'Preferred' ? 'preferred' : 'none',
    depth: targetLeads > 50 ? 'deep' : 'balanced',
    targetLeads,
    targetProfile: profile,
  };
}

/**
 * Converts a legacy HuntConfig into a TargetProfile
 */
export function huntConfigToTargetProfile(config: HuntConfig): TargetProfile {
  if (config.targetProfile) {
    return config.targetProfile;
  }

  return {
    id: config.id,
    name: config.name,
    targetCount: config.targetLeads || 15,
    financialMetric: config.funding.mode === 'funding' ? 'funding' : config.funding.mode === 'revenue' ? 'revenue' : 'funding_or_revenue',
    fundingMin: config.funding.min || 1_000_000,
    fundingMax: config.funding.max || 5_000_000,
    fundingCurrency: 'USD',
    industries: config.sectors.filter(s => s !== 'all'),
    subIndustries: config.businessModels || [],
    companyAge: 'Any',
    foundedFrom: new Date().getFullYear() - 5,
    foundedTo: new Date().getFullYear(),
    companyStages: config.stage || ['Seed', 'Series A'],
    companyTypes: ['Startup'],
    regions: config.geography.regions.length > 0 ? config.geography.regions : ['Global'],
    countries: config.geography.countries || [],
    excludedCountries: config.geography.excludedCountries || ['United States'],
    usPresenceMode: config.geography.usPresence === 'strictly_none' ? 'strictly_none' : 'minimal_or_none',
    contactPersonTypes: config.contactRequirement === 'ceo_only' ? ['CEO'] : config.contactRequirement === 'cofounder_only' ? ['Co-founder'] : ['CEO', 'Founder', 'Co-founder'],
    contactRequirement: 'Required',
    emailRequirement: config.emailVerification === 'required' ? 'Required' : config.emailVerification === 'preferred' ? 'Preferred' : 'Not Required',
    emailVerificationLevel: config.emailVerification === 'required' ? 'mx_verified' : 'any',
    companySocialRequirements: ['LinkedIn'],
    personSocialRequirements: ['LinkedIn'],
    socialProfileMode: 'Preferred',
    employeeCountPreset: config.companySize?.[0] || 'Any',
    freshnessWindow: 'Last 30 days',
    activityTypes: ['Recently Funded'],
    selectedSources: ['All Available Sources'],
  };
}

