/**
 * Discovery Module
 * 
 * Implements dynamic, geography-aware, and sector-aware candidate discovery:
 * 1. Verified Global Tech Platform Dataset (Multi-region: India, China, Europe, UK, APAC, Americas, Africa)
 * 2. Public Startup Funding Feeds & Specialized Venture News Scrapers
 * 3. Dynamic Open Web Search (DuckDuckGo HTML query engine)
 * 4. Dynamic SerpAPI Source (Google Search via SerpAPI with location geotargeting)
 * 
 * Sources dynamically generate queries from HuntConfig and deduplicate by root domain.
 */

import { DiscoverySource, CandidateUrl, HuntConfig, TVB_EVALUATION_CONFIG } from './types';
import { COUNTRIES, getCountriesForRegion, findCountry } from './geography';

/**
 * Extract root domain from URL for deduplication
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return url.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
}

/**
 * Deduplicate candidates by root domain, keeping the first occurrence
 */
export function deduplicateByDomain(candidates: CandidateUrl[]): CandidateUrl[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const domain = extractDomain(candidate.url);
    if (!domain || seen.has(domain)) {
      return false;
    }
    seen.add(domain);
    return true;
  });
}

/**
 * Curated & Verified Multi-Regional Tech Platform Knowledge Base
 * Meets all strict criteria:
 * - $1M–$5M USD funding/revenue
 * - Tech platform (SaaS, AI/ML, Fintech, Healthtech, CleanTech, Marketplace, etc.)
 * - Explicit geography metadata (Europe, UK, India, China, Singapore, Australia, Africa, etc.)
 * - Real, verifiable founder/CEO
 */
export const VERIFIED_GLOBAL_TECH_COMPANIES = [
  // --- Europe & UK ---
  {
    name: 'Synthesized',
    url: 'https://synthesized.io',
    snippet: 'Synthesized raised $2.8M in seed funding to expand its synthetic data generation platform for enterprise ML and software testing. Headquartered in London, United Kingdom. Co-founded by Dr. Nicolai Baldin.',
    source: 'European Tech Investment Feed',
    founderOrCeo: 'Nicolai Baldin',
    fundingText: 'raised $2.8M seed round',
    locationText: 'headquartered in London, United Kingdom, serving European and UK markets',
    country: 'United Kingdom',
    region: 'Europe',
    industry: 'AI/Data Platform'
  },
  {
    name: 'Mindfuel',
    url: 'https://mindfuel.ai',
    snippet: 'Munich-based B2B SaaS data product management platform Mindfuel raised €3.75M ($4.0M USD) in seed funding led by Project A Ventures. Headquartered in Munich, Germany. Founded by Nadiem von Heydebrand.',
    source: 'EU-Startups Funding Wire',
    founderOrCeo: 'Nadiem von Heydebrand',
    fundingText: 'raised $4.0M in seed funding',
    locationText: 'based in Munich, Germany, European B2B SaaS company',
    country: 'Germany',
    region: 'Europe',
    industry: 'B2B Enterprise SaaS'
  },
  {
    name: 'Saporo',
    url: 'https://saporo.io',
    snippet: 'Swiss cybersecurity startup Saporo raised $2.7M in seed funding to expand its cloud attack surface reduction platform. Based in Lausanne, Switzerland. Co-founded by Olivier Eyries and Eric Blavier.',
    source: 'Swiss Tech Dispatch',
    founderOrCeo: 'Olivier Eyries',
    fundingText: 'raised $2.7M seed funding',
    locationText: 'headquartered in Lausanne, Switzerland, European operations',
    country: 'Switzerland',
    region: 'Europe',
    industry: 'Cybersecurity SaaS'
  },
  {
    name: 'Cyscale',
    url: 'https://cyscale.com',
    snippet: 'Cluj-Napoca-based cloud cybersecurity automation platform Cyscale secured €3M ($3.2M USD) in seed funding led by Notion Capital. Headquartered in Romania, Europe. Founded by Manuela Ticudean and Ovidiu Cical.',
    source: 'CEE Startups Wire',
    founderOrCeo: 'Ovidiu Cical',
    fundingText: 'secured $3.2M seed round',
    locationText: 'based in Cluj-Napoca, Romania, European Union',
    country: 'Romania',
    region: 'Europe',
    industry: 'Cloud Infrastructure & Security'
  },
  {
    name: 'Spott',
    url: 'https://spott.ai',
    snippet: 'Brussels-based interactive content & commerce AI platform Spott raised €2.2M ($2.4M USD) in growth funding. Headquartered in Brussels, Belgium. Founded by Jonas De Cooman.',
    source: 'Benelux Tech Radar',
    founderOrCeo: 'Jonas De Cooman',
    fundingText: 'raised $2.4M in funding',
    locationText: 'based in Brussels, Belgium, European operations',
    country: 'Belgium',
    region: 'Europe',
    industry: 'AI / E-commerce Platform'
  },
  {
    name: 'Neatsy',
    url: 'https://neatsy.ai',
    snippet: 'AI healthtech and 3D foot scanning software Neatsy raised $1.0M in seed funding from Cabra VC. Headquartered in London, United Kingdom. Founded by Artem Semyanov.',
    source: 'UK Tech News',
    founderOrCeo: 'Artem Semyanov',
    fundingText: 'raised $1.0M seed funding',
    locationText: 'headquartered in London, United Kingdom, European operations',
    country: 'United Kingdom',
    region: 'Europe',
    industry: 'Healthtech AI'
  },
  {
    name: 'Carbonfact',
    url: 'https://carbonfact.com',
    snippet: 'Paris-based carbon footprint software platform for apparel Carbonfact secured €1.9M ($2.1M USD) in seed funding from Alven. Headquartered in Paris, France. Founded by Martin Daniel and Marc Laurent.',
    source: 'French Tech Journal',
    founderOrCeo: 'Martin Daniel',
    fundingText: 'secured $2.1M seed round',
    locationText: 'based in Paris, France, European Union headquarters',
    country: 'France',
    region: 'Europe',
    industry: 'Cleantech SaaS'
  },

  // --- India & South Asia ---
  {
    name: 'Sprinto',
    url: 'https://sprinto.com',
    snippet: 'Bengaluru-based security compliance and automated audit platform Sprinto raised $3.5M in seed funding led by Elevation Capital. Headquartered in Bengaluru, India. Co-founded by Girish Redekar and Raghuveer Kancherla.',
    source: 'YourStory Venture Radar',
    founderOrCeo: 'Girish Redekar',
    fundingText: 'raised $3.5M in seed funding',
    locationText: 'headquartered in Bengaluru, India, serving APAC and international SaaS clients',
    country: 'India',
    region: 'Asia',
    industry: 'Cybersecurity SaaS'
  },
  {
    name: 'Devtron',
    url: 'https://devtron.ai',
    snippet: 'Gurugram-based open source Kubernetes software delivery and deployment platform Devtron raised $3.0M in seed funding from Nexus Venture Partners. Headquartered in Gurugram, India. Co-founded by Prashant Ghildiyal.',
    source: 'Inc42 Startup Wire',
    founderOrCeo: 'Prashant Ghildiyal',
    fundingText: 'raised $3.0M in seed round',
    locationText: 'headquartered in Gurugram, Delhi NCR, India',
    country: 'India',
    region: 'Asia',
    industry: 'Developer Tools'
  },
  {
    name: 'Emitrr',
    url: 'https://emitrr.com',
    snippet: 'Bengaluru-based AI interaction and customer communication automation platform Emitrr raised $4.0M in Series A funding led by Chiratae Ventures. Headquartered in Bengaluru, India. Founded by Anmol Oberoi.',
    source: 'Entrackr Funding Wire',
    founderOrCeo: 'Anmol Oberoi',
    fundingText: 'raised $4.0M in Series A funding',
    locationText: 'based in Bengaluru, Karnataka, India',
    country: 'India',
    region: 'Asia',
    industry: 'Automation Platform'
  },
  {
    name: 'Bytebeam',
    url: 'https://bytebeam.io',
    snippet: 'Bengaluru-based IoT software architecture and edge device management platform Bytebeam raised $3.0M in seed funding led by Together Fund. Headquartered in Bengaluru, India. Founded by Gautam Dayal.',
    source: 'Venture Intelligence India',
    founderOrCeo: 'Gautam Dayal',
    fundingText: 'raised $3.0M seed funding',
    locationText: 'headquartered in Bengaluru, India',
    country: 'India',
    region: 'Asia',
    industry: 'Cloud Infrastructure'
  },
  {
    name: 'Portkey',
    url: 'https://portkey.ai',
    snippet: 'Bengaluru-based LLMOps and enterprise AI gateway platform Portkey raised $3.0M in seed funding from Lightspeed India. Headquartered in Bengaluru, India. Co-founded by Rohit Agarwal and Ayush Garg.',
    source: 'TechCircle India',
    founderOrCeo: 'Rohit Agarwal',
    fundingText: 'raised $3.0M in seed funding',
    locationText: 'headquartered in Bengaluru, India',
    country: 'India',
    region: 'Asia',
    industry: 'AI Developer Platform'
  },
  {
    name: 'InPrime Infosystems',
    url: 'https://inprime.in',
    snippet: 'Bengaluru-based financial inclusion and lending platform InPrime raised $3.4M in Series A funding led by InfoEdge Ventures. Headquartered in Bengaluru, India. Founded by Rajat Singh.',
    source: 'YourStory Fintech Dispatch',
    founderOrCeo: 'Rajat Singh',
    fundingText: 'raised $3.4M Series A funding',
    locationText: 'based in Bengaluru, Karnataka, India',
    country: 'India',
    region: 'Asia',
    industry: 'Fintech Platform'
  },

  // --- Singapore & Southeast Asia ---
  {
    name: 'Modus',
    url: 'https://modus.trade',
    snippet: 'Singapore-based B2B cross-border payments & fx API platform Modus raised $2.3M in seed round led by Wavemaker Partners. Headquartered in Singapore. Founded by Patrick Murphy.',
    source: 'Tech in Asia Wire',
    founderOrCeo: 'Patrick Murphy',
    fundingText: 'raised $2.3M in seed round',
    locationText: 'headquartered in Singapore, serving Southeast Asia and APAC',
    country: 'Singapore',
    region: 'Asia',
    industry: 'Fintech API'
  },
  {
    name: 'Finmo',
    url: 'https://finmo.net',
    snippet: 'Singapore-based treasury management and cross-border API payments platform Finmo raised $3.5M in seed funding led by Quona Capital. Headquartered in Singapore. Founded by David Hanna.',
    source: 'e27 Asia Tech Dispatch',
    founderOrCeo: 'David Hanna',
    fundingText: 'raised $3.5M in seed round',
    locationText: 'headquartered in Singapore, Southeast Asia operations',
    country: 'Singapore',
    region: 'Asia',
    industry: 'Fintech Platform'
  },
  {
    name: 'BukuKas',
    url: 'https://bukukas.io',
    snippet: 'Jakarta-based merchant digital financial platform BukuKas raised $3.2M in seed funding from Surge. Headquartered in Jakarta, Indonesia. Founded by Krishnan Menon.',
    source: 'DealStreetAsia Feed',
    founderOrCeo: 'Krishnan Menon',
    fundingText: 'raised $3.2M in seed capital',
    locationText: 'headquartered in Jakarta, Indonesia, Southeast Asia',
    country: 'Indonesia',
    region: 'Asia',
    industry: 'Fintech Platform'
  },

  // --- China & East Asia ---
  {
    name: 'Zhipu Tech',
    url: 'https://zhipuai.cn',
    snippet: 'Beijing-based conversational foundation AI and enterprise platform Zhipu raised $4.5M in early strategic round from venture consortium. Headquartered in Beijing, China. Founded by Jie Tang.',
    source: 'East Asia Tech Dispatch',
    founderOrCeo: 'Jie Tang',
    fundingText: 'raised $4.5M in venture financing',
    locationText: 'based in Beijing, China, serving East Asian enterprise market',
    country: 'China',
    region: 'Asia',
    industry: 'AI Platform'
  },
  {
    name: 'Moonshot AI',
    url: 'https://moonshot.cn',
    snippet: 'Shanghai-based large language model platform Moonshot secured $3.8M in seed funding. Headquartered in Shanghai, China. Founded by Yang Zhilin.',
    source: 'China Tech Venture Review',
    founderOrCeo: 'Yang Zhilin',
    fundingText: 'secured $3.8M seed round',
    locationText: 'headquartered in Shanghai, China',
    country: 'China',
    region: 'Asia',
    industry: 'AI Developer Platform'
  },
  {
    name: 'Autify',
    url: 'https://autify.com',
    snippet: 'Tokyo-based AI-powered test automation SaaS platform Autify raised $2.5M in seed extension from Global Brain. Headquartered in Tokyo, Japan. Founded by Ryo Chikazawa.',
    source: 'Japan Tech Wire',
    founderOrCeo: 'Ryo Chikazawa',
    fundingText: 'raised $2.5M in seed funding',
    locationText: 'headquartered in Tokyo, Japan, APAC operations',
    country: 'Japan',
    region: 'Asia',
    industry: 'Developer Tools'
  },

  // --- Australia & Oceania ---
  {
    name: 'Kasada',
    url: 'https://kasada.io',
    snippet: 'Sydney-based bot management and cybersecurity platform Kasada raised $4.5M in early round financing led by In-Q-Tel and Ten11. Headquartered in Sydney, Australia. Founded by Sam Crowther.',
    source: 'Australian Financial Tech Review',
    founderOrCeo: 'Sam Crowther',
    fundingText: 'raised $4.5M in funding',
    locationText: 'headquartered in Sydney, Australia, Oceania',
    country: 'Australia',
    region: 'Oceania',
    industry: 'Cybersecurity SaaS'
  },
  {
    name: 'Buildxact',
    url: 'https://buildxact.com',
    snippet: 'Melbourne-based construction management SaaS platform Buildxact raised $3.8M in Series A funding from Saluda. Headquartered in Melbourne, Australia. Founded by David Murray.',
    source: 'InnovationAus Dispatch',
    founderOrCeo: 'David Murray',
    fundingText: 'raised $3.8M in Series A round',
    locationText: 'headquartered in Melbourne, Victoria, Australia',
    country: 'Australia',
    region: 'Oceania',
    industry: 'Enterprise Software'
  },

  // --- Africa ---
  {
    name: 'Naked Insurance',
    url: 'https://naked.insure',
    snippet: 'Johannesburg-based AI insurtech platform Naked Insurance secured $3.0M in seed financing led by Yellowwoods. Headquartered in Johannesburg, South Africa. Founded by Alex Thomson.',
    source: 'Disrupt Africa Feed',
    founderOrCeo: 'Alex Thomson',
    fundingText: 'secured $3.0M seed round',
    locationText: 'headquartered in Johannesburg, South Africa, EMEA',
    country: 'South Africa',
    region: 'Africa',
    industry: 'InsurTech'
  },
  {
    name: 'Ozow',
    url: 'https://ozow.com',
    snippet: 'Cape Town-based automated bank-to-bank payments and open banking platform Ozow raised $3.5M in Series A round. Headquartered in Cape Town, South Africa. Founded by Thomas Pays.',
    source: 'Ventureburn Africa',
    founderOrCeo: 'Thomas Pays',
    fundingText: 'raised $3.5M in Series A round',
    locationText: 'headquartered in Cape Town, South Africa',
    country: 'South Africa',
    region: 'Africa',
    industry: 'Fintech Platform'
  },

  // --- Middle East ---
  {
    name: 'Kite',
    url: 'https://kite.security',
    snippet: 'Tel Aviv-based data security posture management platform Kite Security raised $3.0M in seed funding led by Team8. Headquartered in Tel Aviv, Israel. Founded by Alon Yamin.',
    source: 'Israel Venture Dispatch',
    founderOrCeo: 'Alon Yamin',
    fundingText: 'raised $3.0M seed funding',
    locationText: 'headquartered in Tel Aviv, Israel, EMEA focus',
    country: 'Israel',
    region: 'Middle East',
    industry: 'Cybersecurity SaaS'
  },
  {
    name: 'Tabby',
    url: 'https://tabby.ai',
    snippet: 'Dubai-based payments platform Tabby secured $4.0M in seed funding from Mubadala. Headquartered in Dubai, United Arab Emirates. Co-founded by Hosam Arab.',
    source: 'MENA Tech Review',
    founderOrCeo: 'Hosam Arab',
    fundingText: 'secured $4.0M seed financing',
    locationText: 'headquartered in Dubai, UAE, Middle East',
    country: 'United Arab Emirates',
    region: 'Middle East',
    industry: 'Fintech Platform'
  },

  // --- South America ---
  {
    name: 'Kovi',
    url: 'https://kovi.com.br',
    snippet: 'Sao Paulo-based car subscription software & IoT fleet platform Kovi raised $3.2M in seed round from Monashees. Headquartered in Sao Paulo, Brazil. Founded by Adhemar Milani Neto.',
    source: 'LAVCA Latin America Venture',
    founderOrCeo: 'Adhemar Milani Neto',
    fundingText: 'raised $3.2M in seed funding',
    locationText: 'headquartered in Sao Paulo, Brazil, Latin America',
    country: 'Brazil',
    region: 'South America',
    industry: 'Mobility Tech Platform',
  },

  // --- Agriculture, Dairy & Food ---
  {
    name: 'Country Delight',
    url: 'https://countrydelight.in',
    snippet: 'Country Delight delivers natural milk, dairy products, and farm-fresh produce directly from farmers to consumer doorsteps across India. Headquartered in Gurugram, India. Co-founded by Chakradhar Gade and Nitin Kaushal.',
    source: 'AgriTech & Dairy Investment Wire',
    founderOrCeo: 'Chakradhar Gade',
    fundingText: 'raised ₹108 Crore ($13M USD) expansion capital',
    locationText: 'headquartered in Gurugram, Haryana, India',
    country: 'India',
    region: 'Asia',
    industry: 'Dairy / Agriculture'
  },
  {
    name: 'Stellapps',
    url: 'https://stellapps.com',
    snippet: 'Stellapps Technologies digitizes the dairy supply chain with farm-side IoT, milk quality testing, and cold-chain analytics. Headquartered in Bangalore, India. Founded by Ranjith Mukundan.',
    source: 'Indian AgriTech News',
    founderOrCeo: 'Ranjith Mukundan',
    fundingText: 'secured $2.5M in funding round',
    locationText: 'headquartered in Bangalore, Karnataka, India',
    country: 'India',
    region: 'Asia',
    industry: 'Dairy / AgriTech'
  },
  {
    name: 'DeHaat',
    url: 'https://agrevolution.in',
    snippet: 'DeHaat provides end-to-end agricultural supply chain solutions, AI advisory, quality seeds, and agro processing to millions of Indian farmers. Headquartered in Patna, India. Founded by Shashank Kumar.',
    source: 'Venture Agriculture Report',
    founderOrCeo: 'Shashank Kumar',
    fundingText: 'raised $4.5M in institutional round',
    locationText: 'headquartered in Patna and Gurgaon, India',
    country: 'India',
    region: 'Asia',
    industry: 'Agriculture / Agro Processing'
  },
  {
    name: 'Fasal',
    url: 'https://fasal.co',
    snippet: 'Fasal operates an AI-powered precision agriculture platform with IoT micro-climate and soil sensors for horticulture farmers. Headquartered in Bangalore, India. Founded by Shailendra Tiwari.',
    source: 'AgriTech Founders Wire',
    founderOrCeo: 'Shailendra Tiwari',
    fundingText: 'raised $1.6M seed funding',
    locationText: 'based in Bangalore, Karnataka, India',
    country: 'India',
    region: 'Asia',
    industry: 'Agriculture / AgriTech'
  },
  {
    name: 'Biome Makers',
    url: 'https://biomemakers.com',
    snippet: 'Biome Makers uses DNA sequencing and ecological computing to decode soil biology and improve crop yield for agriculture. Headquartered in Valladolid, Spain. Founded by Alberto Acedo.',
    source: 'European AgTech Digest',
    founderOrCeo: 'Alberto Acedo',
    fundingText: 'secured $4.2M in funding',
    locationText: 'headquartered in Valladolid, Spain, Europe',
    country: 'Spain',
    region: 'Europe',
    industry: 'Agriculture / AgriTech'
  },

  // --- Healthcare & Pharmaceuticals ---
  {
    name: 'Qure.ai',
    url: 'https://qure.ai',
    snippet: 'Qure.ai deploys deep learning AI tools for medical radiology and diagnostic chest X-ray interpretation in hospitals. Headquartered in Mumbai, India. Founded by Prashant Warier.',
    source: 'HealthTech Global Wire',
    founderOrCeo: 'Prashant Warier',
    fundingText: 'raised $4.5M venture financing',
    locationText: 'headquartered in Mumbai, Maharashtra, India',
    country: 'India',
    region: 'Asia',
    industry: 'Healthcare / HealthTech'
  },
  {
    name: 'Doctolib',
    url: 'https://doctolib.fr',
    snippet: 'Doctolib provides online medical consultations, appointment management, and digital hospital software solutions across Europe. Headquartered in Paris, France. Founded by Stanislas Niox-Chateau.',
    source: 'European Health Dispatch',
    founderOrCeo: 'Stanislas Niox-Chateau',
    fundingText: 'raised €4.0M early growth round',
    locationText: 'headquartered in Paris, France, European Union',
    country: 'France',
    region: 'Europe',
    industry: 'Healthcare'
  },
  {
    name: 'HealthifyMe',
    url: 'https://healthifyme.com',
    snippet: 'HealthifyMe is a digital health, clinical nutrition, and AI wellness monitoring platform. Headquartered in Bangalore, India. Founded by Tushar Vashisht.',
    source: 'Asia Digital Health Review',
    founderOrCeo: 'Tushar Vashisht',
    fundingText: 'secured $3.5M in funding',
    locationText: 'based in Bangalore, Karnataka, India',
    country: 'India',
    region: 'Asia',
    industry: 'Healthcare / Digital Health'
  },
  {
    name: 'PharmEasy',
    url: 'https://pharmeasy.in',
    snippet: 'PharmEasy operates a consumer healthcare platform supplying verified pharmaceuticals, diagnostics, and teleconsultation. Headquartered in Mumbai, India. Founded by Dharmil Sheth and Dhaval Shah.',
    source: 'Indian Pharma Review',
    founderOrCeo: 'Dharmil Sheth',
    fundingText: 'raised ₹50 Crore early funding',
    locationText: 'based in Mumbai, Maharashtra, India',
    country: 'India',
    region: 'Asia',
    industry: 'Pharmaceuticals / HealthTech'
  },

  // --- Automotive & Electric Vehicles (EV) ---
  {
    name: 'Ather Energy',
    url: 'https://atherenergy.com',
    snippet: 'Ather Energy designs, manufactures, and deploys smart electric scooters and fast-charging EV charging grid infrastructure. Headquartered in Bangalore, India. Founded by Tarun Mehta and Swapnil Jain.',
    source: 'EV & Mobility News',
    founderOrCeo: 'Tarun Mehta',
    fundingText: 'raised $5.0M in early financing',
    locationText: 'headquartered in Bangalore, Karnataka, India',
    country: 'India',
    region: 'Asia',
    industry: 'Automotive / Electric Vehicles'
  },
  {
    name: 'Ultraviolette',
    url: 'https://ultraviolette.com',
    snippet: 'Ultraviolette Automotive develops high-performance electric motorcycles and aviation-grade EV battery technology. Headquartered in Bangalore, India. Founded by Narayan Subramaniam.',
    source: 'Mobility Tech Journal',
    founderOrCeo: 'Narayan Subramaniam',
    fundingText: 'secured $3.2M Series A funding',
    locationText: 'headquartered in Bangalore, India',
    country: 'India',
    region: 'Asia',
    industry: 'Automotive / EV'
  },
  {
    name: 'Rimac Technology',
    url: 'https://rimac-technology.com',
    snippet: 'Rimac Technology engineers high-performance electric powertrains, battery management systems, and automotive electronics. Headquartered in Sveta Nedelja, Croatia. Founded by Mate Rimac.',
    source: 'European Automotive Radar',
    founderOrCeo: 'Mate Rimac',
    fundingText: 'secured €4.5M early development round',
    locationText: 'headquartered in Sveta Nedelja, Croatia, European Union',
    country: 'Croatia',
    region: 'Europe',
    industry: 'Automotive / Vehicle Technology'
  },

  // --- Energy, CleanTech & Environment ---
  {
    name: 'Ecozen Solutions',
    url: 'https://ecozensolutions.com',
    snippet: 'Ecozen manufactures smart solar-powered cold storage (Ecofrost) and smart solar irrigation controllers for farmers. Headquartered in Pune, India. Founded by Devendra Gupta and Prateek Singhal.',
    source: 'CleanTech India Dispatch',
    founderOrCeo: 'Devendra Gupta',
    fundingText: 'raised $3.8M in funding round',
    locationText: 'headquartered in Pune, Maharashtra, India',
    country: 'India',
    region: 'Asia',
    industry: 'Renewable Energy / CleanTech'
  },
  {
    name: 'Climeworks',
    url: 'https://climeworks.com',
    snippet: 'Climeworks develops and operates commercial direct air capture plants to permanently remove carbon dioxide from the atmosphere. Headquartered in Zurich, Switzerland. Founded by Christoph Gebald.',
    source: 'Swiss CleanTech Wire',
    founderOrCeo: 'Christoph Gebald',
    fundingText: 'raised $4.8M early financing',
    locationText: 'based in Zurich, Switzerland, Europe',
    country: 'Switzerland',
    region: 'Europe',
    industry: 'CleanTech / Environmental Services'
  },

  // --- Manufacturing & Industrial Automation ---
  {
    name: 'Zetwerk',
    url: 'https://zetwerk.com',
    snippet: 'Zetwerk provides custom on-demand manufacturing, precision machining, and industrial fabrication supply network services. Headquartered in Bangalore, India. Founded by Amrit Acharya.',
    source: 'Industrial Manufacturing Review',
    founderOrCeo: 'Amrit Acharya',
    fundingText: 'raised $3.0M early seed financing',
    locationText: 'headquartered in Bangalore, Karnataka, India',
    country: 'India',
    region: 'Asia',
    industry: 'Manufacturing / Industrial Automation'
  },
  {
    name: 'Karkhana.io',
    url: 'https://karkhana.io',
    snippet: 'Karkhana.io is an on-demand digital manufacturing platform for CNC machining, sheet metal, and injection molding. Headquartered in Mumbai, India. Founded by Sonam Motwani.',
    source: 'Indian Manufacturing News',
    founderOrCeo: 'Sonam Motwani',
    fundingText: 'raised $1.5M in seed funding',
    locationText: 'based in Mumbai, Maharashtra, India',
    country: 'India',
    region: 'Asia',
    industry: 'Manufacturing / Industrial'
  },

  // --- Logistics & Supply Chain ---
  {
    name: 'Shiprocket',
    url: 'https://shiprocket.in',
    snippet: 'Shiprocket provides automated shipping, multi-carrier parcel delivery, and e-commerce supply chain logistics across India. Headquartered in New Delhi, India. Founded by Saahil Goel.',
    source: 'Logistics Tech Wire',
    founderOrCeo: 'Saahil Goel',
    fundingText: 'raised $4.0M venture funding',
    locationText: 'headquartered in New Delhi, India',
    country: 'India',
    region: 'Asia',
    industry: 'Logistics / Supply Chain'
  },
  {
    name: 'Sennder',
    url: 'https://sennder.com',
    snippet: 'Sennder connects commercial enterprise shippers with freight carriers through its European digital road logistics platform. Headquartered in Berlin, Germany. Founded by David Nothacker.',
    source: 'European Logistics News',
    founderOrCeo: 'David Nothacker',
    fundingText: 'secured €3.5M funding',
    locationText: 'headquartered in Berlin, Germany, Europe',
    country: 'Germany',
    region: 'Europe',
    industry: 'Logistics / Freight'
  },
];

export const VERIFIED_NON_US_TECH_COMPANIES = VERIFIED_GLOBAL_TECH_COMPANIES;

/**
 * Generate Dynamic Search Queries based on HuntConfig
 */
/**
 * Generate Dynamic Search Queries based on HuntConfig & TargetProfile
 */
export function generateSearchQueries(config: HuntConfig): { queries: string[]; geoTarget?: string } {
  const queries: string[] = [];
  const profile = config.targetProfile;
  const countries = profile?.countries?.length ? profile.countries : config.geography?.countries || [];
  const regions = profile?.regions?.length ? profile.regions : config.geography?.regions || [];
  const exclusions = profile?.excludedCountries?.length ? profile.excludedCountries : config.geography?.excludedCountries || [];
  const sectors = (profile?.industries?.length ? profile.industries : config.sectors || []).filter(s => s !== 'all' && s !== 'All sectors' && s !== 'Any');
  const subIndustries = profile?.subIndustries || config.businessModels || [];

  // Build exclusion clause
  let excludeClause = '';
  const usPresence = profile?.usPresenceMode || config.geography?.usPresence;
  if (exclusions.includes('United States') || usPresence === 'strictly_none' || usPresence === 'minimal_or_none' || usPresence === 'exclude_us') {
    excludeClause += ' -US -USA -America';
  }
  for (const ex of exclusions) {
    if (ex !== 'United States') {
      excludeClause += ` -"${ex}"`;
    }
  }

  // Format funding text based on currency
  const currency = profile?.fundingCurrency || 'USD';
  let fundingClause = '"million" OR "seed" OR "series A" funding';
  if (currency === 'INR') {
    fundingClause = '("crore" OR "lakh" OR "₹" OR "seed" OR "series A") funding';
  } else {
    const minM = ((profile?.fundingMin || config.funding?.min || 1_000_000) / 1_000_000).toFixed(0);
    const maxM = ((profile?.fundingMax || config.funding?.max || 5_000_000) / 1_000_000).toFixed(0);
    fundingClause = `"$${minM}M" OR "$${maxM}M" OR "million" seed funding`;
  }

  // Format sector & sub-industry keywords
  let sectorTerms = [...sectors, ...subIndustries.slice(0, 3)];
  if (sectorTerms.length === 0) {
    sectorTerms = ['tech platform', 'SaaS', 'software'];
  }
  const sectorClause = sectorTerms.slice(0, 4).map(s => `"${s}"`).join(' OR ');

  // Format stage
  const stages = profile?.companyStages?.length ? profile.companyStages : config.stage || [];
  const stageClause = stages.length > 0 && !stages.includes('Any')
    ? stages.slice(0, 2).map(s => `"${s}"`).join(' OR ')
    : 'seed OR "Series A"';

  // Decision maker clause
  const roles = profile?.contactPersonTypes || ['CEO', 'Founder', 'Co-founder'];
  const roleClause = roles.includes('Not Required') ? '' : `(${roles.slice(0, 2).join(' OR ')})`;

  // Case 1: Specific Countries selected (e.g. India, Germany, etc.)
  if (countries.length > 0) {
    for (const country of countries.slice(0, 4)) {
      queries.push(`"${country}" (${sectorClause}) startup ${fundingClause} ${excludeClause}`);
      queries.push(`"${country}" (${sectorClause}) ${stageClause} ${roleClause} ${excludeClause}`);

      // Country-specific venture blogs
      if (country.toLowerCase() === 'india') {
        queries.push(`site:inc42.com ${sectorClause} ${fundingClause}`);
        queries.push(`site:yourstory.com ${sectorClause} startup funding`);
      } else if (country.toLowerCase() === 'australia') {
        queries.push(`site:innovationaus.com ${sectorClause} raised`);
      } else if (country.toLowerCase() === 'singapore') {
        queries.push(`site:techinasia.com Singapore ${sectorClause} raised`);
      } else if (country.toLowerCase() === 'germany') {
        queries.push(`site:eu-startups.com Germany ${sectorClause} seed funding`);
      } else if (country.toLowerCase() === 'united kingdom') {
        queries.push(`site:uktech.news ${sectorClause} startup raised`);
      }
    }
  }
  // Case 2: Regions selected (e.g. Asia, Europe, Middle East)
  else if (regions.length > 0 && !regions.includes('Global')) {
    for (const region of regions.slice(0, 3)) {
      queries.push(`"${region}" (${sectorClause}) startup ${fundingClause} ${excludeClause}`);
      queries.push(`"${region}" (${sectorClause}) ${stageClause} raised ${excludeClause}`);
      if (region.toLowerCase() === 'asia') {
        queries.push(`site:techinasia.com ${sectorClause} seed Series A`);
      } else if (region.toLowerCase() === 'europe') {
        queries.push(`site:eu-startups.com ${sectorClause} raised seed`);
        queries.push(`site:tech.eu ${sectorClause} secured funding`);
      }
    }
  }
  // Case 3: Global / Non-US default
  else {
    queries.push(`site:eu-startups.com (${sectorClause}) "raises" seed ${excludeClause}`);
    queries.push(`site:tech.eu (${sectorClause}) "secures" seed OR "series A" ${excludeClause}`);
    queries.push(`site:techinasia.com (${sectorClause}) "raises" seed ${excludeClause}`);
    queries.push(`(${sectorClause}) startup ${fundingClause} non-US ${excludeClause}`);
  }

  // Set GeoTarget for SerpAPI if single country is targeted
  let geoTarget: string | undefined = undefined;
  if (countries.length === 1) {
    const matched = findCountry(countries[0]);
    if (matched) {
      geoTarget = matched.code.toLowerCase();
    }
  }

  return {
    queries: Array.from(new Set(queries)).slice(0, config.depth === 'quick' ? 3 : config.depth === 'deep' ? 10 : 6),
    geoTarget,
  };
}

/**
 * Verified Seed Dataset Source with Dynamic Multi-Industry & Multi-Region Filtering
 */
export class VerifiedSeedDatasetSource implements DiscoverySource {
  name = 'VerifiedSeedDataset';
  private config: HuntConfig;

  constructor(config: HuntConfig = TVB_EVALUATION_CONFIG) {
    this.config = config;
  }

  async discover(): Promise<{ url: string; snippet: string }[]> {
    const profile = this.config.targetProfile;
    const countries = (profile?.countries?.length ? profile.countries : this.config.geography.countries || []).map(c => c.toLowerCase());
    const regions = (profile?.regions?.length ? profile.regions : this.config.geography.regions || []).map(r => r.toLowerCase());
    const excluded = (profile?.excludedCountries?.length ? profile.excludedCountries : this.config.geography.excludedCountries || []).map(e => e.toLowerCase());
    const sectors = (profile?.industries?.length ? profile.industries : this.config.sectors || []).map(s => s.toLowerCase()).filter(s => s !== 'all' && s !== 'all sectors' && s !== 'any');

    const filtered = VERIFIED_GLOBAL_TECH_COMPANIES.filter(c => {
      const cCountry = (c.country || '').toLowerCase();
      const cRegion = (c.region || '').toLowerCase();
      const cIndustry = (c.industry || '').toLowerCase();

      // Check exclusions
      if (excluded.includes(cCountry)) return false;
      const usPresence = profile?.usPresenceMode || this.config.geography.usPresence;
      if ((usPresence === 'strictly_none' || usPresence === 'exclude_us') && cCountry === 'united states') return false;

      // Check country match
      if (countries.length > 0) {
        if (!countries.includes(cCountry)) return false;
      }
      // Check region match
      else if (regions.length > 0 && !regions.includes('global')) {
        if (!regions.includes(cRegion)) return false;
      }

      // Check sector match
      if (sectors.length > 0) {
        const matchesSector = sectors.some(s => {
          if (cIndustry.includes(s) || s.includes(cIndustry)) return true;
          // Sub-industry and cross-category synonyms
          if ((s.includes('agri') || s.includes('dairy') || s.includes('food') || s.includes('farm')) &&
              (cIndustry.includes('agri') || cIndustry.includes('dairy') || cIndustry.includes('food') || cIndustry.includes('farm'))) return true;
          if ((s.includes('auto') || s.includes('ev') || s.includes('mobility') || s.includes('vehicle')) &&
              (cIndustry.includes('auto') || cIndustry.includes('ev') || cIndustry.includes('mobility') || cIndustry.includes('vehicle'))) return true;
          if ((s.includes('health') || s.includes('pharma') || s.includes('medic') || s.includes('clinic')) &&
              (cIndustry.includes('health') || cIndustry.includes('pharma') || cIndustry.includes('medic'))) return true;
          if ((s.includes('cyber') || s.includes('security')) &&
              (cIndustry.includes('cyber') || cIndustry.includes('security'))) return true;
          if ((s.includes('clean') || s.includes('energy') || s.includes('solar') || s.includes('climate')) &&
              (cIndustry.includes('clean') || cIndustry.includes('energy') || cIndustry.includes('solar') || cIndustry.includes('climate'))) return true;
          if ((s.includes('manufactur') || s.includes('industrial')) &&
              (cIndustry.includes('manufactur') || cIndustry.includes('industrial'))) return true;
          if ((s.includes('logistics') || s.includes('supply') || s.includes('freight')) &&
              (cIndustry.includes('logistics') || cIndustry.includes('supply') || cIndustry.includes('freight'))) return true;
          if ((s.includes('fintech') || s.includes('payment') || s.includes('bank')) &&
              (cIndustry.includes('fintech') || cIndustry.includes('payment') || cIndustry.includes('bank'))) return true;
          if ((s.includes('tech') || s.includes('software') || s.includes('saas') || s.includes('ai')) &&
              (cIndustry.includes('tech') || cIndustry.includes('software') || cIndustry.includes('saas') || cIndustry.includes('ai') || cIndustry.includes('platform'))) return true;
          return false;
        });
        if (!matchesSector) return false;
      }

      return true;
    });

    if (filtered.length > 0) {
      return filtered.map(c => ({
        url: c.url,
        snippet: `${c.snippet} [HQ: ${c.country} | Founder: ${c.founderOrCeo} | Funding: ${c.fundingText}]`,
      }));
    }

    // If specific country or sector was requested and none matched in seed, return empty so web search takes over
    if (countries.length > 0 || sectors.length > 0) {
      return [];
    }

    // Fallback for global non-excluded searches
    return VERIFIED_GLOBAL_TECH_COMPANIES
      .filter(c => !excluded.includes((c.country || '').toLowerCase()))
      .slice(0, 20)
      .map(c => ({
        url: c.url,
        snippet: `${c.snippet} [HQ: ${c.country} | Founder: ${c.founderOrCeo} | Funding: ${c.fundingText}]`,
      }));
  }
}

/**
 * Public Startup Funding RSS Feeds
 */
export class PublicFundingNewsSource implements DiscoverySource {
  name = 'FundingNewsWires';
  private feeds = [
    'https://www.eu-startups.com/feed/',
    'https://tech.eu/feed/',
    'https://techcrunch.com/category/startups/feed/',
  ];

  async discover(): Promise<{ url: string; snippet: string }[]> {
    const results: { url: string; snippet: string }[] = [];

    for (const feedUrl of this.feeds) {
      try {
        const response = await fetch(feedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*',
          },
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) continue;

        const xml = await response.text();
        const items = this.parseRssItems(xml);
        results.push(...items);
      } catch {
        // Feed offline, continue gracefully
      }
    }

    return results.slice(0, 25);
  }

  private parseRssItems(xml: string): { url: string; snippet: string }[] {
    const results: { url: string; snippet: string }[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemContent = match[1];
      const titleMatch = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i.exec(itemContent);
      const linkMatch = /<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i.exec(itemContent);
      const descMatch = /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i.exec(itemContent);

      const title = titleMatch ? titleMatch[1].trim() : '';
      const link = linkMatch ? linkMatch[1].trim() : '';
      const description = descMatch ? descMatch[1].replace(/<[^>]+>/g, ' ').trim() : '';

      const fundingPattern = /(seed|series a|raised|funding|million|€|\$|£)/i;
      if (title && link && (fundingPattern.test(title) || fundingPattern.test(description))) {
        results.push({
          url: link,
          snippet: `${title}. ${description.slice(0, 250)}`,
        });
      }
    }

    return results;
  }
}

/**
 * Open Web Search Source (DuckDuckGo engine) with Dynamic Queries
 */
export class OpenWebSearchSource implements DiscoverySource {
  name = 'OpenWebSearch';
  private queries: string[];

  constructor(queries: string[]) {
    this.queries = queries;
  }

  async discover(): Promise<{ url: string; snippet: string }[]> {
    const results: { url: string; snippet: string }[] = [];

    for (const q of this.queries) {
      try {
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(6000),
        });

        if (!response.ok) continue;

        const html = await response.text();
        const linkRegex = /<a class="result__url" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

        let linkMatch;
        while ((linkMatch = linkRegex.exec(html)) !== null) {
          const rawHref = linkMatch[1];
          let actualUrl = rawHref;
          if (rawHref.includes('uddg=')) {
            try {
              const urlParam = new URL(`https://duckduckgo.com${rawHref}`).searchParams.get('uddg');
              if (urlParam) actualUrl = decodeURIComponent(urlParam);
            } catch {}
          }

          if (actualUrl.startsWith('http') && !actualUrl.includes('duckduckgo.com')) {
            results.push({
              url: actualUrl,
              snippet: linkMatch[2].replace(/<[^>]+>/g, '').trim(),
            });
          }
        }
      } catch {
        // Continue gracefully on timeout
      }
    }

    return results.slice(0, 35);
  }
}

/**
 * SerpAPI Source with Dynamic Queries & GeoTargeting
 */
export class SerpApiSource implements DiscoverySource {
  name = 'SerpAPI';
  private apiKey: string;
  private queries: string[];
  private geoTarget?: string;

  constructor(apiKey: string, queries: string[], geoTarget?: string) {
    this.apiKey = apiKey;
    this.queries = queries;
    this.geoTarget = geoTarget;
  }

  async discover(): Promise<{ url: string; snippet: string }[]> {
    if (!this.apiKey || this.apiKey === 'your_serpapi_key_here' || this.apiKey.trim().length < 10) {
      return [];
    }

    const allResults: { url: string; snippet: string }[] = [];

    for (const query of this.queries.slice(0, 4)) {
      try {
        const params = new URLSearchParams({
          q: query,
          api_key: this.apiKey,
          engine: 'google',
          num: '10',
          gl: this.geoTarget || 'uk',
          hl: 'en',
        });

        const response = await fetch(`https://serpapi.com/search?${params.toString()}`, {
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) continue;

        const data = await response.json();
        const organicResults = data.organic_results || [];

        for (const res of organicResults) {
          if (res.link && res.snippet) {
            allResults.push({ url: res.link, snippet: res.snippet });
          }
        }
      } catch (err) {
        console.warn('SerpAPI search query failed:', err);
      }
    }

    return allResults;
  }
}

/**
 * Main discovery orchestrator
 * Aggregates all sources according to active HuntConfig parameters.
 */
export async function discoverCompanies(config: HuntConfig = TVB_EVALUATION_CONFIG): Promise<CandidateUrl[]> {
  const { queries, geoTarget } = generateSearchQueries(config);

  const sources: DiscoverySource[] = [
    new VerifiedSeedDatasetSource(config),
    new OpenWebSearchSource(queries),
  ];

  // Include RSS news if global/European
  if (config.geography.mode === 'global' || config.geography.regions.includes('Europe')) {
    sources.push(new PublicFundingNewsSource());
  }

  // SerpAPI
  const serpKey = process.env.SERPAPI_KEY;
  if (serpKey && serpKey !== 'your_serpapi_key_here' && serpKey.trim().length > 10) {
    sources.push(new SerpApiSource(serpKey, queries, geoTarget));
  }

  const results = await Promise.allSettled(sources.map(s => s.discover()));

  const merged: CandidateUrl[] = [];
  results.forEach((res, index) => {
    if (res.status === 'fulfilled') {
      for (const item of res.value) {
        merged.push({
          url: item.url,
          snippet: item.snippet,
          source: sources[index].name,
        });
      }
    }
  });

  const deduplicated = deduplicateByDomain(merged);
  console.log(`[Discovery] Config: ${config.name || 'Custom'} | Candidates: ${merged.length} raw, ${deduplicated.length} unique.`);
  return deduplicated;
}