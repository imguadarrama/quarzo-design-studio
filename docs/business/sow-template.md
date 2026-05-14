# Statement of Work — Template

> Fork this file into the client's project folder, fill in every placeholder, and have **both parties sign before any code is written**. The Exclusions section is the single most important thing in this document — it is what protects you from scope creep and the client from surprise costs.
>
> This is a starting template, not legal advice. Have a Mexican lawyer review before using with a non-family client.

---

## Project information

- **Project name:** {{Project name}}
- **Client:** {{Client legal name, RFC if applicable}}
- **Service provider:** {{Your legal name / RFC}}
- **Effective date:** {{YYYY-MM-DD}}
- **SoW version:** 1.0
- **Estimated delivery date:** {{YYYY-MM-DD}}

## 1. Scope summary

{{One paragraph describing what you're building, for whom, and why. Two or three sentences. Should be readable by a non-technical reader.}}

## 2. Inclusions

The following is what is being built and delivered as part of this engagement.

- {{Feature 1 — be specific. "Customer authentication with email + password, including forgot-password flow via email"}}
- {{Feature 2}}
- {{Feature 3}}
- ...

If a capability is not listed here, it is not in scope. See section 3.

## 3. Exclusions (out of scope)

The following are explicitly **NOT** part of this engagement. They may be added later via a Change Order (section 9) at additional cost.

- {{e.g. Multi-language support}}
- {{e.g. Wholesale / B2B pricing tiers}}
- {{e.g. Subscription products}}
- {{e.g. Mobile native apps (iOS / Android)}}
- {{e.g. Live chat / customer support widget}}
- {{e.g. Loyalty / points program}}
- {{e.g. Email marketing campaigns / newsletter sender}}
- {{e.g. Inventory / stock tracking}}
- {{Copy everything from the Discovery Checklist's "Out of scope" section into here, verbatim}}

## 4. Deliverables

At project completion, the client receives:

- Production-deployed application at {{domain}}
- Source code in a Git repository ({{owned by client | owned by provider | shared}})
- Admin user account with initial credentials
- {{Number}} hours of handover / training session(s) — see section 7
- Written handover documentation covering: deploy process, admin tasks, environment variables, third-party service accounts
- Access to all third-party service accounts created on the client's behalf ({{list}})

## 5. Milestones

| # | Milestone | Deliverable | Estimated date | Payment |
|---|---|---|---|---|
| 0 | Contract signed | This SoW signed by both parties | {{date}} | {{e.g. 30% — MXN $X}} |
| 1 | {{Milestone 1 name}} | {{What the client can see/test}} | {{date}} | {{e.g. 0%}} |
| 2 | {{Milestone 2 name}} | {{...}} | {{date}} | {{e.g. 30% — MXN $X}} |
| 3 | Launch | Production deploy, handover, training complete | {{date}} | {{e.g. 40% — MXN $X}} |

Milestone acceptance: the client has **{{N}} business days** after each milestone to review and either accept or list specific blocking issues in writing. Silence past that window counts as acceptance.

## 6. Payment terms

- **Total project price:** **MXN $X,XXX.XX** (before tax / IVA if applicable)
- **Payment schedule:** as listed in section 5
- **Payment method:** {{bank transfer / MercadoPago / etc.}}
- **Invoicing:** {{factura emitida al RFC del cliente | recibo simple}}
- **Late payments:** work pauses if any invoice is more than {{N}} business days overdue. Resumption requires the overdue amount to be settled in full; the delivery date shifts by the corresponding number of days.

## 7. Acceptance criteria

The project is considered "complete" when **all** of the following are true:

- All inclusions in section 2 are functional in production
- No open issues classified as "blocker" or "critical" (defined as: prevents a customer from completing a purchase, or prevents the admin from running the business)
- Handover documentation has been delivered
- Training session(s) have been delivered
- The application has been live in production for {{N}} business days without any blocker / critical regressions

## 8. Warranty

For **{{N}} days** after the launch date, the provider will fix any defect (a deviation from the inclusions in section 2) at no additional cost.

The warranty does NOT cover:

- New features or changes to behavior described in inclusions
- Issues caused by client-side changes (admin edits, third-party integrations the client added, data corruption from client error)
- Issues caused by third-party services the provider does not control (MercadoPago outage, hosting provider outage, etc.)
- Browser bugs in browsers outside the supported list (section 12)

After the warranty period, fixes are billed at the hourly rate in section 10.

## 9. Change order clause

Any work outside section 2's inclusions — including but not limited to features the client did not mention during discovery, features the client believes should have been "obvious," and changes to already-accepted milestones — is handled as a **Change Order**:

1. Client requests the change in writing (email is fine).
2. Provider responds within **{{N}} business days** with: a description of the change, estimated additional time, and additional cost.
3. Client signs the Change Order (email reply with "I accept" is fine) before work begins.
4. Change Orders may shift the project delivery date; the new date is part of the Change Order.

No verbal change requests are honored. If it isn't written down, it didn't happen.

## 10. Hourly rate for out-of-scope and post-warranty work

**MXN $X / hour**, billed in 15-minute increments, invoiced monthly.

## 11. Client responsibilities

The client agrees to:

- Provide brand assets (logo, fonts, photography) by {{date}}
- Provide content (product names, descriptions, prices, images) by {{date}}
- Own and pay for: domain registration, hosting (if billed in client name), third-party service accounts (MercadoPago, email provider, etc.)
- Respond to questions and review milestones within **{{N}} business days**
- Designate a single point of contact for decisions: **{{name, role, email}}**

Delays in any of the above shift the delivery date by the same number of days. The provider is not liable for missed dates caused by client delays.

## 12. Technical scope

- **Supported browsers:** latest 2 versions of Chrome, Safari, Edge, Firefox (desktop & mobile)
- **Supported devices:** mobile-first; tested on iOS Safari and Android Chrome
- **Languages:** {{Spanish (Mexico)}}
- **Hosting:** {{provider, who pays, who owns the account}}
- **Domain:** {{owned by client / provider / shared}}
- **Data ownership:** all customer data, product data, and order data is owned by the client. Provider keeps a backup until the warranty period ends.

## 13. Confidentiality

Both parties agree not to share business information learned during the engagement (financials, customer data, internal processes) with third parties, except as required by law.

The provider may reference the project publicly (portfolio, case study) **{{30 / 60 / 90}}** days after launch, including screenshots and a high-level description, unless the client objects in writing.

## 14. Termination

Either party may terminate this SoW in writing with **{{N}} business days** notice. On termination:

- The client pays for all work completed up to the termination date (pro-rated against milestones).
- The provider delivers all completed work, source code, and accounts.
- No refunds on milestones already accepted.

## 15. Governing law

This agreement is governed by the laws of {{Coahuila, Mexico}}.

---

## Signatures

**Service provider:**
Name: {{...}}
Signature: ___________________
Date: ___________________

**Client:**
Name: {{...}}
Signature: ___________________
Date: ___________________
