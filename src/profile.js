export const profile = {
  name: 'Ajith Reddy Pochimireddy',
  email: 'ajithreddy.pr@gmail.com',
  github: 'https://github.com/ajithreddy1234',
  linkedin: 'https://www.linkedin.com/in/ajith-reddy-p',
  resume: './Ajith_Reddy_Frontend_Resume.pdf',
};

export const projects = [
  {
    id: 'atelier',
    title: 'Atelier Edit',
    type: 'Full-stack storefront · Live',
    description: 'A jewellery storefront from discovery to checkout, with live inventory, server-priced orders, receipts, and browser-specific order history.',
    stack: ['React', 'Redux Toolkit', 'PostgreSQL', 'Netlify Functions'],
    brief: 'Give shoppers a clear path from browsing a small collection to choosing a variant and reviewing their bag.',
    decisions: [
      'Search, categories, material, and price filters combine with sorting. The catalogue has explicit loading, empty, and retry states.',
      'Redux Toolkit manages shared bag and wishlist state. Bag lines use a product and variant pair, so different ring sizes can coexist.',
      'Server functions price every order from the trusted catalogue. A Postgres transaction reserves stock and stores the receipt; retry references prevent duplicate orders.',
    ],
    demo: './atelier.html',
    source: 'https://github.com/ajithreddy1234/ajith-frontend-portfolio',
  },
  {
    id: 'pipeline',
    title: 'FlowForge',
    type: 'Job Scheduler · Full-stack sandbox',
    description: 'The original visual Job Scheduler: build a graph, preview SQL, apply transforms, save a version, and inspect real scheduled execution logs.',
    stack: ['React', 'FastAPI', 'SQLAlchemy'],
    brief: 'Recurring reports can span SQL queries, spreadsheet handoffs, and scheduling scripts. The interface gives operators one place to see the pipeline and its execution.',
    decisions: [
      'Represented extraction, transformation, and delivery as distinct steps in a reusable workflow.',
      'Paired the React workflow UI with FastAPI execution services, scheduling, queued run states, and execution logs.',
      'Kept SQL drafting separate from execution so generated queries could be reviewed before a run.',
      'The public sandbox uses synthetic orders and server-written CSV. External source connections and AI SQL drafting are available in the private deployment code.',
    ],
    demo: 'https://ajith-flowforge-scheduler.onrender.com/',
    source: 'https://github.com/ajithreddy1234/FlowForge-ETL-Workflow-Automation-with-SQL-Assistant',
  },
  {
    id: 'invoice',
    title: 'Invoice Exception Review',
    type: 'Zamp assignment · Deployed application',
    description: 'An accounts-payable review desk that connects extracted invoice fields to source evidence, procurement checks, and an audited approval trail.',
    stack: ['React', 'FastAPI', 'PostgreSQL'],
    brief: 'Make an invoice decision explainable: what the source says, which procurement rules pass, and what the reviewer must resolve. The deployed workspace requires an administrator-provisioned login.',
    decisions: [
      'Linked extracted fields to page and quote evidence, with explicit unknown states for unreadable or missing information.',
      'Kept review corrections, acceptance, purchase-order commitments, and spreadsheet publication as separate actions.',
      'Stored eligible acceptances transactionally, with duplicate protection and an audit trail. The application does not execute payments.',
    ],
    demo: 'https://asa-invoice-review.onrender.com/',
    source: 'https://github.com/ajithreddy1234/Invoice-Exception-Review-and-Approval-Workflow',
    access: 'Workspace login required',
  },
  {
    id: 'trainer',
    title: 'Model Trainer',
    caseStudy: './model-trainer.html',
    type: 'Internal tool · Country Delight',
    description: 'A workspace for setting up image datasets, monitoring training, reviewing model fit, and exporting results.',
    stack: ['React', 'Flask', 'PyTorch'],
    brief: 'Computer-vision training involves dataset setup, metrics, logs, and exports. The tool brings those steps together in a single workspace.',
    decisions: [
      'Supported dataset setup for image classification and object detection.',
      'Grouped training metrics, loss views, and fit diagnostics so a run could be investigated from the interface.',
      'Included run history, detailed logs, scheduled inference, and model export in the same workflow.',
    ],
  },
];

export const experience = [
  {
    role: 'AI/ML Intern',
    company: 'Country Delight',
    date: 'May–Aug 2026',
    description: 'Built an internal computer-vision training workspace. Also worked on business API routing, caching, and Langfuse observability for an existing support chatbot.',
  },
  {
    role: 'Media & Public Relations Secretary',
    company: 'IIT Hyderabad',
    date: 'Jun 2025–May 2026',
    description: 'Coordinated official web updates, announcements, and publication timelines with institute and event teams.',
  },
];

export const deployedApps = [
  { title: 'Atelier Edit', label: 'Shop, compare & place a demo order', href: './atelier.html', icon: './atelier-mark.svg', access: 'Open demo' },
  { title: 'FlowForge', label: 'Original Job Scheduler & pipeline editor', href: 'https://ajith-flowforge-scheduler.onrender.com/', icon: './flowforge-mark.svg', access: 'Open sandbox' },
  { title: 'Invoice Review', label: 'Zamp assignment · invoice decisions', href: 'https://asa-invoice-review.onrender.com/', icon: './invoice-mark.svg', access: 'Workspace login' },
  { title: 'Kuku Promo Finder', label: 'Source-timed screenplay promo discovery', href: 'https://kuku-promo-finder.onrender.com/', icon: './promo-mark.svg', access: 'Open application' },
];
