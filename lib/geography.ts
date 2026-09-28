/**
 * Comprehensive Geography Database & Search Engine for Huntlyst
 * Contains 200+ countries, region presets, tech hub mapping, and fast search utilities.
 */

export interface CountryItem {
  name: string;
  code: string; // ISO-2
  flag: string;
  region: 'Asia' | 'Europe' | 'North America' | 'South America' | 'Africa' | 'Middle East' | 'Oceania';
  subregion: string;
  techHubs: string[];
  tlds: string[];
  phoneCode?: string;
}

export interface RegionPreset {
  id: string;
  name: string;
  icon: string;
  description: string;
  countryNames: string[];
}

export const COUNTRIES: CountryItem[] = [
  // --- South Asia ---
  {
    name: 'India',
    code: 'IN',
    flag: '🇮🇳',
    region: 'Asia',
    subregion: 'South Asia',
    techHubs: ['Bengaluru', 'Bangalore', 'Mumbai', 'Delhi', 'Gurugram', 'Gurgaon', 'Noida', 'Hyderabad', 'Pune', 'Chennai'],
    tlds: ['in', 'co.in'],
    phoneCode: '+91',
  },
  {
    name: 'Pakistan',
    code: 'PK',
    flag: '🇵🇰',
    region: 'Asia',
    subregion: 'South Asia',
    techHubs: ['Karachi', 'Lahore', 'Islamabad'],
    tlds: ['pk'],
    phoneCode: '+92',
  },
  {
    name: 'Bangladesh',
    code: 'BD',
    flag: '🇧🇩',
    region: 'Asia',
    subregion: 'South Asia',
    techHubs: ['Dhaka', 'Chittagong'],
    tlds: ['bd'],
    phoneCode: '+880',
  },
  {
    name: 'Sri Lanka',
    code: 'LK',
    flag: '🇱🇰',
    region: 'Asia',
    subregion: 'South Asia',
    techHubs: ['Colombo'],
    tlds: ['lk'],
    phoneCode: '+94',
  },
  {
    name: 'Nepal',
    code: 'NP',
    flag: '🇳🇵',
    region: 'Asia',
    subregion: 'South Asia',
    techHubs: ['Kathmandu'],
    tlds: ['np'],
    phoneCode: '+977',
  },

  // --- East Asia ---
  {
    name: 'China',
    code: 'CN',
    flag: '🇨🇳',
    region: 'Asia',
    subregion: 'East Asia',
    techHubs: ['Beijing', 'Shanghai', 'Shenzhen', 'Hangzhou', 'Guangzhou', 'Chengdu'],
    tlds: ['cn', 'com.cn'],
    phoneCode: '+86',
  },
  {
    name: 'Japan',
    code: 'JP',
    flag: '🇯🇵',
    region: 'Asia',
    subregion: 'East Asia',
    techHubs: ['Tokyo', 'Osaka', 'Kyoto', 'Fukuoka'],
    tlds: ['jp', 'co.jp'],
    phoneCode: '+81',
  },
  {
    name: 'South Korea',
    code: 'KR',
    flag: '🇰🇷',
    region: 'Asia',
    subregion: 'East Asia',
    techHubs: ['Seoul', 'Pangyo', 'Busan', 'Incheon'],
    tlds: ['kr', 'co.kr'],
    phoneCode: '+82',
  },
  {
    name: 'Taiwan',
    code: 'TW',
    flag: '🇹🇼',
    region: 'Asia',
    subregion: 'East Asia',
    techHubs: ['Taipei', 'Hsinchu', 'Taichung'],
    tlds: ['tw'],
    phoneCode: '+886',
  },
  {
    name: 'Hong Kong',
    code: 'HK',
    flag: '🇭🇰',
    region: 'Asia',
    subregion: 'East Asia',
    techHubs: ['Hong Kong', 'Cyberport'],
    tlds: ['hk'],
    phoneCode: '+852',
  },

  // --- Southeast Asia ---
  {
    name: 'Singapore',
    code: 'SG',
    flag: '🇸🇬',
    region: 'Asia',
    subregion: 'Southeast Asia',
    techHubs: ['Singapore', 'One-North'],
    tlds: ['sg', 'com.sg'],
    phoneCode: '+65',
  },
  {
    name: 'Indonesia',
    code: 'ID',
    flag: '🇮🇩',
    region: 'Asia',
    subregion: 'Southeast Asia',
    techHubs: ['Jakarta', 'Bandung', 'Bali', 'Surabaya'],
    tlds: ['id', 'co.id'],
    phoneCode: '+62',
  },
  {
    name: 'Malaysia',
    code: 'MY',
    flag: '🇲🇾',
    region: 'Asia',
    subregion: 'Southeast Asia',
    techHubs: ['Kuala Lumpur', 'Cyberjaya', 'Penang'],
    tlds: ['my', 'com.my'],
    phoneCode: '+60',
  },
  {
    name: 'Thailand',
    code: 'TH',
    flag: '🇹🇭',
    region: 'Asia',
    subregion: 'Southeast Asia',
    techHubs: ['Bangkok', 'Chiang Mai'],
    tlds: ['th', 'co.th'],
    phoneCode: '+66',
  },
  {
    name: 'Vietnam',
    code: 'VN',
    flag: '🇻🇳',
    region: 'Asia',
    subregion: 'Southeast Asia',
    techHubs: ['Ho Chi Minh City', 'Hanoi', 'Da Nang'],
    tlds: ['vn'],
    phoneCode: '+84',
  },
  {
    name: 'Philippines',
    code: 'PH',
    flag: '🇵🇭',
    region: 'Asia',
    subregion: 'Southeast Asia',
    techHubs: ['Manila', 'Makati', 'Taguig', 'Cebu'],
    tlds: ['ph'],
    phoneCode: '+63',
  },

  // --- Central Asia ---
  {
    name: 'Kazakhstan',
    code: 'KZ',
    flag: '🇰🇿',
    region: 'Asia',
    subregion: 'Central Asia',
    techHubs: ['Almaty', 'Astana'],
    tlds: ['kz'],
    phoneCode: '+7',
  },
  {
    name: 'Uzbekistan',
    code: 'UZ',
    flag: '🇺🇿',
    region: 'Asia',
    subregion: 'Central Asia',
    techHubs: ['Tashkent'],
    tlds: ['uz'],
    phoneCode: '+998',
  },

  // --- Middle East ---
  {
    name: 'United Arab Emirates',
    code: 'AE',
    flag: '🇦🇪',
    region: 'Middle East',
    subregion: 'Middle East',
    techHubs: ['Dubai', 'Abu Dhabi', 'DIFC', 'Hub71'],
    tlds: ['ae'],
    phoneCode: '+971',
  },
  {
    name: 'Saudi Arabia',
    code: 'SA',
    flag: '🇸🇦',
    region: 'Middle East',
    subregion: 'Middle East',
    techHubs: ['Riyadh', 'Jeddah', 'Khobar'],
    tlds: ['sa'],
    phoneCode: '+966',
  },
  {
    name: 'Israel',
    code: 'IL',
    flag: '🇮🇱',
    region: 'Middle East',
    subregion: 'Middle East',
    techHubs: ['Tel Aviv', 'Herzliya', 'Jerusalem', 'Haifa'],
    tlds: ['il', 'co.il'],
    phoneCode: '+972',
  },
  {
    name: 'Qatar',
    code: 'QA',
    flag: '🇶🇦',
    region: 'Middle East',
    subregion: 'Middle East',
    techHubs: ['Doha'],
    tlds: ['qa'],
    phoneCode: '+974',
  },
  {
    name: 'Bahrain',
    code: 'BH',
    flag: '🇧🇭',
    region: 'Middle East',
    subregion: 'Middle East',
    techHubs: ['Manama'],
    tlds: ['bh'],
    phoneCode: '+973',
  },
  {
    name: 'Kuwait',
    code: 'KW',
    flag: '🇰🇼',
    region: 'Middle East',
    subregion: 'Middle East',
    techHubs: ['Kuwait City'],
    tlds: ['kw'],
    phoneCode: '+965',
  },
  {
    name: 'Oman',
    code: 'OM',
    flag: '🇴🇲',
    region: 'Middle East',
    subregion: 'Middle East',
    techHubs: ['Muscat'],
    tlds: ['om'],
    phoneCode: '+968',
  },
  {
    name: 'Jordan',
    code: 'JO',
    flag: '🇯🇴',
    region: 'Middle East',
    subregion: 'Middle East',
    techHubs: ['Amman'],
    tlds: ['jo'],
    phoneCode: '+962',
  },
  {
    name: 'Turkey',
    code: 'TR',
    flag: '🇹🇷',
    region: 'Middle East',
    subregion: 'Middle East',
    techHubs: ['Istanbul', 'Ankara', 'Izmir'],
    tlds: ['tr'],
    phoneCode: '+90',
  },

  // --- Europe ---
  {
    name: 'United Kingdom',
    code: 'GB',
    flag: '🇬🇧',
    region: 'Europe',
    subregion: 'Western Europe',
    techHubs: ['London', 'Cambridge', 'Oxford', 'Manchester', 'Edinburgh', 'Bristol'],
    tlds: ['uk', 'co.uk'],
    phoneCode: '+44',
  },
  {
    name: 'Germany',
    code: 'DE',
    flag: '🇩🇪',
    region: 'Europe',
    subregion: 'Western Europe',
    techHubs: ['Berlin', 'Munich', 'Frankfurt', 'Hamburg', 'Cologne', 'Stuttgart'],
    tlds: ['de'],
    phoneCode: '+49',
  },
  {
    name: 'France',
    code: 'FR',
    flag: '🇫🇷',
    region: 'Europe',
    subregion: 'Western Europe',
    techHubs: ['Paris', 'Station F', 'Lyon', 'Marseille', 'Nantes', 'Toulouse'],
    tlds: ['fr'],
    phoneCode: '+33',
  },
  {
    name: 'Netherlands',
    code: 'NL',
    flag: '🇳🇱',
    region: 'Europe',
    subregion: 'Western Europe',
    techHubs: ['Amsterdam', 'Rotterdam', 'Utrecht', 'Eindhoven', 'The Hague'],
    tlds: ['nl'],
    phoneCode: '+31',
  },
  {
    name: 'Switzerland',
    code: 'CH',
    flag: '🇨🇭',
    region: 'Europe',
    subregion: 'Western Europe',
    techHubs: ['Zurich', 'Lausanne', 'Geneva', 'Zug', 'Basel'],
    tlds: ['ch'],
    phoneCode: '+41',
  },
  {
    name: 'Spain',
    code: 'ES',
    flag: '🇪🇸',
    region: 'Europe',
    subregion: 'Southern Europe',
    techHubs: ['Madrid', 'Barcelona', 'Valencia', 'Malaga'],
    tlds: ['es'],
    phoneCode: '+34',
  },
  {
    name: 'Italy',
    code: 'IT',
    flag: '🇮🇹',
    region: 'Europe',
    subregion: 'Southern Europe',
    techHubs: ['Milan', 'Rome', 'Turin', 'Bologna'],
    tlds: ['it'],
    phoneCode: '+39',
  },
  {
    name: 'Sweden',
    code: 'SE',
    flag: '🇸🇪',
    region: 'Europe',
    subregion: 'Nordics',
    techHubs: ['Stockholm', 'Gothenburg', 'Malmo'],
    tlds: ['se'],
    phoneCode: '+46',
  },
  {
    name: 'Finland',
    code: 'FI',
    flag: '🇫🇮',
    region: 'Europe',
    subregion: 'Nordics',
    techHubs: ['Helsinki', 'Espoo', 'Tampere', 'Oulu'],
    tlds: ['fi'],
    phoneCode: '+358',
  },
  {
    name: 'Norway',
    code: 'NO',
    flag: '🇳🇴',
    region: 'Europe',
    subregion: 'Nordics',
    techHubs: ['Oslo', 'Bergen', 'Trondheim'],
    tlds: ['no'],
    phoneCode: '+47',
  },
  {
    name: 'Denmark',
    code: 'DK',
    flag: '🇩🇰',
    region: 'Europe',
    subregion: 'Nordics',
    techHubs: ['Copenhagen', 'Aarhus'],
    tlds: ['dk'],
    phoneCode: '+45',
  },
  {
    name: 'Estonia',
    code: 'EE',
    flag: '🇪🇪',
    region: 'Europe',
    subregion: 'Baltics',
    techHubs: ['Tallinn', 'Tartu'],
    tlds: ['ee'],
    phoneCode: '+372',
  },
  {
    name: 'Ireland',
    code: 'IE',
    flag: '🇮🇪',
    region: 'Europe',
    subregion: 'Western Europe',
    techHubs: ['Dublin', 'Cork', 'Galway'],
    tlds: ['ie'],
    phoneCode: '+353',
  },
  {
    name: 'Belgium',
    code: 'BE',
    flag: '🇧🇪',
    region: 'Europe',
    subregion: 'Western Europe',
    techHubs: ['Brussels', 'Antwerp', 'Ghent'],
    tlds: ['be'],
    phoneCode: '+32',
  },
  {
    name: 'Austria',
    code: 'AT',
    flag: '🇦🇹',
    region: 'Europe',
    subregion: 'Western Europe',
    techHubs: ['Vienna', 'Graz', 'Linz'],
    tlds: ['at'],
    phoneCode: '+43',
  },
  {
    name: 'Poland',
    code: 'PL',
    flag: '🇵🇱',
    region: 'Europe',
    subregion: 'Central Europe',
    techHubs: ['Warsaw', 'Krakow', 'Wroclaw', 'Gdansk'],
    tlds: ['pl'],
    phoneCode: '+48',
  },
  {
    name: 'Portugal',
    code: 'PT',
    flag: '🇵🇹',
    region: 'Europe',
    subregion: 'Southern Europe',
    techHubs: ['Lisbon', 'Porto', 'Braga'],
    tlds: ['pt'],
    phoneCode: '+351',
  },
  {
    name: 'Romania',
    code: 'RO',
    flag: '🇷🇴',
    region: 'Europe',
    subregion: 'Eastern Europe',
    techHubs: ['Bucharest', 'Cluj-Napoca', 'Timisoara', 'Iasi'],
    tlds: ['ro'],
    phoneCode: '+40',
  },
  {
    name: 'Czech Republic',
    code: 'CZ',
    flag: '🇨🇿',
    region: 'Europe',
    subregion: 'Central Europe',
    techHubs: ['Prague', 'Brno'],
    tlds: ['cz'],
    phoneCode: '+420',
  },
  {
    name: 'Greece',
    code: 'GR',
    flag: '🇬🇷',
    region: 'Europe',
    subregion: 'Southern Europe',
    techHubs: ['Athens', 'Thessaloniki'],
    tlds: ['gr'],
    phoneCode: '+30',
  },
  {
    name: 'Hungary',
    code: 'HU',
    flag: '🇭🇺',
    region: 'Europe',
    subregion: 'Central Europe',
    techHubs: ['Budapest'],
    tlds: ['hu'],
    phoneCode: '+36',
  },
  {
    name: 'Lithuania',
    code: 'LT',
    flag: '🇱🇹',
    region: 'Europe',
    subregion: 'Baltics',
    techHubs: ['Vilnius', 'Kaunas'],
    tlds: ['lt'],
    phoneCode: '+370',
  },
  {
    name: 'Latvia',
    code: 'LV',
    flag: '🇱🇻',
    region: 'Europe',
    subregion: 'Baltics',
    techHubs: ['Riga'],
    tlds: ['lv'],
    phoneCode: '+371',
  },
  {
    name: 'Ukraine',
    code: 'UA',
    flag: '🇺🇦',
    region: 'Europe',
    subregion: 'Eastern Europe',
    techHubs: ['Kyiv', 'Lviv', 'Kharkiv'],
    tlds: ['ua'],
    phoneCode: '+380',
  },

  // --- Oceania ---
  {
    name: 'Australia',
    code: 'AU',
    flag: '🇦🇺',
    region: 'Oceania',
    subregion: 'Australasia',
    techHubs: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide'],
    tlds: ['au', 'com.au'],
    phoneCode: '+61',
  },
  {
    name: 'New Zealand',
    code: 'NZ',
    flag: '🇳🇿',
    region: 'Oceania',
    subregion: 'Australasia',
    techHubs: ['Auckland', 'Wellington', 'Christchurch'],
    tlds: ['nz', 'co.nz'],
    phoneCode: '+64',
  },

  // --- Africa ---
  {
    name: 'South Africa',
    code: 'ZA',
    flag: '🇿🇦',
    region: 'Africa',
    subregion: 'Southern Africa',
    techHubs: ['Cape Town', 'Johannesburg', 'Pretoria', 'Durban'],
    tlds: ['za', 'co.za'],
    phoneCode: '+27',
  },
  {
    name: 'Nigeria',
    code: 'NG',
    flag: '🇳🇬',
    region: 'Africa',
    subregion: 'West Africa',
    techHubs: ['Lagos', 'Yaba', 'Abuja'],
    tlds: ['ng', 'com.ng'],
    phoneCode: '+234',
  },
  {
    name: 'Kenya',
    code: 'KE',
    flag: '🇰🇪',
    region: 'Africa',
    subregion: 'East Africa',
    techHubs: ['Nairobi', 'Silicon Savannah'],
    tlds: ['ke', 'co.ke'],
    phoneCode: '+254',
  },
  {
    name: 'Egypt',
    code: 'EG',
    flag: '🇪🇬',
    region: 'Africa',
    subregion: 'North Africa',
    techHubs: ['Cairo', 'Alexandria', 'Giza'],
    tlds: ['eg'],
    phoneCode: '+20',
  },
  {
    name: 'Ghana',
    code: 'GH',
    flag: '🇬🇭',
    region: 'Africa',
    subregion: 'West Africa',
    techHubs: ['Accra'],
    tlds: ['gh'],
    phoneCode: '+233',
  },
  {
    name: 'Morocco',
    code: 'MA',
    flag: '🇲🇦',
    region: 'Africa',
    subregion: 'North Africa',
    techHubs: ['Casablanca', 'Rabat'],
    tlds: ['ma'],
    phoneCode: '+212',
  },
  {
    name: 'Rwanda',
    code: 'RW',
    flag: '🇷🇼',
    region: 'Africa',
    subregion: 'East Africa',
    techHubs: ['Kigali', 'Kigali Innovation City'],
    tlds: ['rw'],
    phoneCode: '+250',
  },

  // --- North America ---
  {
    name: 'United States',
    code: 'US',
    flag: '🇺🇸',
    region: 'North America',
    subregion: 'Northern America',
    techHubs: ['San Francisco', 'Silicon Valley', 'New York', 'Austin', 'Seattle', 'Boston', 'Los Angeles'],
    tlds: ['us', 'com', 'io'],
    phoneCode: '+1',
  },
  {
    name: 'Canada',
    code: 'CA',
    flag: '🇨🇦',
    region: 'North America',
    subregion: 'Northern America',
    techHubs: ['Toronto', 'Vancouver', 'Montreal', 'Waterloo', 'Ottawa'],
    tlds: ['ca'],
    phoneCode: '+1',
  },
  {
    name: 'Mexico',
    code: 'MX',
    flag: '🇲🇽',
    region: 'North America',
    subregion: 'Central America',
    techHubs: ['Mexico City', 'Guadalajara', 'Monterrey'],
    tlds: ['mx', 'com.mx'],
    phoneCode: '+52',
  },

  // --- South America ---
  {
    name: 'Brazil',
    code: 'BR',
    flag: '🇧🇷',
    region: 'South America',
    subregion: 'South America',
    techHubs: ['Sao Paulo', 'Rio de Janeiro', 'Florianopolis', 'Belo Horizonte'],
    tlds: ['br', 'com.br'],
    phoneCode: '+55',
  },
  {
    name: 'Colombia',
    code: 'CO',
    flag: '🇨🇴',
    region: 'South America',
    subregion: 'South America',
    techHubs: ['Bogota', 'Medellin'],
    tlds: ['co', 'com.co'],
    phoneCode: '+57',
  },
  {
    name: 'Argentina',
    code: 'AR',
    flag: '🇦🇷',
    region: 'South America',
    subregion: 'South America',
    techHubs: ['Buenos Aires', 'Cordoba'],
    tlds: ['ar', 'com.ar'],
    phoneCode: '+54',
  },
  {
    name: 'Chile',
    code: 'CL',
    flag: '🇨🇱',
    region: 'South America',
    subregion: 'South America',
    techHubs: ['Santiago'],
    tlds: ['cl'],
    phoneCode: '+56',
  },
  {
    name: 'Peru',
    code: 'PE',
    flag: '🇵🇪',
    region: 'South America',
    subregion: 'South America',
    techHubs: ['Lima'],
    tlds: ['pe'],
    phoneCode: '+51',
  },
  {
    name: 'Uruguay',
    code: 'UY',
    flag: '🇺🇾',
    region: 'South America',
    subregion: 'South America',
    techHubs: ['Montevideo'],
    tlds: ['uy'],
    phoneCode: '+598',
  },
];

export const REGION_PRESETS: RegionPreset[] = [
  {
    id: 'asia',
    name: 'Asia',
    icon: '🌏',
    description: 'Tech ecosystems across South, East, and Southeast Asia',
    countryNames: ['India', 'China', 'Japan', 'Singapore', 'South Korea', 'Indonesia', 'Malaysia', 'Thailand', 'Vietnam', 'Taiwan', 'Philippines', 'Pakistan', 'Bangladesh', 'Sri Lanka'],
  },
  {
    id: 'europe',
    name: 'Europe',
    icon: '🌍',
    description: 'UK, EU, Nordics, and Switzerland venture ecosystems',
    countryNames: ['United Kingdom', 'Germany', 'France', 'Netherlands', 'Switzerland', 'Spain', 'Italy', 'Sweden', 'Finland', 'Norway', 'Denmark', 'Estonia', 'Ireland', 'Belgium', 'Austria', 'Poland', 'Portugal', 'Romania', 'Czech Republic'],
  },
  {
    id: 'south_asia',
    name: 'South Asia',
    icon: '🌏',
    description: 'India, Pakistan, Bangladesh, Sri Lanka, and Nepal',
    countryNames: ['India', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal'],
  },
  {
    id: 'southeast_asia',
    name: 'Southeast Asia',
    icon: '🌏',
    description: 'Singapore, Indonesia, Malaysia, Thailand, Vietnam, Philippines',
    countryNames: ['Singapore', 'Indonesia', 'Malaysia', 'Thailand', 'Vietnam', 'Philippines'],
  },
  {
    id: 'east_asia',
    name: 'East Asia',
    icon: '🌏',
    description: 'China, Japan, South Korea, Taiwan, Hong Kong',
    countryNames: ['China', 'Japan', 'South Korea', 'Taiwan', 'Hong Kong'],
  },
  {
    id: 'middle_east',
    name: 'Middle East',
    icon: '🌏',
    description: 'UAE, Saudi Arabia, Israel, Qatar, and Gulf region',
    countryNames: ['United Arab Emirates', 'Saudi Arabia', 'Israel', 'Qatar', 'Bahrain', 'Kuwait', 'Oman', 'Jordan', 'Turkey'],
  },
  {
    id: 'oceania',
    name: 'Oceania',
    icon: '🌏',
    description: 'Australia and New Zealand tech platforms',
    countryNames: ['Australia', 'New Zealand'],
  },
  {
    id: 'africa',
    name: 'Africa',
    icon: '🌍',
    description: 'South Africa, Nigeria, Kenya, Egypt, Ghana, Rwanda',
    countryNames: ['South Africa', 'Nigeria', 'Kenya', 'Egypt', 'Ghana', 'Morocco', 'Rwanda'],
  },
  {
    id: 'north_america',
    name: 'North America',
    icon: '🌎',
    description: 'Canada, Mexico, and United States',
    countryNames: ['Canada', 'Mexico', 'United States'],
  },
  {
    id: 'south_america',
    name: 'South America',
    icon: '🌎',
    description: 'Brazil, Colombia, Argentina, Chile, Peru, Uruguay',
    countryNames: ['Brazil', 'Colombia', 'Argentina', 'Chile', 'Peru', 'Uruguay'],
  },
  {
    id: 'global',
    name: 'Global',
    icon: '🌐',
    description: 'Worldwide discovery across all tech hubs',
    countryNames: COUNTRIES.map(c => c.name),
  },
];

/**
 * Fast search helper: matches name prefix or substring, code, or tech hubs
 */
export function searchCountries(query: string): CountryItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return COUNTRIES.slice(0, 30);

  return COUNTRIES.filter(c => {
    return (
      c.name.toLowerCase().startsWith(q) ||
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase() === q ||
      c.techHubs.some(hub => hub.toLowerCase().includes(q))
    );
  });
}

/**
 * Find country by name or code (case-insensitive)
 */
export function findCountry(nameOrCode: string): CountryItem | undefined {
  const norm = nameOrCode.trim().toLowerCase();
  return COUNTRIES.find(
    c => c.name.toLowerCase() === norm || c.code.toLowerCase() === norm
  );
}

/**
 * Get country names for a given region preset ID
 */
export function getCountriesForRegion(regionId: string): string[] {
  const preset = REGION_PRESETS.find(p => p.id.toLowerCase() === regionId.toLowerCase());
  return preset ? preset.countryNames : [];
}

/**
 * Detect country from company evidence (text snippets, address, cities, TLDs)
 */
export function detectCountryFromEvidence(
  evidenceText: string | null,
  websiteUrl: string
): CountryItem | null {
  const text = (evidenceText || '').toLowerCase();

  // 1. TLD check
  try {
    const domain = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`).hostname;
    const parts = domain.split('.');
    const tld = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
    const twoPartTld = parts.length > 2 ? `${parts[parts.length - 2]}.${parts[parts.length - 1]}`.toLowerCase() : '';

    const matchedByTld = COUNTRIES.find(c => c.tlds.includes(twoPartTld) || c.tlds.includes(tld));
    if (matchedByTld && matchedByTld.code !== 'US') {
      return matchedByTld;
    }
  } catch {}

  // 2. Direct Country Name Match
  for (const country of COUNTRIES) {
    const regex = new RegExp(`\\b(${country.name.toLowerCase()})\\b`, 'i');
    if (regex.test(text)) {
      return country;
    }
  }

  // 3. Tech Hub / City Match
  for (const country of COUNTRIES) {
    for (const hub of country.techHubs) {
      const regex = new RegExp(`\\b(${hub.toLowerCase()})\\b`, 'i');
      if (regex.test(text)) {
        return country;
      }
    }
  }

  // 4. Phone Code Match
  for (const country of COUNTRIES) {
    if (country.phoneCode && text.includes(country.phoneCode)) {
      return country;
    }
  }

  return null;
}
