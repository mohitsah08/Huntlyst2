'use client';

import React, { useState } from 'react';
import { InternalRecordDTO } from '@/app/api/discovery/internal/records/route';
import { downloadSingleMarkdown, generateRecordMarkdown } from '@/lib/exportMarkdown';

interface InternalCompanyDossierModalProps {
  isOpen: boolean;
  company: InternalRecordDTO | null;
  currentIndex: number;
  totalCompanies: number;
  onClose: () => void;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
  onSaveToShortlist?: (company: InternalRecordDTO) => void;
}

type TabType = 'dossier' | 'raw' | 'evidence' | 'notes';

export default function InternalCompanyDossierModal({
  isOpen,
  company,
  currentIndex,
  totalCompanies,
  onClose,
  onNavigatePrev,
  onNavigateNext,
  onSaveToShortlist,
}: InternalCompanyDossierModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('dossier');
  const [notes, setNotes] = useState('');
  const [isShortlisted, setIsShortlisted] = useState(false);

  // Sync notes when company changes
  React.useEffect(() => {
    if (company) {
      setNotes(company.notes || '');
      setIsShortlisted(false);
    }
  }, [company]);

  if (!isOpen || !company) return null;

  const handleExportMarkdown = () => {
    try {
      const recordForExport: any = {
        name: company.name,
        canonicalDomain: company.domain,
        website: company.website,
        industry: company.industry,
        country: company.country,
        fundingAmountUsd: company.fundingAmount,
        fundingFormatted: company.funding,
        stage: company.stage,
        description: company.description,
        verificationStatus: company.status,
        companyEmail: company.companyEmail,
        ceoName: company.ceoName,
        ceoEmail: company.executiveEmail,
        rawFields: company.rawFields,
      };
      const mdContent = generateRecordMarkdown(recordForExport, {
        workflowOrigin: 'INTERNAL',
        includeEvidence: true,
      });
      const filename = `${company.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-dossier.md`;
      downloadSingleMarkdown(mdContent, filename);
    } catch (err) {
      console.error('Markdown export error:', err);
    }
  };

  const handleSaveShortlist = () => {
    setIsShortlisted(true);
    if (onSaveToShortlist) {
      onSaveToShortlist(company);
    }
  };

  // Status color pill
  const getStatusBadge = (statusLabel: string) => {
    switch (statusLabel) {
      case 'FOUND':
      case 'VERIFIED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#E8F5E9] text-[#2E7D32] border border-[#2E7D32]/40">
            {statusLabel}
          </span>
        );
      case 'MISSING':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#FFEBEE] text-[#C62828] border border-[#C62828]/40">
            {statusLabel}
          </span>
        );
      case 'NEEDS REVIEW':
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#FFF3E0] text-[#E65100] border border-[#FFB74D]">
            {statusLabel}
          </span>
        );
    }
  };

  // Donut Gauge Arc for matchScore
  const score = company.offlineMatchScore ?? 35;
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="paper-card bg-[#FFFDF9] rounded-2xl border-2 border-[#1E1B18] shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header matching Reference Image */}
        <div className="p-4 sm:p-5 border-b border-[#E5E0D5] bg-[#FAF6EE] flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[#1E1B18]">
                {company.name}
              </h2>
              {getStatusBadge(company.statusLabel)}
            </div>

            <div className="flex items-center gap-2">
              <a
                href={company.website || `https://${company.domain}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono font-bold text-[#FF6B35] hover:underline flex items-center gap-1"
              >
                <span>{company.domain || company.website}</span>
                <span>↗</span>
              </a>
            </div>

            <p className="text-xs text-[#5A544E] leading-relaxed max-w-xl">
              {company.description}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Index Pager < 1 / 100 > */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-[#1E1B18] bg-white text-xs font-mono font-bold shadow-sketch-xs">
              <button
                type="button"
                onClick={onNavigatePrev}
                disabled={currentIndex <= 1}
                className="text-[#1E1B18] hover:text-[#FF6B35] disabled:opacity-30 px-1"
              >
                &lt;
              </button>
              <span className="px-1 text-[#766E65]">
                {currentIndex} / {totalCompanies}
              </span>
              <button
                type="button"
                onClick={onNavigateNext}
                disabled={currentIndex >= totalCompanies}
                className="text-[#1E1B18] hover:text-[#FF6B35] disabled:opacity-30 px-1"
              >
                &gt;
              </button>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg border border-[#DCD6C9] hover:bg-white flex items-center justify-center text-[#766E65] hover:text-[#1E1B18] text-base transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 border-b border-[#E5E0D5] bg-[#FAF6EE] flex items-center gap-4 text-xs font-bold font-mono">
          {[
            { id: 'dossier', label: 'Company Dossier' },
            { id: 'raw', label: 'Raw Data' },
            { id: 'evidence', label: 'Evidence' },
            { id: 'notes', label: 'Notes' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`py-2.5 transition-all relative ${
                activeTab === tab.id
                  ? 'text-[#FF6B35] font-bold border-b-2 border-[#FF6B35]'
                  : 'text-[#766E65] hover:text-[#1E1B18]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 p-5 overflow-y-auto bg-[#FFFDF9] space-y-5">
          {/* TAB 1: Company Dossier */}
          {activeTab === 'dossier' && (
            <div className="space-y-4">
              {/* 2-Column Info Box: Key Information vs Missing / Unverified */}
              <div className="grid grid-cols-1 gap-4">
                {/* Left: What We Found / Key Information */}
                <div className="p-4 bg-white rounded-xl border border-[#DCD6C9] shadow-sm space-y-3">
                  <div className="flex items-center gap-2 border-b border-[#F0EAD8] pb-2">
                    <span className="w-4 h-4 rounded-full bg-[#E8F5E9] text-[#2E7D32] flex items-center justify-center text-[10px] font-bold">
                      ✓
                    </span>
                    <h3 className="font-display font-bold text-xs text-[#1E1B18]">
                      Key Information
                    </h3>
                  </div>

                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between py-1 border-b border-[#F5F1E8]">
                      <span className="text-[#766E65] flex items-center gap-1.5">
                        <span>🏷️</span> Funding
                      </span>
                      <span className="font-bold text-[#1E1B18]">
                        {company.rawFields['Funding Amount (in USD)'] || company.funding} USD
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-[#F5F1E8]">
                      <span className="text-[#766E65] flex items-center gap-1.5">
                        <span>🏢</span> Industry
                      </span>
                      <span className="font-bold text-[#1E1B18]">{company.industry}</span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-[#F5F1E8]">
                      <span className="text-[#766E65] flex items-center gap-1.5">
                        <span>🌍</span> Geography
                      </span>
                      <span className="font-bold text-[#1E1B18]">{company.country || company.geo}</span>
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <span className="text-[#766E65] flex items-center gap-1.5">
                        <span>✉️</span> Company Email
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[#1E1B18]">{company.companyEmail}</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#E8F5E9] text-[#2E7D32]">
                          Found
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Missing / Unverified */}
                <div className="p-4 bg-white rounded-xl border border-[#DCD6C9] shadow-sm space-y-3">
                  <div className="flex items-center gap-2 border-b border-[#F0EAD8] pb-2">
                    <span className="w-4 h-4 rounded-full bg-[#FFEBEE] text-[#C62828] flex items-center justify-center text-[10px] font-bold">
                      ⚠
                    </span>
                    <h3 className="font-display font-bold text-xs text-[#1E1B18]">
                      Missing / Unverified
                    </h3>
                  </div>

                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between py-1 border-b border-[#F5F1E8]">
                      <span className="text-[#766E65] flex items-center gap-1.5">
                        <span>👤</span> CEO / Founder
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFEBEE] text-[#C62828] border border-[#C62828]/30">
                        <span>⚠</span> Not verified
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-[#F5F1E8]">
                      <span className="text-[#766E65] flex items-center gap-1.5">
                        <span>✉️</span> Direct executive email
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#F5F5F5] text-[#757575] border border-[#757575]/30">
                        <span>?</span> Not found
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-[#F5F1E8]">
                      <span className="text-[#766E65] flex items-center gap-1.5">
                        <span>📞</span> Company phone
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#F5F5F5] text-[#757575] border border-[#757575]/30">
                        <span>?</span> Not found
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <span className="text-[#766E65] flex items-center gap-1.5">
                        <span>🔗</span> Company LinkedIn
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#F5F5F5] text-[#757575] border border-[#757575]/30">
                        <span>?</span> Not found
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Row: Offline Target Match & Online Verification Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Card: Offline Target Match */}
                <div className="p-4 bg-white rounded-xl border border-[#DCD6C9] shadow-sm space-y-2">
                  <div className="text-[11px] font-bold text-[#766E65] flex items-center gap-1.5">
                    <span>🎯</span> Verification
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Donut Gauge */}
                    <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                        {/* Background track */}
                        <circle
                          cx="40"
                          cy="40"
                          r={radius}
                          stroke="#F0EAD8"
                          strokeWidth="8"
                          fill="transparent"
                        />
                        {/* Progress arc */}
                        <circle
                          cx="40"
                          cy="40"
                          r={radius}
                          stroke="#FF6B35"
                          strokeWidth="8"
                          fill="transparent"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="font-display font-bold text-base text-[#1E1B18] leading-none">
                          {score}
                        </span>
                        <span className="text-[9px] font-mono text-[#766E65]">/ 100</span>
                      </div>
                    </div>

                    {/* Text description */}
                    <div className="space-y-1">
                      <h4 className="font-display font-bold text-xs text-[#1E1B18]">
                        Offline Target Match
                      </h4>
                      <p className="text-[11px] font-mono text-[#766E65] leading-snug">
                        {company.offlineMatchExplanation}
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: Raw Data */}
          {activeTab === 'raw' && (
            <div className="p-4 bg-white rounded-xl border border-[#DCD6C9] shadow-sm space-y-3">
              <h3 className="font-display font-bold text-xs text-[#1E1B18] flex items-center gap-2">
                <span>📄</span> Imported Raw Fields & Attributes
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono border-collapse">
                  <tbody>
                    {Object.entries(company.rawFields).map(([k, v]) => (
                      <tr key={k} className="border-b border-[#F0EAD8] hover:bg-[#FAF6EE]">
                        <td className="py-1.5 px-3 font-bold text-[#766E65] w-1/3 bg-[#FFFDF9]">{k}</td>
                        <td className="py-1.5 px-3 text-[#1E1B18] break-all">{String(v || '—')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Evidence */}
          {activeTab === 'evidence' && (
            <div className="p-4 bg-white rounded-xl border border-[#DCD6C9] shadow-sm space-y-3">
              <h3 className="font-display font-bold text-xs text-[#1E1B18] flex items-center gap-2">
                <span>🔍</span> Verification Evidence & Audit Trail
              </h3>
              <div className="space-y-2">
                {company.evidence.map((ev, idx) => (
                  <div key={idx} className="p-3 rounded-lg border border-[#E5E0D5] bg-[#FAF6EE] space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#FF6B35]">
                      <span>{ev.label}</span>
                      {ev.timestamp && <span className="text-[#766E65] font-mono text-[10px]">{new Date(ev.timestamp).toLocaleTimeString()}</span>}
                    </div>
                    {ev.text && <p className="text-xs font-mono text-[#1E1B18]">{ev.text}</p>}
                    {ev.url && (
                      <a href={ev.url} target="_blank" rel="noreferrer" className="text-[11px] font-mono text-[#00838F] hover:underline block truncate">
                        Source: {ev.url}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: Notes */}
          {activeTab === 'notes' && (
            <div className="p-4 bg-white rounded-xl border border-[#DCD6C9] shadow-sm space-y-3">
              <h3 className="font-display font-bold text-xs text-[#1E1B18] flex items-center gap-2">
                <span>📝</span> Company Notes & Evaluation Memos
              </h3>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Write internal evaluation notes, contact notes, or deal thesis for this lead..."
                rows={6}
                className="w-full p-3 text-xs font-mono border border-[#1E1B18] rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#FF6B35]"
              />
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="p-4 sm:p-5 border-t border-[#E5E0D5] bg-[#FAF6EE] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveShortlist}
              className={`px-3 py-2 text-xs font-bold rounded-xl border border-[#1E1B18] transition-all flex items-center gap-1.5 ${
                isShortlisted
                  ? 'bg-[#E8F5E9] text-[#2E7D32] border-[#2E7D32]'
                  : 'bg-white text-[#1E1B18] hover:bg-[#FAF6EE] shadow-sketch-xs'
              }`}
            >
              <span>⭐</span>
              <span>{isShortlisted ? 'Saved to Shortlist' : 'Save to Shortlist'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportMarkdown}
              className="px-3 py-2 text-xs font-bold text-[#1E1B18] bg-white border border-[#1E1B18] rounded-xl hover:bg-[#FAF6EE] shadow-sketch-xs flex items-center gap-1.5 transition-colors"
            >
              <span>📝</span>
              <span>Export Markdown</span>
            </button>
          </div>

          <a
            href={company.website || `https://${company.domain}`}
            target="_blank"
            rel="noreferrer"
            className="sketch-btn px-5 py-2.5 text-xs font-bold text-white bg-[#FF6B35] border-2 border-[#1E1B18] rounded-xl hover:bg-[#E55A2B] shadow-sketch-sm flex items-center gap-1.5 transition-all"
          >
            <span>↗</span>
            <span>Visit Website</span>
          </a>
        </div>
      </div>
    </div>
  );
}
