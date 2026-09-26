# Mav AI production checklist

## What is now live in the codebase

- Server-side AI Permission Engine
- Supabase AI audit log
- Care Mode settings and scheduled task preparation
- Care Task approval and bulk routine execution
- Spoken Mav AI responses in supported browsers
- Secure tenant/landlord boundaries tightened in RLS
- Payment PRN generation and submission UI
- Trusted payment-provider verification endpoint
- Care Mode automatic approval only after provider verification
- Automatic payment allocation and receipt creation after verified approval
- Payment idempotency fields and provider transaction uniqueness for PRN records
- Mav AI production health endpoint at /api/health

## Required Vercel environment variables

Keep these server-side only:

- SUPABASE_URL
- SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY
- GEMINI_API_KEY (only if natural-language Gemini answers are desired)
- GEMINI_MODEL (optional)
- MAVRENT_PAYMENT_WEBHOOK_SECRET

Never place the service-role/secret key or webhook secret in browser JavaScript.

## Payment provider webhook contract

POST /api/payment-prn

Send:

{
  "action": "verify_webhook",
  "provider": "provider-name",
  "provider_transaction_id": "unique-provider-transaction-id",
  "prn": "MVR...",
  "amount": 450000
}

The request must include:

X-MavRent-Signature: sha256=<HMAC-SHA256>

The HMAC secret is MAVRENT_PAYMENT_WEBHOOK_SECRET.

Mav AI verifies:

1. Provider signature
2. PRN exists
3. PRN is not expired
4. Provider transaction ID has not already been processed
5. Provider amount exactly equals PRN amount
6. PRN maps to an active tenant
7. Transaction reference is not already represented by a payment

Only then is the PRN marked verified. If the landlord has Care Mode enabled, Mav AI completes the approved routine payment flow, allocates the payment to rent, creates a receipt and notifies the tenant. Otherwise it remains verified for landlord approval.

A PRN entered by a tenant is never treated as proof of payment.

## Auth hardening

Supabase currently reports no remaining database security linter errors for Mav AI's views/functions/RLS changes. One dashboard-level warning remains: leaked-password protection is disabled.

Enable leaked-password protection in Supabase Auth settings. Supabase documents this under Auth password security.

## Native voice roadmap

The browser version supports microphone input and spoken responses when the browser permits them. System-level phrases such as "Hey Siri, ask Mav AI..." require a native iOS integration. Apple recommends App Intents for modern Siri/Apple Intelligence integration.

Native Android assistant integration should be added to the Android shell after the web/PWA production pilot is stable.

## Launch order

1. Configure the webhook secret and provider adapter.
2. Enable leaked-password protection.
3. Test landlord/tenant isolation with two separate accounts.
4. Test PRN issue -> payment -> provider webhook -> Care Mode approval.
5. Test duplicate provider callbacks.
6. Test expired PRNs and amount mismatches.
7. Test receipt creation and rent allocation.
8. Test Care Mode routine tasks.
9. Test push notifications on actual Android and iPhone devices.
10. Run a private pilot before public launch.
