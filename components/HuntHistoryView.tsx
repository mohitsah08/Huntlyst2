'use client';

import { useState } from 'react';
import { RunHistoryItem, CompanyRecord } from '@/lib/types';
import { downloadCsvFile, downloadPdfFile, downloadDocxFile } from '@/lib/export';
import HuntlystLogo from './HuntlystLogo';

interface HuntHistoryViewProps {
  history: RunHistoryItem[];
  onViewRun: (run: RunHistoryItem) => void;
  onDeleteRun: (id: string) => void;
  onToast: (msg: string) => void;
  onNavigateToDiscover: () => void;
}

export default function HuntHistoryView({
  history,
  onViewRun,
  onDeleteRun,
  onToast,
  onNavigateToDiscover,
}: HuntHistoryViewProps) {
  const [selectedFormat, setSelectedFormat] = useState<'CSV' | 'PDF' | 'DOCX'>('CSV');

  const handleExportRun = async (run: RunHistoryItem, format: 'CSV' | 'PDF' | 'DOCX') => {
    if (!run.companies || run.companies.length === 0) {
      onToast('No company records in this hunt to export.');
      return;
    }
    const dateSlug = run.timestamp.split('T')[0] || 'run';
    try {
      if (format === 'CSV') {
        downloadCsvFile(run.companies, `huntlyst-hunt-${dateSlug}.csv`);
        onToast(`Exported ${run.companies.length} leads as CSV! 📥`);
      } else if (format === 'PDF') {
        downloadPdfFile(run.companies, `huntlyst-hunt-${dateSlug}.pdf`);
        onToast(`Exported ${run.companies.length} leads as PDF! 📄`);
      } else if (format === 'DOCX') {
        await downloadDocxFile(run.companies, `huntlyst-hunt-${dateSlug}.docx`);
        onToast(`Exported ${run.companies.length} leads as DOCX! 📝`);
      }
    } catch (err: any) {
      onToast(`Export failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 sm:p-7 relative shadow-sketch-sm border-2 border-[#1E1B18]">
        <div className="tape-strip" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">📜</span>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1E1B18]">
                Hunt History
              </h1>
            </div>
            <p className="text-xs font-mono text-[#766E65] mt-1">
              Historical record of autonomous discovery runs, candidates analyzed, and qualification rates.
            </p>
          </div>

          <button
            type="button"
            onClick={onNavigateToDiscover}
            className="sketch-btn px-4 py-2 text-xs font-bold text-white bg-[#FF6B35] hover:bg-[#F05820] rounded-xl border-2 border-[#1E1B18] shadow-sketch-sm flex items-center gap-2 self-start sm:self-auto"
          >
            <span>▶</span> Start a New Hunt
          </button>
        </div>
      </div>

      {/* History Items List */}
      {history.length === 0 ? (
        <div className="paper-card bg-[#FFFDF9] rounded-2xl p-12 text-center border-2 border-[#1E1B18] shadow-sketch-sm space-y-4">
          <div className="flex justify-center mx-auto">
            <HuntlystLogo size="lg" state="idle" showWordmark={false} />
          </div>
          <div className="space-y-1">
            <h3 className="font-display text-2xl font-bold text-[#1E1B18]">
              Nothing hunted yet.
            </h3>
            <p className="text-xs font-sans text-[#766E65] max-w-md mx-auto">
              Start your first hunt and let Huntlyst search the web for qualified technology companies matching your target profile.
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateToDiscover}
            className="sketch-btn px-5 py-2.5 text-xs font-bold text-white bg-[#FF6B35] hover:bg-[#F05820] rounded-xl border-2 border-[#1E1B18] shadow-sketch-sm inline-flex items-center gap-2"
          >
            <span>▶</span> Start Your First Hunt
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((run) => {
            const dateObj = new Date(run.timestamp);
            const dateFormatted = isNaN(dateObj.getTime())
              ? run.timestamp
              : dateObj.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
            const timeFormatted = isNaN(dateObj.getTime())
              ? ''
              : dateObj.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

            return (
              <div
                key={run.id}
                className="paper-card bg-[#FFFDF9] rounded-2xl p-5 sm:p-6 border-2 border-[#1E1B18] shadow-sketch-sm hover:shadow-sketch transition-all space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F0EAD8] pb-3">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl border-[1.5px] border-[#1E1B18] bg-[#FFE7DC] text-[#FF6B35] flex items-center justify-center font-bold text-sm shadow-sketch-sm">
                      🏹
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-[#1E1B18]">
                          {dateFormatted}
                        </span>
                        {timeFormatted && (
                          <span className="text-xs font-mono text-[#766E65]">
                            at {timeFormatted}
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                            run.status === 'Completed'
                              ? 'bg-[#E8F5E9] text-[#2E7D32] border-[#2E7D32]/30'
                              : 'bg-[#FFF3E0] text-[#E65100] border-[#E65100]/30'
                          }`}
                        >
                          {run.status}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-[#766E65]">
                        Target: {run.requestedCount || 15} leads • Sector: {run.sector || 'All sectors'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => onViewRun(run)}
                      className="sketch-btn px-3 py-1.5 text-xs font-bold text-[#1E1B18] bg-white hover:bg-[#FAF6EE] rounded-xl border-[1.5px] border-[#1E1B18] shadow-sketch-sm flex items-center gap-1"
                    >
                      <span>👁️</span> View Leads
                    </button>

                    <div className="flex items-center border-[1.5px] border-[#1E1B18] rounded-xl overflow-hidden shadow-sketch-sm bg-white">
                      <button
                        type="button"
                        onClick={() => handleExportRun(run, 'CSV')}
                        className="px-2.5 py-1.5 text-[11px] font-bold text-[#1E1B18] hover:bg-[#FFE7DC] transition-colors"
                        title="Export CSV"
                      >
                        CSV
                      </button>
                      <span className="text-[#D9D0C1]">|</span>
                      <button
                        type="button"
                        onClick={() => handleExportRun(run, 'PDF')}
                        className="px-2.5 py-1.5 text-[11px] font-bold text-[#1E1B18] hover:bg-[#FFE7DC] transition-colors"
                        title="Export PDF"
                      >
                        PDF
                      </button>
                      <span className="text-[#D9D0C1]">|</span>
                      <button
                        type="button"
                        onClick={() => handleExportRun(run, 'DOCX')}
                        className="px-2.5 py-1.5 text-[11px] font-bold text-[#1E1B18] hover:bg-[#FFE7DC] transition-colors"
                        title="Export Word DOCX"
                      >
                        DOCX
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteRun(run.id)}
                      className="w-8 h-8 rounded-xl border-[1.5px] border-[#1E1B18] bg-white hover:bg-[#FFEBEE] text-[#C62828] flex items-center justify-center text-xs font-bold shadow-sketch-sm transition-colors"
                      title="Delete hunt record"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs font-mono">
                  <div className="p-2.5 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5]">
                    <span className="text-[10px] text-[#766E65] block">Candidates Found</span>
                    <span className="font-bold text-sm text-[#1E1B18]">{run.discoveredCount}</span>
                  </div>

                  <div className="p-2.5 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5]">
                    <span className="text-[10px] text-[#766E65] block">Researched</span>
                    <span className="font-bold text-sm text-[#1E1B18]">{run.extractedCount}</span>
                  </div>

                  <div className="p-2.5 bg-[#E8F5E9] rounded-xl border border-[#C8E6C9]">
                    <span className="text-[10px] text-[#2E7D32] block font-bold">Qualified Leads</span>
                    <span className="font-bold text-sm text-[#2E7D32]">{run.qualifiedCount}</span>
                  </div>

                  <div className="p-2.5 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5]">
                    <span className="text-[10px] text-[#766E65] block">Rejected (Non-Fit)</span>
                    <span className="font-bold text-sm text-[#C62828]">{run.rejectedCount}</span>
                  </div>

                  <div className="p-2.5 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5]">
                    <span className="text-[10px] text-[#766E65] block">Verified Contacts</span>
                    <span className="font-bold text-sm text-[#FF6B35]">{run.verifiedEmailsCount}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
