# Operational & Verification Rules — TVB Huntlyst

## 1. Golden Research Rules
1. **Never Invent Data**: If a factual field (CEO, funding, email, LinkedIn) cannot be confirmed by authentic fetched source pages, it remains `UNKNOWN` or `NOT_PUBLICLY_DISCLOSED`.
2. **Search Snippets Are Discovery Only**: Snippets must never be used as final factual evidence. Every verified fact requires reading the actual fetched HTML page.
3. **Role-Aware Leadership**:
   - Current CEO and Former CEO must be strictly distinct entities.
   - Founders and Co-Founders must be tracked independently.
4. **Funding Timeline Integrity**:
   - Total funding must never be conflated with the latest round amount.
   - Multi-round timelines must preserve instrument types, timestamps, and investor names.
5. **Contact Ethics**:
   - Never fabricate guessed email mailboxes (e.g. `{first}.{last}@{domain}`).
   - DNS MX verification is mandatory for deliverability confirmation.
   - Mailbox deliverability (`VERIFIED`) is distinct from domain MX routing (`UNKNOWN`).

## 2. Four Canonical Qualification Statuses
Only the following four statuses may be assigned to evaluated candidates:
- `VERIFIED`: Meets 100% of required investment profile criteria.
- `REVIEW`: Meets primary criteria but contains partial data or unverified optional signals.
- `UNVERIFIED`: Essential required criteria could not be verified from authoritative sources.
- `REJECTED`: Explicitly fails one or more deterministic criteria (e.g., US presence, funding out of bounds).
