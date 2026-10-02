# Huntlyst System Acceptance & Boundary Limitations

## 1. Email Verification Boundaries (Section 2 Compliance)
- **Company Email vs. Executive Email**: Company generic emails (`info@`, `support@`, `hello@`) are verified exclusively via DNS MX mail exchange lookups. They are NEVER converted into CEO email.
- **No Email Synthesis Guessing**: Patterns like `first.last@company.com` or `firstname@company.com` are NEVER guessed without external proof. When a CEO email is not publicly published, it is strictly reported as `NOT_PUBLICLY_DISCLOSED`.
- **DNS MX Scope**: DNS MX only proves that the company domain can receive email. It does NOT prove that a specific mailbox exists.

## 2. Social Media Verification Boundaries (Section 3 Compliance)
- **URL Syntax vs. Existence**: Valid URL syntax does NOT grant `VERIFIED` status. Profiles are cross-referenced with company name, executive title, and employment history.
- **Paywalled / Private Networks**: When LinkedIn or X requires authenticated sessions or CAPTCHAs, unverified profiles fail closed as `UNKNOWN` or `UNVERIFIED`.

## 3. Geography Architecture (Section 4 Compliance)
- **Legacy US Presence Removed**: Replaced by standard Geography criteria.
- **Global Target Profile**: Fully informational. All countries (including United States) are eligible without penalties.
- **Regional Target Profiles**: Strictly enforced using continent, country, and union logic.

## 4. Canonical Target Profile Unification
Internal CSV Ingestion, External Discovery, and Scheduled Automation use the exact same `evaluateCanonicalTargetQualification()` engine in `lib/validation.ts`.
