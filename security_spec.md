# Firebase Security Specification

## Data Invariants
1. A Company profile must have a valid non-empty `id`, `razonSocial`, `rif`, `fiscalYear`, and `periodData`.
2. `companyId` must be a sanitized alphanumeric identifier matching `^[a-zA-Z0-9_\-]+$` and `<= 128` characters.
3. Strings like `razonSocial` must not exceed 300 characters, and `rif` must not exceed 50 characters to prevent Denial-of-Wallet payload injection attacks.
4. Reads and writes allow authorized persistent access across sessions for managing Venezuelan company tax data.

## The "Dirty Dozen" Threat Payloads
1. **ID Injection Attack**: Attempting to pass a 5KB junk string as `companyId`.
2. **Payload Exhaustion**: Attempting to pass a 2MB string for `razonSocial`.
3. **Data Type Corruption**: Sending a boolean or array for `fiscalYear` instead of a integer.
4. **Field Stripping**: Deleting the required `rif` or `periodData` fields during update.
5. **Shadow Field Injection**: Adding unknown administrative keys like `isAdmin: true` or `systemBypass: true`.
6. **Path Traversal / Malformed Document ID**: Requesting `/companies/../../admin`.
7. **Invalid JSON Structure**: Passing corrupt data for `periodData`.
8. **Null Identifier Injection**: Setting `id` to null or empty string.
9. **Extreme Year Boundary Violation**: Setting `fiscalYear` to negative numbers or extreme floats.
10. **Spoofed Ownership**: Attempting to alter structural company keys during updates.
11. **Unauthenticated Malicious Wipes**: Requesting delete without proper document match.
12. **Mass Document Pollution**: Creating bulk documents with blank names.

## Verification TDD
Rules enforce strict type checks, length constraints, regex identifier guards, and strict required property validation on all writes.
