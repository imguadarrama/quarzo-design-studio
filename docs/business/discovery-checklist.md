# Discovery Checklist

Walk through this **after** the conversational discovery call, before quoting. Every "I'm not sure" is a follow-up question, not an assumption. Anything the client says is out of scope goes in the **Out of Scope** section at the bottom — that section is load-bearing for the SoW.

The categories below cover the typical web-app blind spots that turn a quote into a money-loser. If a question doesn't apply, mark it N/A and move on; don't skip silently.

---

## 1. The business

- One-sentence pitch — what do they sell, to whom?
- Top 3 customer types (and their relative volume)?
- What's the *real* reason customers pick them over competitors?
- What is currently working that the website must NOT break?
- What channel drives sales today (Instagram, Google, referrals, walk-in)?
- Brand assets: logo, colors, fonts, photography — do they exist, who owns them, what format?

## 2. Auth & accounts

- Customer accounts: required, optional, or guest-only?
- Registration fields (name, email, phone, address)?
- Email verification on signup — yes / no?
- **Forgot password — yes / no?** Email-based reset flow?
- Account lockout after N failed attempts?
- 2FA / MFA?
- Social login (Google, Facebook, Apple) — yes / no?
- Profile edit (name, email, password change)?
- Multiple admins or single admin?
- Admin password reset flow — same as customer, or different?
- Session lifetime / "remember me" behavior?
- Logout-everywhere capability?

## 3. Email & notifications

- Transactional emails needed (which events)?
  - Order confirmation
  - Payment received / failed
  - Shipping notification with tracking
  - Password reset
  - Email verification
  - Account changes
- Marketing emails — in scope for v1?
- Sender domain — does the client own a domain to send from?
- Deliverability provider preference (Resend, SES, SendGrid, Postmark)?
- Email templates — who designs them, who writes copy?
- SMS / WhatsApp notifications?
- Push notifications?

## 4. Products & catalog

- How many products at launch? Year 1 growth?
- Variant model — by size, color, material? Average variants per product?
- Personalization — text input, image upload, both? Required or optional?
- Categories / collections — flat or nested?
- Search — full-text? Filters? Faceted search?
- Sort order — manual position, popularity, price, date?
- SEO — meta titles, descriptions, slugs, structured data?
- Product images — who provides, what resolution, how many per product?
- Stock / inventory tracking — yes / no?

## 5. Cart & checkout

- Guest checkout — yes / no?
- Saved cart for logged-in users?
- Coupons / discount codes — yes / no? Types (percent, fixed, free shipping)?
- Tax calculation — flat, by location, included in price?
- Multiple shipping addresses per account?
- Order notes / gift messages?
- Abandoned cart recovery — in scope for v1?

## 6. Payments

- Providers required (MercadoPago, Stripe, PayPal, OXXO, SPEI, bank transfer)?
- Refunds — partial, full, who initiates?
- Currency — single or multi?
- Payment retry on failure?
- Webhook handling — who monitors failures?
- Reconciliation — does the admin need a "payments dashboard"?

## 7. Shipping & fulfillment

- Shipping zones (national, international, local only)?
- Rate calculation (flat, by weight, by zone, free over $X)?
- Pickup option — which locations?
- Carrier integration (label generation, tracking)?
- Order status transitions — who updates them and how (admin UI, carrier webhook)?
- Estimated delivery time shown to customer?

## 8. Admin panel

- Resources the admin manages (products, orders, customers, categories, coupons, content)?
- Bulk operations (bulk price change, bulk status update, export to CSV)?
- Reports — sales by period, top products, customer LTV?
- Audit log — who changed what when?
- Multiple admin roles (super admin, content editor, fulfillment)?
- Multi-device — admin uses phone, desktop, both?

## 9. Hosting, ops, & domain

- Domain — does the client own it? Who manages DNS?
- Hosting preference — cloud (Fly, Vercel, Render), VPS, none?
- Email hosting — Google Workspace, M365, none?
- Backups — frequency, retention, who restores in a crisis?
- Monitoring & uptime — who gets paged at 3am?
- Expected uptime SLA (99%, 99.9%)?
- Disaster recovery expectation (RTO/RPO)?

## 10. Legal & compliance (MX)

- Aviso de Privacidad — provided by client, or do you draft?
- Términos y condiciones — same question?
- Cookies banner — required?
- RFC / tax data collection at checkout — required?
- Invoice (factura) generation — automated or manual?
- Age verification (alcohol, restricted goods)?

## 11. Devices, browsers, accessibility

- Mobile-first or desktop-first?
- Supported browsers (modern only, or legacy IE/Safari)?
- Accessibility level (none / AA / AAA)?
- Print stylesheets needed (invoices, receipts)?

## 12. Languages & i18n

- Single language or multi?
- Currency display — single or multi?
- Right-to-left support?

## 13. Analytics

- Google Analytics 4?
- Meta Pixel / TikTok Pixel?
- Conversion tracking — which events?
- Heatmaps (Hotjar, Microsoft Clarity)?
- Custom event dashboard?

## 14. Post-launch

- Training session — who, how long, format?
- Handover documentation — what level of detail?
- Bug warranty window — how many days of free fixes after launch?
- Ongoing maintenance — retainer, on-demand, or none?
- Hourly rate for post-launch changes — agreed upfront?

## 15. Out of scope (explicit)

> List everything the client mentioned, hinted at, or assumed — but that is **NOT** in v1. Copy this list verbatim into the SoW's Exclusions section. If a topic isn't here, the client can claim it was included.

- [ ] Example: Wholesale / B2B pricing
- [ ] Example: Subscription products
- [ ] Example: Multi-currency
- [ ] Example: Mobile app (iOS / Android)
- [ ] Example: Live chat
- [ ] Example: Loyalty / points program

---

## Checklist hygiene

When a new project surfaces a question that wasn't on this list — and the answer would have changed the quote — **add it permanently** to the relevant section above. The discovery checklist gets better every project.
