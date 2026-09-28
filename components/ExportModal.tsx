'use client';

import { useState } from 'react';
import { CompanyRecord } from '@/lib/types';
import { downloadCsvFile, downloadPdfFile, downloadDocxFile } from '@/lib/export';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: CompanyRecord[];
  onToast: (msg: string) => void;
}

export default function ExportModal({ isOpen, onClose, companies, onToast }: ExportModalProps) {
  const [includeEvidence, setIncludeEvidence] = useState(true);
  const [includeTimestamp, setIncludeTimestamp] = useState(true);
  const [isExporting, setIsExporting] = useState<string | null>(null);

  if (!isOpen) return null;

  const count = companies.length;

  const handleExport = async (format: 'CSV' | 'PDF' | 'DOCX') => {
    setIsExporting(format);
    try {
      const today = new Date().toISOString().split('T')[0];
      const options = { includeEvidence, includeTimestamp };

      if (format === 'CSV') {
        downloadCsvFile(companies, `huntlyst-qualified-leads-${today}.csv`, options);
        onToast(`Exported ${count} leads as CSV spreadsheet! 📥`);
      } else if (format === 'PDF') {
        downloadPdfFile(companies, `huntlyst-discovery-report-${today}.pdf`, options);
        onToast(`Exported ${count} leads as branded PDF report! 📄`);
      } else if (format === 'DOCX') {
        await downloadDocxFile(companies, `huntlyst-discovery-report-${today}.docx`, options);
        onToast(`Exported ${count} leads as Microsoft Word document! 📝`);
      }
      onClose();
    } catch (err: any) {
      onToast(`Export error: ${err.message || 'Failed to generate file'}`);
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E1B18]/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="paper-card bg-[#FFFDF9] max-w-xl w-full rounded-2xl p-6 sm:p-7 relative shadow-sketch-lg space-y-6">
        {/* Tape decoration */}
        <div className="tape-strip" />

        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-[#F0EAD8] pb-4 pt-1">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📦</span>
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#1E1B18]">
                Take your research with you.
              </h3>
            </div>
            <p className="font-hand text-sm text-[#FF6B35] font-bold mt-1">
              {count} qualified {count === 1 ? 'lead' : 'leads'} ready to export
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border-[1.5px] border-[#2C2724] bg-white hover:bg-[#F0EAD8] flex items-center justify-center font-bold text-sm shadow-[1px_2px_0px_#2C2724]"
            aria-label="Close export modal"
          >
            ✕
          </button>
        </div>

        {/* 3 Export Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* CSV Card */}
          <button
            onClick={() => handleExport('CSV')}
            disabled={count === 0 || !!isExporting}
            className="p-4 rounded-xl border-[1.8px] border-[#2C2724] bg-white hover:bg-[#FFE7DC] hover:border-[#FF6B35] text-left transition-all shadow-sketch hover:shadow-sketch-hover group flex flex-col justify-between"
          >
            <div>
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">📊</div>
              <div className="font-bold text-sm text-[#1E1B18]">CSV File</div>
              <div className="font-sans text-[11px] text-[#5A544E] mt-1 leading-tight">
                Structured spreadsheet data for Excel, Sheets, or CRM.
              </div>
            </div>
            <div className="mt-4 pt-2 border-t border-[#F0EAD8] font-mono text-[10px] text-[#FF6B35] font-bold">
              {isExporting === 'CSV' ? 'Exporting...' : 'Download .csv →'}
            </div>
          </button>

          {/* PDF Card */}
          <button
            onClick={() => handleExport('PDF')}
            disabled={count === 0 || !!isExporting}
            className="p-4 rounded-xl border-[1.8px] border-[#2C2724] bg-white hover:bg-[#FFE7DC] hover:border-[#FF6B35] text-left transition-all shadow-sketch hover:shadow-sketch-hover group flex flex-col justify-between"
          >
            <div>
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">📄</div>
              <div className="font-bold text-sm text-[#1E1B18]">PDF Report</div>
              <div className="font-sans text-[11px] text-[#5A544E] mt-1 leading-tight">
                Branded executive intelligence report with dossier audit.
              </div>
            </div>
            <div className="mt-4 pt-2 border-t border-[#F0EAD8] font-mono text-[10px] text-[#FF6B35] font-bold">
              {isExporting === 'PDF' ? 'Generating...' : 'Download .pdf →'}
            </div>
          </button>

          {/* Word Card */}
          <button
            onClick={() => handleExport('DOCX')}
            disabled={count === 0 || !!isExporting}
            className="p-4 rounded-xl border-[1.8px] border-[#2C2724] bg-white hover:bg-[#FFE7DC] hover:border-[#FF6B35] text-left transition-all shadow-sketch hover:shadow-sketch-hover group flex flex-col justify-between"
          >
            <div>
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">📝</div>
              <div className="font-bold text-sm text-[#1E1B18]">Word (.docx)</div>
              <div className="font-sans text-[11px] text-[#5A544E] mt-1 leading-tight">
                Editable Microsoft Word research report with formatted tables.
              </div>
            </div>
            <div className="mt-4 pt-2 border-t border-[#F0EAD8] font-mono text-[10px] text-[#FF6B35] font-bold">
              {isExporting === 'DOCX' ? 'Building...' : 'Download .docx →'}
            </div>
          </button>
        </div>

        {/* Export Options / Inclusions */}
        <div className="p-3.5 bg-[#FAF6EE] rounded-xl border border-[#DED4C0] space-y-2 text-xs">
          <div className="font-bold text-[#1E1B18] font-hand text-sm">Export Options</div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-[#3E3832]">
              <input
                type="checkbox"
                checked={includeEvidence}
                onChange={e => setIncludeEvidence(e.target.checked)}
                className="w-4 h-4 text-[#FF6B35] rounded border-[#2C2724]"
              />
              <span>Include audit evidence sources</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-medium text-[#3E3832]">
              <input
                type="checkbox"
                checked={includeTimestamp}
                onChange={e => setIncludeTimestamp(e.target.checked)}
                className="w-4 h-4 text-[#FF6B35] rounded border-[#2C2724]"
              />
              <span>Include generation timestamp</span>
            </label>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-2">
          <span className="font-hand text-xs text-[#8C847A]">
            Compatible with Excel, Google Docs, Word &amp; Notion
          </span>
          <button
            onClick={onClose}
            className="btn-sketch-secondary px-4 py-1.5 text-xs"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
