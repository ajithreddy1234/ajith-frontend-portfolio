# Ajith Reddy — Frontend portfolio

[Portfolio](https://ajith-reddy-frontend.netlify.app/) · [Atelier Edit](https://ajith-reddy-frontend.netlify.app/atelier.html) · [Job Scheduler](https://ajith-flowforge-scheduler.onrender.com/)

A deployable React portfolio with a project directory, résumé, source-grounded Gemini assistant, and a standalone full-stack jewellery storefront. Every public repository is listed with context; only verified live applications appear in the deployment section. Country Delight's Model Trainer is presented as an internal-tool case study.

## Portfolio navigation

The opening page pairs a coloured personal information card with a four-card live application showcase. Cards preview on hover or keyboard focus and open their application on click or tap. Detailed case studies and the searchable 26-repository directory live on `projects.html`, reached through the Projects navigation or the main call to action. The profile assistant is available on both pages.

## Atelier Edit

React and Redux Toolkit handle combined search, filters, sorting, product comparison, saved pieces, and a variant-aware bag. Netlify Functions serve the catalogue and checkout API. PostgreSQL stores inventory and orders.

- Server-owned catalogue prices and delivery fees; client-supplied totals are ignored.
- Atomic inventory reservation and order creation on one database connection.
- Browser-specific HttpOnly session cookie and scoped order history.
- Idempotency references for retries, with a conflict if an existing reference is reused with different items.
- Accessible dialogs, loading/retry/empty states, stock checks, receipts, and order history.

This is a fictional catalogue and a **demo checkout**. It records orders without collecting payment, addresses, or shipping personal information. Product photography was generated for this fictional collection with ImageGen.

## Profile assistant

The persistent side launcher opens a conversation drawer. `/api/profile-assistant` calls Gemini through Netlify AI Gateway, keeping provider access on the server. The prompt handles greetings and harmless general questions naturally. Claims about Ajith require evidence from the public résumé or his public GitHub profile/repository snapshot. It does not use external search or private repositories. Source lookup remains available during provider failures. Input size, fixed source links, origin checks, and rate limits bound the endpoint.

## Other work

- **FlowForge** links to the original React Flow/FastAPI Job Scheduler, with saved pipeline versions, Pandas execution, preview, APScheduler, run logs, and CSV output in its public synthetic-data mode. A daily GitHub Actions job executes and verifies the sample pipeline.
- **Invoice Exception Review** is the Zamp assignment, linked to its existing authenticated deployment.
- **Kuku Promo Finder** links to its existing deployment.
- The project directory includes research, notebooks, architecture studies, and archives without presenting them as live apps. Suspended deployments are excluded from the live list.

## Run, test, and deploy

Use Node.js 22.12+.

```sh
npm ci
npm test
npm run build
netlify dev
```

`netlify dev` provides the backend and local database; plain `npm run dev` previews the UI only. Keep database migration files under `netlify/database/migrations/`. Netlify provisions the managed database and applies migrations during deploys. Deploy using the Netlify CLI or Git integration, including `netlify/functions/`; uploading `dist/` alone does not deploy the backend.

```sh
netlify deploy --build
netlify deploy --build --prod
```

The deployed assistant uses Netlify AI Gateway. Local development may provide `GEMINI_API_KEY` through an untracked environment file. Never put provider keys in `VITE_` variables. Update the PDF and `src/resume-evidence.js` together. The repository snapshot is in `src/project-directory.js`; the verified deployments are in `src/profile.js`.

`npm test` verifies source restrictions, generated greeting behaviour, variant-aware basket state, trusted checkout prices, receipt isolation, replay protection, and stock rejection against Netlify's local database runtime. The local database does not emulate concurrent transactions; live PostgreSQL uses conditional stock updates inside a transaction.

The résumé PDF is intentionally excluded from public GitHub and protected by `.gitignore`. It remains available on the live portfolio and in the separately supplied downloads. For a fresh deployment, place the supplied PDF at `public/Ajith_Reddy_Frontend_Resume.pdf` locally before building. Do not commit that file.
