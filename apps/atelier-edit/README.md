# Atelier Edit

[Live store](https://ajith-atelier-edit.netlify.app/)

A standalone full-stack jewellery commerce application. This directory is independently installable and deployable; it shares no runtime, database, account system, or portfolio navigation with the portfolio site.

## What works

- PostgreSQL product catalogue and variant inventory, category/material/price filters, search, sorting, comparison, and direct `/pieces/:id` product pages.
- Guest sessions, username/password accounts, sign-in/sign-out, server-backed shopping bags and saved pieces. Guest bags and favourites merge into the account on sign-in; guest orders are claimed by that account.
- Optimistic cart versions prevent silent overwrites from another tab. Saves are serialized and retried explicitly after failure. No password or bearer session token is stored in browser storage.
- Server-priced checkout, delivery options, atomic stock reservations, idempotent checkout references, stored order receipts and an order timeline.
- Account-scoped order history. Confirmed demo orders can be cancelled; stock is restored once in the same transaction. Repeated cancellation is safe.
- Responsive catalogue, product page, accessible native dialogs, stock availability, loading/error/empty states, and reduced-motion support.

## Stack and data model

React 19, Redux Toolkit, Vite, Netlify Functions, and managed PostgreSQL (`@netlify/database`). Tables cover products, inventory, customers, hashed sessions, versioned carts, orders, and order events. All SQL accepts parameters. Transactions use a single checked-out connection. Applied SQL migrations are immutable and deploy automatically.

Passwords use salted scrypt (N=32768, r=8, p=3). Session tokens use 32 random bytes; only SHA-256 digests are stored in PostgreSQL. Cookies are HttpOnly, Secure, SameSite=Lax, scoped to the API, and expire after 30 days. Authentication rotates the token and revokes the prior session. Mutation endpoints require the application's origin. API routes have rate limits. Public responses never include password hashes or session tokens. Demo accounts use usernames without email and do not provide password recovery.

## Run and deploy

Node 22.12+:

```sh
npm ci
npm test
npm run build
netlify dev
```

`netlify dev` starts the frontend, Functions and local database. `npm run dev` alone only serves the UI. Deploy the project root, including Functions and committed migrations:

```sh
netlify deploy --build
netlify deploy --build --prod
```

The `.netlify/` site link, environment files, installed dependencies and build output are ignored. No provider keys or manually configured database credentials are needed on Netlify. Production migrations reach the database through deploys, not manual schema edits.

## Validation and limits

Integration tests exercise server prices, receipt isolation, duplicate/reused checkout references, stock rejection, account creation/login/logout and token rotation, persistent carts, stale writes, guest merges, order ownership, event history, and exactly-once stock restoration. Netlify's local database does not emulate concurrent PostgreSQL transactions; row locks and conditional updates protect hosted writes.

This is a fictional, functioning commerce demo. It records demo orders; it does not charge money or arrange delivery. Products and prices are samples, and jewellery photography was generated for the project. Payment processing, email verification/recovery, fulfilment, and a merchant administration console are outside this release.
