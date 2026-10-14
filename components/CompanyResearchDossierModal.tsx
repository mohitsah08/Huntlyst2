'use client';

import React, { useState } from 'react';
import {
  CompanyResearchProfile,
  VerificationRun,
  computeCardFieldStatuses,
  FieldResearchStatus,
} from '@/lib/research/types';
import { downloadSingleMarkdown } from '@/lib/export';

interface CompanyResearchDossierModalProps {
  profile: CompanyResearchProfile | null;
  verificationRun?: VerificationRun | null;
  onClose: () => void;
  onVerify?: (companyId: string) => void;
  isVerifying?: boolean;
}

type DossierSection = 'overview' | 'geography' | 'leadership' | 'funding' | 'contacts' | 'audit' | 'sources';

export default function CompanyResearchDossierModal({
  profile,
  verificationRun,
  onClose,
  onVerify,
  isVerifying = false,
}: CompanyResearchDossierModalProps) {
  const [activeSection, setActiveSection] = useState<DossierSection>('overview');

  if (!profile) return null;

  // Status indicators for the 9 core fields
  const statusSummary = computeCardFieldStatuses(profile);
  const { fields, completenessText } = statusSummary;

  // Source Grouping (Requirement 7)
  const groupSources = () => {
    const groups: {
      official: Array<{ url: string; title?: string; tier: string; date: string; supportedFields: string[]; excerpts: string[] }>;
      linkedin: Array<{ url: string; title?: string; tier: string; date: string; supportedFields: string[]; excerpts: string[] }>;
      funding: Array<{ url: string; title?: string; tier: string; date: string; supportedFields: string[]; excerpts: string[] }>;
      other: Array<{ url: string; title?: string; tier: string; date: string; supportedFields: string[]; excerpts: string[] }>;
    } = {
      official: [],
      linkedin: [],
      funding: [],
      other: [],
    };

    // Gather all distinct source URLs from sources array and fieldEvidence
    const urlMap = new Map<string, { title?: string; tier: string; date: string; supportedFields: string[]; excerpts: string[] }>();

    for (const src of profile.sources) {
      if (!urlMap.has(src.url)) {
        urlMap.set(src.url, {
          title: src.title,
          tier: src.tier,
          date: src.retrievedAt,
          supportedFields: [],
          excerpts: [],
        });
      }
    }

    // Map fields and excerpts to their source URLs
    for (const ev of Object.values(profile.fieldEvidence)) {
      if (ev.sourceUrl) {
        let entry = urlMap.get(ev.sourceUrl);
        if (!entry) {
          entry = {
            title: ev.sourceTitle || undefined,
            tier: ev.sourceTier || 'TIER_3_REFERENCE',
            date: ev.dateRetrieved,
            supportedFields: [],
            excerpts: [],
          };
          urlMap.set(ev.sourceUrl, entry);
        }

        if (!entry.supportedFields.includes(ev.field)) {
          entry.supportedFields.push(ev.field);
        }
        if (ev.excerpt && !entry.excerpts.includes(ev.excerpt)) {
          entry.excerpts.push(ev.excerpt);
        }
      }
    }

    // Classify into the 4 required categories
    for (const [url, data] of urlMap.entries()) {
      const u = url.toLowerCase();
      const item = { url, ...data };

      if (u.includes('linkedin.com')) {
        groups.linkedin.push(item);
      } else if (
        u.includes('crunchbase.com') ||
        u.includes('pitchbook.com') ||
        u.includes('tracxn.com') ||
        u.includes('sec.gov') ||
        u.includes('techcrunch.com') ||
        u.includes('bloomberg.com') ||
        u.includes('reuters.com') ||
        u.includes('venturebeat.com') ||
        u.includes('forbes.com') ||
        u.includes('startuptalky.com')
      ) {
        groups.funding.push(item);
      } else if (
        data.tier === 'TIER_1_OFFICIAL' ||
        (profile.canonicalDomain && u.includes(profile.canonicalDomain.toLowerCase()))
      ) {
        groups.official.push(item);
      } else {
        groups.other.push(item);
      }
    }

    return groups;
  };

  const sourceGroups = groupSources();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#1E1B18]/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      <div className="paper-card bg-[#FFFDF9] max-w-4xl w-full rounded-2xl p-5 sm:p-7 relative border-2 border-[#1E1B18] shadow-sketch-lg space-y-5 my-6 max-h-[92vh] overflow-y-auto">
        {/* HEADER: Company Name, Website, Badges, Close Button */}
        <div className="flex items-start justify-between border-b border-[#F0EAD8] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#1E1B18]">
                {profile.officialName}
              </h2>

              <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-[#E8EAF6] text-[#283593] border border-[#C5CAE9] rounded-md">
                Completeness: {completenessText}
              </span>

              {verificationRun ? (
                <span
                  className={`px-2.5 py-0.5 text-xs font-mono font-bold rounded-full border ${
                    verificationRun.overallStatus === 'VERIFIED'
                      ? 'bg-[#E8F5E9] text-[#2E7D32] border-[#2E7D32]/30'
                      : verificationRun.overallStatus === 'REVIEW'
                      ? 'bg-[#FFF8E1] text-[#E65100] border-[#FFA000]/30'
                      : verificationRun.overallStatus === 'REJECTED'
                      ? 'bg-[#FFEBEE] text-[#C62828] border-[#C62828]/30'
                      : 'bg-[#FAF6EE] text-[#766E65] border-[#DCD6C9]'
                  }`}
                >
                  Verified: {verificationRun.overallStatus} ({verificationRun.qualificationScore}%)
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[11px] font-mono text-[#766E65] bg-[#FAF6EE] border border-[#DCD6C9] rounded">
                  Target Verification: Unverified
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-[#766E65] flex-wrap">
              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline text-[#FF6B35] font-bold flex items-center gap-1"
                >
                  <span>🌐 {profile.canonicalDomain || profile.website}</span>
                  <span className="text-[10px]">↗</span>
                </a>
              )}
              <span>•</span>
              <span>📍 {[profile.headquarters.city, profile.headquarters.country].filter(Boolean).join(', ') || 'Undisclosed Location'}</span>
              <span>•</span>
              <span className="text-[#1E1B18] font-bold">🏷️ {profile.primaryIndustry || 'Undisclosed Sector'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Export Markdown Action */}
            <button
              type="button"
              onClick={() => downloadSingleMarkdown(profile)}
              className="sketch-btn px-3 py-1.5 text-xs font-bold text-[#1E1B18] bg-white hover:bg-[#FAF6EE] border border-[#1E1B18] rounded-xl flex items-center gap-1.5 shadow-sketch-xs"
              title="Export complete company research dossier as Obsidian Markdown note (.md)"
            >
              <span>📝</span>
              <span>Export Markdown</span>
            </button>

            {onVerify && (
              <button
                type="button"
                disabled={isVerifying}
                onClick={() => onVerify(profile.id)}
                className="sketch-btn px-3 py-1.5 text-xs font-bold text-white bg-[#FF6B35] hover:bg-[#E55A2B] border border-[#1E1B18] rounded-xl flex items-center gap-1.5 shadow-sketch-xs disabled:opacity-50"
              >
                <span>⚡ Verify Against Criteria</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full border border-[#DCD6C9] bg-white flex items-center justify-center text-sm font-bold text-[#766E65] hover:bg-[#FAF6EE] hover:text-[#1E1B18] transition-colors"
              title="Close Dossier"
            >
              ✕
            </button>
          </div>
        </div>

        {/* SECTION NAV TABS */}
        <div className="flex items-center gap-1.5 border-b border-[#EBE4D5] pb-2 overflow-x-auto text-xs font-mono font-bold">
          <button
            type="button"
            onClick={() => setActiveSection('overview')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeSection === 'overview' ? 'bg-[#1E1B18] text-white' : 'bg-white text-[#766E65] hover:bg-[#FAF6EE] border border-[#EBE4D5]'
            }`}
          >
            A. Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('geography')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeSection === 'geography' ? 'bg-[#1E1B18] text-white' : 'bg-white text-[#766E65] hover:bg-[#FAF6EE] border border-[#EBE4D5]'
            }`}
          >
            B. Geography & Age
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('leadership')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeSection === 'leadership' ? 'bg-[#1E1B18] text-white' : 'bg-white text-[#766E65] hover:bg-[#FAF6EE] border border-[#EBE4D5]'
            }`}
          >
            C. Leadership & Profiles
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('funding')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeSection === 'funding' ? 'bg-[#1E1B18] text-white' : 'bg-white text-[#766E65] hover:bg-[#FAF6EE] border border-[#EBE4D5]'
            }`}
          >
            D. Funding Intelligence
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('contacts')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeSection === 'contacts' ? 'bg-[#1E1B18] text-white' : 'bg-white text-[#766E65] hover:bg-[#FAF6EE] border border-[#EBE4D5]'
            }`}
          >
            E. Contact Channels
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('audit')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeSection === 'audit' ? 'bg-[#1E1B18] text-white' : 'bg-white text-[#766E65] hover:bg-[#FAF6EE] border border-[#EBE4D5]'
            }`}
          >
            F. Completeness & Audit
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('sources')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeSection === 'sources' ? 'bg-[#1E1B18] text-white' : 'bg-white text-[#766E65] hover:bg-[#FAF6EE] border border-[#EBE4D5]'
            }`}
          >
            G. Grouped Sources ({profile.sources.length})
          </button>
        </div>

        {/* SECTION A: COMPANY OVERVIEW */}
        {activeSection === 'overview' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="p-4 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5]">
              <h4 className="text-[11px] font-mono uppercase font-bold text-[#766E65] mb-1">
                Company Description
              </h4>
              <p className="text-sm text-[#1E1B18] leading-relaxed">
                {profile.description || 'No official meta description discovered in site tags.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-3 bg-white rounded-xl border border-[#EBE4D5]">
                <span className="text-[#766E65] block uppercase text-[10px] font-bold">Primary Industry</span>
                <span className="font-bold text-[#1E1B18] text-sm mt-0.5 block">
                  {profile.primaryIndustry || 'Undisclosed'}
                </span>
                {profile.subIndustry && (
                  <span className="text-[#766E65] text-[11px] mt-0.5 block">
                    Sub-industry: {profile.subIndustry}
                  </span>
                )}
              </div>

              <div className="p-3 bg-white rounded-xl border border-[#EBE4D5]">
                <span className="text-[#766E65] block uppercase text-[10px] font-bold">Business Model</span>
                <span className="font-bold text-[#1E1B18] text-sm mt-0.5 block">
                  {profile.businessModel || 'B2B Technology Platform'}
                </span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-[#EBE4D5]">
                <span className="text-[#766E65] block uppercase text-[10px] font-bold">Canonical Domain</span>
                <span className="font-bold text-[#FF6B35] text-sm mt-0.5 block">
                  {profile.canonicalDomain}
                </span>
              </div>
            </div>

            {profile.productsAndServices.length > 0 && (
              <div className="p-3 bg-white rounded-xl border border-[#EBE4D5]">
                <span className="text-[#766E65] block uppercase text-[10px] font-bold mb-1">Products & Services</span>
                <div className="flex gap-1.5 flex-wrap">
                  {profile.productsAndServices.map((prod, i) => (
                    <span key={i} className="px-2 py-0.5 bg-[#FAF6EE] border border-[#DCD6C9] rounded text-xs">
                      {prod}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SECTION B: GEOGRAPHY & COMPANY AGE */}
        {activeSection === 'geography' && (
          <div className="space-y-4 animate-in fade-in text-xs font-mono">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 bg-white rounded-xl border border-[#EBE4D5] space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#766E65] block">Headquarters Information</span>
                <div className="text-base font-bold text-[#1E1B18]">
                  {[profile.headquarters.city, profile.headquarters.stateOrRegion, profile.headquarters.country].filter(Boolean).join(', ') || 'Undisclosed Location'}
                </div>
                <div className="text-[#766E65] space-y-0.5 pt-1 border-t border-[#F0EAD8]">
                  <div>City: <strong className="text-[#1E1B18]">{profile.headquarters.city || 'Undisclosed'}</strong></div>
                  <div>State/Region: <strong className="text-[#1E1B18]">{profile.headquarters.stateOrRegion || 'Undisclosed'}</strong></div>
                  <div>Country: <strong className="text-[#1E1B18]">{profile.headquarters.country || 'Undisclosed'}</strong></div>
                  {profile.headquarters.address && (
                    <div>Physical Address: <span className="text-[#1E1B18]">{profile.headquarters.address}</span></div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-white rounded-xl border border-[#EBE4D5] space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#766E65] block">Founding & Company Age</span>
                <div className="text-base font-bold text-[#1E1B18]">
                  {profile.companyAgeYears !== null ? `${profile.companyAgeYears} Years Active` : 'Age Undisclosed'}
                </div>
                <div className="text-[#766E65] space-y-0.5 pt-1 border-t border-[#F0EAD8]">
                  <div>Founded Year: <strong className="text-[#1E1B18]">{profile.foundedYear || 'Undisclosed'}</strong></div>
                  <div>Exact Founding Date: <strong className="text-[#1E1B18]">{profile.foundingDate || 'Undisclosed'}</strong></div>
                  <div>US Presence Anchor: <strong className="text-[#1E1B18]">{profile.usPresence ? 'Verified US Presence' : profile.usPresence === false ? 'No US Office' : 'Unknown'}</strong></div>
                </div>
              </div>
            </div>

            {profile.operatingCountries.length > 0 && (
              <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5]">
                <span className="text-[10px] uppercase font-bold text-[#766E65] block mb-1">Documented Operating Hubs & Offices</span>
                <div className="flex gap-1.5 flex-wrap">
                  {profile.operatingCountries.map((country, i) => (
                    <span key={i} className="px-2 py-0.5 bg-white border border-[#DCD6C9] rounded text-xs font-bold text-[#1E1B18]">
                      📍 {country}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SECTION C: LEADERSHIP & PROFILES */}
        {activeSection === 'leadership' && (
          <div className="space-y-4 animate-in fade-in text-xs font-mono">
            {/* CEO Card */}
            <div className="p-4 bg-white rounded-xl border border-[#EBE4D5] space-y-2">
              <span className="text-[10px] uppercase font-bold text-[#766E65] block">Chief Executive Officer</span>
              {profile.leadership.ceo ? (
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-base font-bold text-[#1E1B18] block">{profile.leadership.ceo.name}</span>
                    <span className="text-[#766E65] text-xs">{profile.leadership.ceo.title} (Current CEO)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {(profile.leadership.ceo.linkedInUrl || profile.leadership.ceo.publicProfileUrl) && (
                      <a
                        href={profile.leadership.ceo.linkedInUrl || profile.leadership.ceo.publicProfileUrl || ''}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded bg-[#0077B5] text-white font-bold text-xs hover:opacity-90 flex items-center gap-1"
                      >
                        <span>LinkedIn</span> ↗
                      </a>
                    )}
                    {profile.leadership.ceo.publicEmail && (
                      <span className="px-2.5 py-1 rounded bg-[#E8F5E9] text-[#2E7D32] border border-[#2E7D32]/30 font-bold">
                        ✉️ {profile.leadership.ceo.publicEmail}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-[#B26A00]">No verified CEO publicly listed on official pages.</div>
              )}
            </div>

            {/* Founders & Co-Founders */}
            <div className="p-4 bg-white rounded-xl border border-[#EBE4D5] space-y-3">
              <span className="text-[10px] uppercase font-bold text-[#766E65] block">Founders & Co-Founders ({profile.leadership.founders.length})</span>
              {profile.leadership.founders.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {profile.leadership.founders.map((f, i) => (
                    <div key={i} className="p-2.5 bg-[#FAF6EE] rounded-lg border border-[#EBE4D5] flex items-center justify-between">
                      <div>
                        <strong className="text-[#1E1B18] block">{f.name}</strong>
                        <span className="text-[11px] text-[#766E65]">{f.title || 'Co-Founder'}</span>
                      </div>
                      {f.publicProfileUrl && (
                        <a href={f.publicProfileUrl} target="_blank" rel="noopener noreferrer" className="text-[#0077B5] font-bold text-[11px] hover:underline">
                          Profile ↗
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[#766E65]">No co-founders documented on web pages.</div>
              )}
            </div>

            {/* CTO / Other Executives */}
            {profile.leadership.cto && (
              <div className="p-3 bg-white rounded-xl border border-[#EBE4D5]">
                <span className="text-[10px] uppercase font-bold text-[#766E65] block">Chief Technology Officer</span>
                <span className="font-bold text-[#1E1B18] text-sm mt-0.5 block">{profile.leadership.cto.name}</span>
              </div>
            )}
          </div>
        )}

        {/* SECTION D: FUNDING INTELLIGENCE (PROMINENT) */}
        {activeSection === 'funding' && (
          <div className="space-y-4 animate-in fade-in text-xs font-mono">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="p-4 bg-[#FAF6EE] rounded-xl border-2 border-[#1E1B18]/30 space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#766E65] block">Total Disclosed Funding</span>
                <div className="text-xl font-bold font-display text-[#1E1B18]">
                  {profile.funding.totalFundingUsd ? (
                    `$${(profile.funding.totalFundingUsd / 1e6).toFixed(1)}M USD`
                  ) : (
                    <span className="text-[#B26A00] text-sm">Undisclosed Amount</span>
                  )}
                </div>
                <span className="text-[10px] text-[#766E65] block">Cumulative disclosed venture rounds</span>
              </div>

              <div className="p-4 bg-white rounded-xl border border-[#EBE4D5] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#766E65] block">Latest Round Amount</span>
                <div className="text-xl font-bold font-display text-[#1E1B18]">
                  {profile.funding.latestRoundUsd ? (
                    `$${(profile.funding.latestRoundUsd / 1e6).toFixed(1)}M USD`
                  ) : (
                    <span className="text-[#B26A00] text-sm">Undisclosed</span>
                  )}
                </div>
                <span className="text-[10px] text-[#766E65] block">Most recent financing round</span>
              </div>

              <div className="p-4 bg-white rounded-xl border border-[#EBE4D5] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#766E65] block">Funding Stage / Type</span>
                <div className="text-base font-bold text-[#1E1B18] mt-1">
                  {profile.funding.latestRoundType || 'Undisclosed Stage'}
                </div>
                <span className="text-[10px] text-[#766E65] block">
                  Date: {profile.funding.latestRoundDate || 'Undisclosed'}
                </span>
              </div>
            </div>

            {profile.funding.investors.length > 0 && (
              <div className="p-3 bg-white rounded-xl border border-[#EBE4D5]">
                <span className="text-[10px] uppercase font-bold text-[#766E65] block mb-1">Disclosed Investors & Backers</span>
                <div className="flex gap-1.5 flex-wrap">
                  {profile.funding.investors.map((inv, i) => (
                    <span key={i} className="px-2 py-0.5 bg-[#FAF6EE] border border-[#DCD6C9] rounded text-xs font-bold text-[#1E1B18]">
                      💼 {inv}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SECTION E: CONTACT CHANNELS (SEPARATED) */}
        {activeSection === 'contacts' && (
          <div className="space-y-4 animate-in fade-in text-xs font-mono">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Company Channels */}
              <div className="p-4 bg-white rounded-xl border border-[#EBE4D5] space-y-2.5">
                <h4 className="text-[11px] uppercase font-bold text-[#766E65] border-b border-[#F0EAD8] pb-1">
                  🏢 Official Company Contact
                </h4>
                <div>
                  <span className="text-[10px] text-[#766E65] block">General Email:</span>
                  <span className="font-bold text-sm text-[#1E1B18]">
                    {profile.contacts.generalEmail ? `✉️ ${profile.contacts.generalEmail}` : 'No public email listed'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#766E65] block">Public Phone:</span>
                  <span className="font-bold text-sm text-[#1E1B18]">
                    {profile.contacts.phone ? `📞 ${profile.contacts.phone}` : 'None listed'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#766E65] block">Contact Page:</span>
                  {profile.contacts.contactPageUrl ? (
                    <a href={profile.contacts.contactPageUrl} target="_blank" rel="noopener noreferrer" className="text-[#FF6B35] font-bold hover:underline">
                      {profile.contacts.contactPageUrl} ↗
                    </a>
                  ) : (
                    <span className="text-[#766E65]">None listed</span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-[#766E65] block">Company LinkedIn:</span>
                  {profile.contacts.companyLinkedInUrl ? (
                    <a href={profile.contacts.companyLinkedInUrl} target="_blank" rel="noopener noreferrer" className="text-[#0077B5] font-bold hover:underline">
                      {profile.contacts.companyLinkedInUrl} ↗
                    </a>
                  ) : (
                    <span className="text-[#766E65]">None listed</span>
                  )}
                </div>
              </div>

              {/* Executive Channels */}
              <div className="p-4 bg-white rounded-xl border border-[#EBE4D5] space-y-2.5">
                <h4 className="text-[11px] uppercase font-bold text-[#766E65] border-b border-[#F0EAD8] pb-1">
                  👤 Executive Contact Channels
                </h4>
                <div>
                  <span className="text-[10px] text-[#766E65] block">CEO Professional Email:</span>
                  <span className="font-bold text-sm text-[#2E7D32]">
                    {profile.leadership.ceo?.publicEmail || 'Undisclosed (No guess)'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#766E65] block">Discovered Executive Emails:</span>
                  {profile.contacts.executiveEmails.length > 0 ? (
                    <div className="space-y-1 mt-1">
                      {profile.contacts.executiveEmails.map((e, i) => (
                        <div key={i} className="p-1.5 bg-[#FAF6EE] rounded border border-[#EBE4D5]">
                          <strong>{e.name} ({e.role})</strong>: <span className="text-[#2E7D32]">{e.email}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[#766E65]">No executive emails publicly disclosed</span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-[#766E65] block">Zero Pattern Guessing Guarantee:</span>
                  <span className="text-[11px] text-[#766E65] italic">
                    Huntlyst strictly stores only verified public email addresses. Synthetic name patterns like {`{first}@{domain}`} are never fabricated.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION F: RESEARCH COMPLETENESS & AUDIT */}
        {activeSection === 'audit' && (
          <div className="space-y-4 animate-in fade-in text-xs font-mono">
            <div className="p-4 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-[#1E1B18] text-sm">
                  Research Completeness Breakdown ({statusSummary.completenessText})
                </h4>
                <span className="text-[#766E65]">
                  Status: <strong className="uppercase">{profile.researchStatus}</strong>
                </span>
              </div>
              <p className="text-[11px] text-[#766E65]">
                {profile.statusReason || 'Factual web extraction completed with authoritative evidence.'}
              </p>
            </div>

            <div className="border border-[#EBE4D5] rounded-xl overflow-hidden divide-y divide-[#EBE4D5]">
              {Object.values(fields).map((item) => (
                <div key={item.key} className="p-3 bg-white flex items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-[#1E1B18] text-xs">{item.name}</span>
                    <div className="text-[11px] text-[#766E65] mt-0.5">{item.valueDisplay}</div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      item.status === 'FOUND'
                        ? 'bg-[#E8F5E9] text-[#2E7D32]'
                        : item.status === 'CONFLICTING'
                        ? 'bg-[#FFEBEE] text-[#C62828]'
                        : item.status === 'UNDISCLOSED'
                        ? 'bg-[#FFF8E1] text-[#B26A00]'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION G: GROUPED RESEARCH SOURCES (Requirement 7) */}
        {activeSection === 'sources' && (
          <div className="space-y-4 animate-in fade-in text-xs font-mono">
            <div className="text-[11px] text-[#766E65] p-2 bg-[#FAF6EE] rounded-lg border border-[#EBE4D5]">
              Consolidated Source Provenance: All {profile.sources.length} sources categorized into 4 verified source groups. Click any URL to inspect the live source.
            </div>

            {/* Group 1: Official Website */}
            <div className="p-4 bg-white rounded-xl border border-[#EBE4D5] space-y-3">
              <h4 className="font-bold text-sm text-[#1E1B18] flex items-center gap-2">
                <span>🏛️</span> 1. Official Company Website ({sourceGroups.official.length})
              </h4>
              {sourceGroups.official.length > 0 ? (
                <div className="space-y-2">
                  {sourceGroups.official.map((src, i) => (
                    <div key={i} className="p-2.5 bg-[#FAF6EE] rounded-lg border border-[#EBE4D5] space-y-1">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <a href={src.url} target="_blank" rel="noopener noreferrer" className="font-bold text-[#FF6B35] hover:underline">
                          {src.url} ↗
                        </a>
                        <span className="text-[10px] text-[#766E65]">{new Date(src.date).toLocaleDateString()}</span>
                      </div>
                      {src.title && <div className="text-[#1E1B18] font-medium">{src.title}</div>}
                      {src.supportedFields.length > 0 && (
                        <div className="text-[10px] text-[#766E65]">
                          Supported Fields: {src.supportedFields.join(', ')}
                        </div>
                      )}
                      {src.excerpts.length > 0 && (
                        <blockquote className="p-1.5 bg-white rounded border-l-2 border-[#FF6B35] text-[10px] italic text-[#1E1B18]">
                          "{src.excerpts[0]}"
                        </blockquote>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[#766E65]">No official pages crawled.</div>
              )}
            </div>

            {/* Group 2: LinkedIn */}
            <div className="p-4 bg-white rounded-xl border border-[#EBE4D5] space-y-3">
              <h4 className="font-bold text-sm text-[#1E1B18] flex items-center gap-2">
                <span>🔗</span> 2. LinkedIn Sources ({sourceGroups.linkedin.length})
              </h4>
              {sourceGroups.linkedin.length > 0 ? (
                <div className="space-y-2">
                  {sourceGroups.linkedin.map((src, i) => (
                    <div key={i} className="p-2.5 bg-[#FAF6EE] rounded-lg border border-[#EBE4D5] space-y-1">
                      <a href={src.url} target="_blank" rel="noopener noreferrer" className="font-bold text-[#0077B5] hover:underline">
                        {src.url} ↗
                      </a>
                      {src.supportedFields.length > 0 && (
                        <div className="text-[10px] text-[#766E65]">
                          Supported Fields: {src.supportedFields.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[#766E65]">No LinkedIn sources crawled.</div>
              )}
            </div>

            {/* Group 3: Funding / Investor / Regulatory Sources */}
            <div className="p-4 bg-white rounded-xl border border-[#EBE4D5] space-y-3">
              <h4 className="font-bold text-sm text-[#1E1B18] flex items-center gap-2">
                <span>📈</span> 3. Funding, Investor & Regulatory Sources ({sourceGroups.funding.length})
              </h4>
              {sourceGroups.funding.length > 0 ? (
                <div className="space-y-2">
                  {sourceGroups.funding.map((src, i) => (
                    <div key={i} className="p-2.5 bg-[#FAF6EE] rounded-lg border border-[#EBE4D5] space-y-1">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <a href={src.url} target="_blank" rel="noopener noreferrer" className="font-bold text-[#2E7D32] hover:underline">
                          {src.url} ↗
                        </a>
                        <span className="text-[10px] text-[#766E65]">{new Date(src.date).toLocaleDateString()}</span>
                      </div>
                      {src.title && <div className="text-[#1E1B18] font-medium">{src.title}</div>}
                      {src.supportedFields.length > 0 && (
                        <div className="text-[10px] text-[#766E65]">
                          Supported Fields: {src.supportedFields.join(', ')}
                        </div>
                      )}
                      {src.excerpts.length > 0 && (
                        <blockquote className="p-1.5 bg-white rounded border-l-2 border-[#2E7D32] text-[10px] italic text-[#1E1B18]">
                          "{src.excerpts[0]}"
                        </blockquote>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[#766E65]">No external funding directory records crawled.</div>
              )}
            </div>

            {/* Group 4: Other Public Web Sources */}
            <div className="p-4 bg-white rounded-xl border border-[#EBE4D5] space-y-3">
              <h4 className="font-bold text-sm text-[#1E1B18] flex items-center gap-2">
                <span>🌐</span> 4. Other Public Web Sources ({sourceGroups.other.length})
              </h4>
              {sourceGroups.other.length > 0 ? (
                <div className="space-y-2">
                  {sourceGroups.other.map((src, i) => (
                    <div key={i} className="p-2.5 bg-[#FAF6EE] rounded-lg border border-[#EBE4D5] space-y-1">
                      <a href={src.url} target="_blank" rel="noopener noreferrer" className="font-bold text-[#1E1B18] hover:underline">
                        {src.url} ↗
                      </a>
                      {src.title && <div className="text-[#766E65]">{src.title}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[#766E65]">No secondary public web sources.</div>
              )}
            </div>
          </div>
        )}

        {/* MODAL FOOTER ACTIONS */}
        <div className="flex items-center justify-between pt-3 border-t border-[#F0EAD8] flex-wrap gap-2">
          <span className="text-xs font-mono text-[#766E65]">
            Obsidian-compatible YAML frontmatter, verified sources, and field-level evidence.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => downloadSingleMarkdown(profile)}
              className="sketch-btn px-4 py-2 text-xs font-bold text-[#1E1B18] bg-white hover:bg-[#FAF6EE] border border-[#1E1B18] rounded-xl flex items-center gap-1.5 shadow-sketch-xs"
            >
              <span>📝</span>
              <span>Export Dossier as Markdown (.md)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="sketch-btn px-4 py-2 text-xs font-bold text-white bg-[#1E1B18] rounded-xl hover:bg-[#2C2724]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
