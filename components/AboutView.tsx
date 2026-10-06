'use client';

export default function AboutView() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in duration-200">
      {/* Hero Banner */}
      <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 sm:p-8 relative shadow-sketch-sm border-2 border-[#1E1B18] space-y-4">
        <div className="tape-strip" />

        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#FFE7DC] text-[#FF6B35] border border-[#FF6B35]/30">
              ⚡ Autonomous Company Discovery & Lead Intelligence
            </span>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#1E1B18]">
              About Huntlyst
            </h1>
            <p className="text-sm sm:text-base text-[#4A443D] leading-relaxed">
              Huntlyst is an autonomous company discovery and lead intelligence platform designed to turn
              open-web research into structured, qualification-ready company intelligence.
            </p>
          </div>

          <div className="p-3.5 bg-[#FAF6EE] rounded-xl border border-[#D9D0C1] text-right font-mono text-xs space-y-1">
            <span className="text-[#766E65] block">Target Focus</span>
            <span className="font-bold text-[#FF6B35] block text-sm">$1M–$5M Growth Tech</span>
            <span className="text-[#2E7D32] font-bold block">Global / Multi-Continent Geography</span>
          </div>
        </div>
      </div>

      {/* Core Principle: Missing Data is Better Than Invented Data (Section 18) */}
      <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 sm:p-7 relative shadow-sketch-sm border-2 border-[#FF6B35] space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚖️</span>
          <h2 className="font-display text-2xl font-bold text-[#1E1B18]">
            Core Principle: Missing data is better than invented data.
          </h2>
        </div>
        <p className="text-sm text-[#2C2724] leading-relaxed">
          Huntlyst does not treat unknown information as verified information. If a required field cannot
          be reliably substantiated from authentic corporate registries, news sources, or live domain
          telemetry, <strong>it remains blank or the lead is rejected</strong>.
        </p>
        <p className="text-xs text-[#766E65] font-mono leading-relaxed">
          In venture intelligence, false positives waste valuable partner time. We prioritize factual evidence,
          authoritative DNS confirmation, and verifiable financial records over synthetic completions.
        </p>
      </div>

      {/* 1. What Huntlyst Does */}
      <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 sm:p-7 relative shadow-sketch-sm border-2 border-[#1E1B18] space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          <h2 className="font-display text-2xl font-bold text-[#1E1B18]">
            What Huntlyst Does
          </h2>
        </div>
        <p className="text-sm text-[#2C2724] leading-relaxed">
          High-growth technology platforms outside the United States often build significant market traction
          before entering traditional Silicon Valley venture channels. Huntlyst conducts continuous, autonomous
          investigative research across regional tech hubs, parsing startup directories, venture databases,
          funding wires, and corporate registries to surface high-potential partners.
        </p>
      </div>

      {/* 2. How It Works */}
      <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 sm:p-7 relative shadow-sketch-sm border-2 border-[#1E1B18] space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚙️</span>
          <h2 className="font-display text-2xl font-bold text-[#1E1B18]">
            How It Works
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] space-y-1">
            <span className="font-mono font-bold text-[#FF6B35]">01 • DISCOVERY</span>
            <p className="font-bold text-[#1E1B18]">Multi-Source Scanning</p>
            <p className="text-[#5A544E]">Aggregates candidates from curated European, Asian, and regional venture feeds.</p>
          </div>
          <div className="p-3.5 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] space-y-1">
            <span className="font-mono font-bold text-[#FF6B35]">02 • RESEARCH</span>
            <p className="font-bold text-[#1E1B18]">Entity Extraction</p>
            <p className="text-[#5A544E]">Extracts funding history, architecture type, leadership roster, and headquarters.</p>
          </div>
          <div className="p-3.5 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] space-y-1">
            <span className="font-mono font-bold text-[#FF6B35]">03 • VALIDATION</span>
            <p className="font-bold text-[#1E1B18]">Strict Profile Filtering</p>
            <p className="text-[#5A544E]">Applies deterministic gates for $1M–$5M capital, non-US presence, and tech platform focus.</p>
          </div>
          <div className="p-3.5 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] space-y-1">
            <span className="font-mono font-bold text-[#FF6B35]">04 • LEADERSHIP</span>
            <p className="font-bold text-[#1E1B18]">Founder Resolution</p>
            <p className="text-[#5A544E]">Identifies the CEO or Co-founder from corporate directories and verified team pages.</p>
          </div>
          <div className="p-3.5 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] space-y-1">
            <span className="font-mono font-bold text-[#FF6B35]">05 • VERIFICATION</span>
            <p className="font-bold text-[#1E1B18]">DNS MX Confirmation</p>
            <p className="text-[#5A544E]">Resolves authoritative mail server records to guarantee contact deliverability.</p>
          </div>
          <div className="p-3.5 bg-[#FAF6EE] rounded-xl border border-[#EBE4D5] space-y-1">
            <span className="font-mono font-bold text-[#FF6B35]">06 • QUALIFICATION</span>
            <p className="font-bold text-[#1E1B18]">Evidence Dossiers</p>
            <p className="text-[#5A544E]">Computes an evidence-derived Hunt Score and generates export-ready dossiers.</p>
          </div>
        </div>
      </div>

      {/* 3. Data Quality & Verification */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 relative shadow-sketch-sm border-2 border-[#1E1B18] space-y-3">
          <h3 className="font-display text-xl font-bold text-[#1E1B18] flex items-center gap-2">
            <span>🔍</span> Data Quality
          </h3>
          <p className="text-xs sm:text-sm text-[#4A443D] leading-relaxed">
            Every qualified company in Huntlyst includes verifiable citations. The system tracks the origin
            of funding announcements, verifies software architecture claims, and cross-references executive titles.
          </p>
        </div>

        <div className="paper-card bg-[#FFFDF9] rounded-2xl p-6 relative shadow-sketch-sm border-2 border-[#1E1B18] space-y-3">
          <h3 className="font-display text-xl font-bold text-[#1E1B18] flex items-center gap-2">
            <span>🛡️</span> Technical Stack
          </h3>
          <p className="text-xs sm:text-sm text-[#4A443D] leading-relaxed">
            Built on Next.js 14 App Router, TypeScript, Tailwind CSS, authoritative Node.js DNS resolvers,
            and Huntlyst venture intelligence with deterministic fallback scrapers.
          </p>
        </div>
      </div>

      {/* Subtle Evaluation Note (Section 19) */}
      <div className="p-4 bg-[#FAF6EE] rounded-xl border border-[#D9D0C1] text-center text-xs font-mono text-[#766E65]">
        <span>Huntlyst v2.4 • Configured for the current venture discovery evaluation profile.</span>
      </div>
    </div>
  );
}
