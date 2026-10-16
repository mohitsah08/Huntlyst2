# Huntlyst Internal Workflow Verification PRD

**Scope:** Stage 1 — Internal Workflow only  
**Status:** Implementation proposal and acceptance checklist  
**Source of current-state understanding:** The uploaded *Internal Workflow: Current State & Next Steps* report and the requirements clarified in the conversation. The report describes CSV/XLSX import, parsing, arranging, and display as current functionality, and explicitly says that the four-outcome verification engine is future work. It is not a code-level audit of every repository path.

## 1. Problem and goal

Internal Workflow currently prepares company records from uploaded data. Arranging a record for display does not mean it has passed target qualification. The next step is to apply the saved Internal Target Profile when the user explicitly runs **Run Internal Verification Pipeline**.

The first working mode is **Offline**. The engine evaluates uploaded fields against saved local rules only. It must not call the internal discovery API, online research, DNS, AI providers, or any network source when Offline is selected.

## 2. Scope boundaries

### In scope
- Stage 1 Internal upload/parse/arrange flow.
- Stage 1 Settings and Offline/Online mode controls.
- A saved, editable Internal Default Target Profile.
- A deterministic offline rules engine with four statuses.
- Reasons and criterion-level outcomes displayed with each Company Record.
- Input preservation, clean error handling, and regression tests.
- Downstream compatibility for records explicitly approved for a later stage.

### Out of scope
- Changing the External Research implementation.
- Changing Stage 3 Web Discovery.
- Implementing online verification now. The Online control is a placeholder and must explain that it is not wired yet.
- Claiming uploaded fields are independently true or current merely because they pass offline rules.
- Fabricating missing company, revenue, funding, stage, geography, executive, website, or email values.

## 3. Current input behavior

The agreed Internal file-upload scope is:
- CSV: .csv
- Excel workbook: .xlsx

Unsupported file types must be rejected with a clear message. Uploading a supported file reads and parses its rows/columns, arranges them into Company Records, and waits for the user to run verification. Importing or arranging data must never automatically mark records VERIFIED.

The raw source fields should remain available in the dossier/export path so every decision can be traced back to uploaded data.

## 4. Stage 1 control placement

Place the following controls together at the upper-right side of the **Stage 1: Internal Candidate Discovery & Verification** heading:
1. **Settings**: opens the Internal Workflow Settings modal.
2. **Offline / Online** segmented control:
   - Offline is the default on a fresh or refreshed session.
   - Offline is the implemented mode.
   - Online remains visibly selectable as a placeholder, but running it must display “Online verification is not wired yet” and must not make a request.
3. **Run Internal Verification Pipeline**:
   - Disabled until a supported file has been parsed into company records.
   - Runs the saved Internal Target Profile against the parsed records.
   - In Offline mode, performs no network calls.

Remove Settings, Online/Offline, and Verify controls from the Company Records toolbar. Company Records should remain the results/presentation surface, with search, filtering, export, View, and shortlist actions intact.

## 5. Internal Default Target Profile

Settings must save these criteria independently from the universal / external Target Profile:

| Setting | Required behavior |
|---|---|
| Industry | One or more target industries, such as Technology, Agriculture, Medical, Construction/Civil, or Food |
| Sub-industry | Optional finer-grained categories |
| Geography | Optional country, country group, or continent list |
| Annual revenue | Optional minimum and maximum annual revenue; target values are USD |
| Funding | Minimum and maximum funding; explicitly choose total funding or latest-round funding; target values are USD |
| Company stage | One or more configured stages |
| Company age | Optional minimum/maximum operating years, derived from age/founding year supplied in the file |
| Company website | Required, Optional, or Not Required |
| Company status | Active-company requirement is configurable in Verification Rules |
| Required fields | Company name and domain are always required; users may make other fields required |
| Executive details | Founder/CEO/co-founder/decision-maker requirements, using the dedicated executive settings |
| Email | Required / Optional / Not Required, using the dedicated email setting |
| Mandatory criteria | Each target match criterion can be mandatory or optional |
| Data handling | Missing information, invalid values, ambiguous fields, and conflicting input values are not silently guessed |

The saved Internal profile is independent of External Research's target profile. Editing Internal settings must not change External or Web Discovery settings.

## 6. Offline evaluation rules

The evaluator is deterministic and uses only the imported record plus saved Internal settings.

### Status definitions
- **VERIFIED**: all configured mandatory checks pass against the uploaded values and local rules.
- **UNVERIFIED**: a required value is missing or a required check cannot be evaluated from the imported record.
- **REVIEW**: a field is invalid, ambiguous, or conflicting, or a monetary value's currency cannot safely be compared with the USD threshold.
- **REJECTED**: at least one mandatory target criterion definitively fails.

### Decision order
1. If any mandatory criterion clearly fails, return **REJECTED**.
2. Otherwise, if there is ambiguous/invalid/conflicting data, return **REVIEW**.
3. Otherwise, if required information is missing, return **UNVERIFIED**.
4. Return **VERIFIED** only when all required criteria pass.

Company name and domain are always required. Missing information is not itself proof of ineligibility, so it must not be converted into REJECTED. Optional target criteria do not reject a company. A configured but missing mandatory range value results in UNVERIFIED.

Funding and revenue ranges are in USD. Offline evaluation must not convert INR/₹, EUR/€, GBP/£, lakh, or crore values into USD using a guessed rate. If a supplied amount cannot safely be compared with the configured USD range, return REVIEW with a clear reason.

### Meaning of Offline VERIFIED
Offline VERIFIED means: “The values supplied in this file pass the configured local rules.” It does **not** mean the website, revenue, funding, executives, email deliverability, or current company status was independently checked on the internet.

## 7. Result presentation

For each company, show:
- Status: VERIFIED / UNVERIFIED / REVIEW / REJECTED.
- Match score (supporting information only; score never overrides the status).
- Clear, human-readable reasons.
- Passed, failed, missing, and ambiguous criteria where applicable.
- The imported raw fields and source context in the existing dossier.

Do not show fabricated defaults as real facts. Missing display values should be shown as “Not disclosed” / “Not found”, while the underlying record remains missing.

## 8. Implementation in three phases

### Phase 1 — Internal controls and settings
- Move Settings and Offline/Online controls to the Stage 1 heading.
- Move Run Internal Verification Pipeline to the same control area.
- Remove verification controls from Company Records.
- Default every fresh/reloaded session to Offline.
- Add geography, revenue, funding basis, company age, website requirement, required fields, and mandatory/optional settings.
- Enforce CSV/XLSX upload scope and preserve imported data.

### Phase 2 — Deterministic offline verification engine
- Map the parsed canonical record and raw fields into explicit evaluation inputs.
- Apply only the saved Internal profile.
- Return the four statuses with criterion-level explanations.
- Wire the Stage 1 run button to this engine; no network/API calls in Offline mode.
- Keep Online visibly marked as not wired; do not simulate an online result.

### Phase 3 — Regression coverage and final QA
- Unit-test each outcome, missing/invalid/conflicting input, optional criteria, funding basis, range boundaries, and currency ambiguity.
- Test upload → parse → records → settings save → run → status/reasons.
- Confirm a refresh returns the mode to Offline and does not fabricate active verification results.
- Confirm External Research and Web Discovery source files are unchanged by this Internal-only task.
- Run npx tsc --noEmit, npm run test:internal-offline, npm test, and npm run build before merging or deploying.

## 9. Acceptance checklist

- [ ] A fresh session defaults to Offline.
- [ ] The control row is visible only in Stage 1's header; the Company Records toolbar has no Settings/Online-Offline/Verify controls.
- [ ] Only CSV/XLSX file uploads are accepted by the Internal uploader.
- [ ] Upload/parse alone does not set VERIFIED.
- [ ] The Stage 1 Run button invokes only local deterministic evaluation in Offline mode.
- [ ] Settings are saved and used by the next run.
- [ ] Missing company name/domain produces UNVERIFIED.
- [ ] Missing required fields produce UNVERIFIED.
- [ ] Ambiguous/conflicting/invalid values produce REVIEW unless a clear mandatory failure takes precedence.
- [ ] Definite mandatory mismatches produce REJECTED.
- [ ] Optional criteria do not reject a company.
- [ ] Every decision includes reasons; no factual defaults are fabricated.
- [ ] Online mode produces a “not wired yet” message and makes no online verification request.
- [ ] External Research and Web Discovery implementation remains unchanged.
- [ ] Tests, TypeScript check, and production build pass.
