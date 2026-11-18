# Ajith Reddy — Frontend portfolio

[Portfolio](https://ajith-reddy-frontend.netlify.app/) · [Atelier Edit](https://ajith-atelier-edit.netlify.app/) · [Job Scheduler](https://ajith-flowforge-scheduler.onrender.com/)

A deployable React portfolio with a project directory, résumé, source-grounded Gemini assistant, and links to independently deployed full-stack applications. Every public repository is listed with context; only verified live applications appear in the deployment section. Country Delight's Model Trainer is presented as an internal-tool case study.

## Portfolio navigation

The opening page pairs the personal information card with a stacked deck of five live project cards. Exposed card edges remain visible; hover, wheel scrolling, arrow keys, and the previous/next buttons fan a card forward. Clicking the revealed card opens the project. On touch, tap an edge to preview, then tap the active card to open; horizontal swipes also browse the deck. The About section and About navigation are removed. Detailed case studies and the searchable 26-repository directory live on `projects.html`, reached through the Projects navigation or the main call to action. The profile assistant is available on both pages.

## Atelier Edit

Atelier is now an independent full-stack application at https://ajith-atelier-edit.netlify.app/. Its independently installable source is in [`apps/atelier-edit`](apps/atelier-edit), with its own package, API, database migrations, tests, and deployment configuration. Accounts, bags, favourites, catalogue inventory, orders, and order events are stored in its own PostgreSQL database. It has direct product pages, versioned cart saves, guest-to-account merges, server-priced idempotent checkout, order history, and cancellation with exactly-once stock restoration.

The former `/atelier.html` URL redirects to the independent application. Historical co-hosted source and immutable database migrations remain for compatibility. The root build still serves the portfolio and profile assistant. Atelier's own README contains its run/test/deploy instructions and demo limitations.

## ShopSphere

[Live product workspace](https://ajith-shopsphere.netlify.app/) · [Source](https://github.com/ajithreddy1234/ShopSphere). The original React interface now deploys with a PostgreSQL API adapter. Browser-isolated workspaces provide persistent product CRUD, server validation, and optimistic edit versions. The Express/Mongoose backend remains in source for historical/local use.

## Profile assistant

The persistent side launcher opens a conversation drawer. `/api/profile-assistant` calls Gemini through Netlify AI Gateway, keeping provider access on the server. The prompt allows natural greetings, thanks, brief pleasantries, and questions about the assistant’s capabilities. Substantive answers are limited to Ajith and projects supported by his résumé or public GitHub. Unrelated requests, including general programming explanations, are redirected without answering their topic. A greeting or previous off-topic question cannot bypass that boundary. Profile claims require approved citations. Offline source lookup requires a profile or named-project anchor instead of matching technology keywords alone. It does not use external search or private repositories. Input size, fixed source links, origin checks, and rate limits bound the endpoint.

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
