import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider, useDispatch, useSelector } from 'react-redux';
import '@fontsource-variable/dm-sans';
import './styles.css';
import { deployedApps, profile, projects } from './profile.js';
import { repositoryProjects } from './project-directory.js';
import { fallbackAnswer, prompts } from './evidence.js';
import { chatActions, portfolioStore } from './store.js';
import { TrainerVisual } from './trainer-visual.jsx';

function Arrow({ direction = 'diagonal' }) {
  return <span aria-hidden="true">{direction === 'right' ? '→' : '↗'}</span>;
}

function LiveAppPreview({ id }) {
  if (id === 'atelier') return <div className="live-app-preview preview-atelier" aria-hidden="true"><img src="./atelier-hero.webp" alt="" fetchPriority="high" /></div>;
  if (id === 'pipeline') return <div className="live-app-preview preview-pipeline" aria-hidden="true"><div className="preview-flow"><span><i>01</i>SQL<small>Extract</small></span><b>→</b><span><i>02</i>Pandas<small>Transform</small></span><b>→</b><span><i>03</i>CSV<small>Deliver</small></span></div></div>;
  if (id === 'invoice') return <div className="live-app-preview preview-invoice" aria-hidden="true"><div><span>Source evidence</span><b>Page + quote</b></div><div><span>Procurement</span><b>Rule checks</b></div><div><span>Review history</span><b>Audit trail ↗</b></div></div>;
  return <div className="live-app-preview preview-promo" aria-hidden="true"><div className="script-lines"><span>THE SCRIPT</span><i /><i /><b>Hook</b><i /><i /><b>Cliffhanger</b></div><div className="cut-sheet"><span>THE CUT SHEET</span><b>Source</b><b>Review</b><b>Export ↗</b></div></div>;
}

function LiveShowcase() {
  const [active, setActive] = useState(0);
  const deck = useRef(null);
  const cards = useRef([]);
  const current = useRef(0);
  const wheelTime = useRef(0);
  const gesture = useRef(null);
  const previewTap = useRef(false);
  const swiped = useRef(false);

  function select(index) {
    const next = Math.max(0, Math.min(deployedApps.length - 1, index));
    current.current = next;
    setActive(next);
  }

  useEffect(() => {
    const element = deck.current;
    function browse(event) {
      if (event.ctrlKey) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (Math.abs(delta) < 12) return;
      const next = Math.max(0, Math.min(deployedApps.length - 1, current.current + Math.sign(delta)));
      if (next === current.current) return;
      event.preventDefault();
      if (Date.now() - wheelTime.current < 420) return;
      wheelTime.current = Date.now();
      current.current = next;
      setActive(next);
    }
    element.addEventListener('wheel', browse, { passive: false });
    return () => element.removeEventListener('wheel', browse);
  }, []);

  return <section className="live-showcase" id="work" aria-labelledby="live-title">
    <div className="showcase-heading"><div><p className="label">Live applications</p><h2 id="live-title">Explore the project deck.</h2></div></div>
    <div className="project-deck" ref={deck} aria-describedby="deck-hint" onKeyDown={(event) => {
      const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!direction) return;
      event.preventDefault();
      const next = Math.max(0, Math.min(deployedApps.length - 1, current.current + direction));
      select(next);
      cards.current[next]?.focus();
    }}>
      {deployedApps.map((app, index) => <a className={'deck-card app-' + app.id} href={app.href} key={app.id}
        ref={(element) => { cards.current[index] = element; }}
        data-active={active === index} data-before={index < active}
        style={{ '--offset': index - active, '--distance': Math.abs(index - active), zIndex: active === index ? 20 : 10 - Math.abs(index - active) }}
        aria-label={'Open ' + app.title + ' · ' + app.access}
        onPointerEnter={(event) => { if (event.pointerType === 'mouse' && Date.now() - wheelTime.current > 500) select(index); }}
        onFocus={() => select(index)}
        onPointerDown={(event) => {
          swiped.current = false;
          previewTap.current = event.pointerType !== 'mouse' && index !== current.current;
          gesture.current = { x: event.clientX, y: event.clientY, type: event.pointerType };
        }}
        onPointerUp={(event) => {
          const start = gesture.current;
          gesture.current = null;
          if (!start || start.type === 'mouse') return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
            previewTap.current = true;
            swiped.current = true;
            select(current.current + (dx < 0 ? 1 : -1));
          }
        }}
        onPointerCancel={() => { gesture.current = null; previewTap.current = false; }}
        onClick={(event) => {
          if (previewTap.current && event.detail !== 0 && !event.metaKey && !event.ctrlKey) {
            event.preventDefault();
            previewTap.current = false;
            if (!swiped.current) select(index);
          }
          previewTap.current = false;
          swiped.current = false;
        }}>
        <span className="deck-spine" aria-hidden="true"><img src={app.icon} alt="" width="26" height="26" /><span>{app.title}</span><small>{String(index + 1).padStart(2, '0')}</small></span>
        <div className="deck-card-body" aria-hidden={active !== index}>
          <div className="live-app-top"><img src={app.icon} alt="" width="30" height="30" /><span>{app.access}</span><span className="card-open-arrow"><Arrow /></span></div>
          <LiveAppPreview id={app.id} />
          <div className="live-app-copy"><p className="live-app-category">{app.category}</p><h3>{app.title}</h3><p>{app.label}</p><span className="deck-open-label">Open project <Arrow /></span></div>
        </div>
      </a>)}
    </div>
    <div className="deck-controls"><button type="button" aria-label="Previous project" disabled={active === 0} onClick={() => select(active - 1)}>←</button><p role="status"><span>{String(active + 1).padStart(2, '0')} / {String(deployedApps.length).padStart(2, '0')}</span>{deployedApps[active].title}</p><button type="button" aria-label="Next project" disabled={active === deployedApps.length - 1} onClick={() => select(active + 1)}>→</button></div>
    <p className="showcase-note" id="deck-hint">Hover or scroll over the deck to peek. Click a card to open its project. On touch, tap to preview, then tap again to open.</p>
  </section>;
}

function OpeningPage({ openAssistant }) {
  return <>
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="identity-card">
        <div className="identity-heading"><span className="identity-monogram" aria-hidden="true">AR<span>↗</span></span><p className="label hero-role">Frontend developer<br /><span>IIT Hyderabad</span></p></div>
        <div className="identity-copy"><h1 id="hero-title">Ajith Reddy<span>.</span></h1><p className="hero-intro">I build interfaces for shopping, reporting, and technical workflows.</p><p className="hero-deck">Explore my live applications, browse the project archive, or ask my profile assistant about my work.</p></div>
        <div className="hero-links"><a className="button" href="./projects.html">Explore my projects <Arrow direction="right" /></a><button className="text-link as-link" type="button" onClick={openAssistant}>Ask my profile <Arrow /></button></div>
        <div className="identity-footer"><span>React · JavaScript · APIs</span><a href={profile.resume}>View résumé <Arrow direction="right" /></a></div>
      </div>
      <LiveShowcase />
    </section>
  </>;
}

function ProjectsPage() {
  return <>
    <header className="archive-heading"><a className="archive-back" href="./">← Back to the opening page</a><p className="label">Selected work & source</p><h1>Projects, in detail<span>.</span></h1><p>Live applications, engineering case studies, and the complete project archive.</p></header>
    <section className="section" id="selected-work" aria-labelledby="work-title"><div className="section-heading"><h2 id="work-title">Selected work</h2><p>The decisions behind the interfaces.</p></div><div className="project-grid">{projects.map((project, index) => <Project key={project.id} index={index} project={project} />)}</div></section>
    <ProjectDirectory />
  </>;
}

function ProjectVisual({ id }) {
  if (id === 'invoice') return (
    <div className="project-visual invoice-visual" aria-hidden="true">
      <div className="invoice-preview">
        <div className="invoice-preview-top"><img src="./invoice-mark.svg" width="26" height="26" alt="" /><strong>Invoice review</strong><span>Review desk</span></div>
        <div className="invoice-preview-heading"><small>PROCUREMENT VERIFICATION</small><h4>Every decision.<br />Backed by evidence.</h4></div>
        <div className="invoice-preview-row"><span>Source fields</span><b>Page & quote</b></div>
        <div className="invoice-preview-row"><span>Purchase order</span><b>Rule checks</b></div>
        <div className="invoice-preview-row"><span>Review outcome</span><b>Audit trail →</b></div>
      </div>
    </div>
  );
  if (id === 'atelier') {
    return (
      <div className="project-visual atelier-visual" aria-hidden="true">
        <div className="mock-shop">
          <div className="mock-shop-bar"><b>Atelier Edit.</b><span>Collection &nbsp; · &nbsp; Bag</span></div>
          <div className="mock-products">
            <div><img src="./arc.webp" loading="lazy" alt="" /><span>Arc Signet</span></div>
            <div><img src="./form.webp" loading="lazy" alt="" /><span>Form Huggies</span></div>
            <div><img src="./tide.webp" loading="lazy" alt="" /><span>Tide Pendant</span></div>
          </div>
        </div>
      </div>
    );
  }
  if (id === 'pipeline') {
    return (
      <div className="project-visual pipeline-visual" aria-hidden="true">
        <div className="pipeline-mini">
          <div className="pipeline-mini-heading"><img src="./flowforge-mark.svg" alt="" width="26" height="26" /><strong>FlowForge</strong></div>
          <div className="flow">
            <span><small>Source</small>Extract</span><b>→</b>
            <span><small>Filter &amp; group</small>Transform</span><b>→</b>
            <span><small>CSV report</small>Load</span>
          </div>
        </div>
      </div>
    );
  }
  return <TrainerVisual />;
}

function Project({ project, index }) {
  return (
    <article className={'project-card ' + (index === 0 ? 'featured' : '')} id={project.id}>
      <ProjectVisual id={project.id} />
      <div className="project-copy">
        <div className="label">{project.type}</div>
        <h3>{project.title}</h3>
        <p>{project.description}</p>
        {project.access && <p className="project-access">{project.access}</p>}
        <ul className="chips" aria-label="Technologies">
          {project.stack.map((tech) => <li key={tech}>{tech}</li>)}
        </ul>
        {(project.demo || project.source || project.caseStudy) && (
          <div className="project-links">
            {project.demo && <a className="text-link demo-link" href={project.demo}>Open {project.title} <Arrow /></a>}
            {project.source && <a className="text-link demo-link" href={project.source}>Source code <Arrow /></a>}
            {project.caseStudy && <a className="text-link demo-link" href={project.caseStudy}>Read case study <Arrow /></a>}
          </div>
        )}
        {!project.caseStudy && (
          <details>
            <summary>Read case study</summary>
            <div className="case-body">
              <p>{project.brief}</p>
              <ul>{project.decisions.map((decision) => <li key={decision}>{decision}</li>)}</ul>
            </div>
          </details>
        )}
      </div>
    </article>
  );
}

function ProjectDirectory() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const needle = query.toLowerCase().trim();
  const visible = repositoryProjects.filter((project) =>
    (category === 'All' || project.category === category)
    && [project.title, project.name, project.description, project.language].join(' ').toLowerCase().includes(needle));
  return (
    <section className="section project-directory" id="projects" aria-labelledby="directory-title">
      <div className="section-heading"><div><p className="label">Beyond the selected work</p><h2 id="directory-title">Project directory</h2></div><p>Every public repository, with its own context.</p></div>
      <div className="directory-controls">
        <label className="directory-search">Find a project<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by project or technology" /></label>
        <fieldset className="directory-categories"><legend className="sr-only">Project category</legend>{['All', 'Applications', 'AI & data', 'Research & practice'].map((name) => <button type="button" key={name} aria-pressed={category === name} onClick={() => setCategory(name)}>{name}</button>)}</fieldset>
      </div>
      <p className="directory-count" role="status">{visible.length} of {repositoryProjects.length} public repositories · Source links below</p>
      <div className="directory-list">
        {visible.map((project) => <article className="directory-row" key={project.name}>
          <div><span className="directory-category">{project.category}</span><h3><a href={project.source}>{project.title} <Arrow /></a></h3><p>{project.description}</p></div>
          <div className="directory-meta"><span>{project.language}</span><a href={project.source}>View source <Arrow /></a></div>
        </article>)}
        {!visible.length && <div className="directory-empty"><p>No projects match these filters.</p><button type="button" className="subtle-button" onClick={() => { setQuery(''); setCategory('All'); }}>Clear filters</button></div>}
      </div>
      <p className="directory-note"><a href="./#work">Try the verified live applications on the opening page.</a> Research, notebooks, architecture studies, and repository archives are identified here without a deployment claim.</p>
    </section>
  );
}

function Assistant({ panel, onClose }) {
  const dispatch = useDispatch();
  const turns = useSelector((state) => state.chat.turns);
  const [question, setQuestion] = useState('');
  const [pending, setPending] = useState(false);
  const transcript = useRef(null);
  const input = useRef(null);
  const controller = useRef(null);

  useEffect(() => {
    const element = transcript.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [turns, pending]);

  async function send(text) {
    const asked = text.trim();
    if (!asked || controller.current) return;
    const request = new AbortController();
    controller.current = request;
    const previousQuestion = turns.at(-1)?.question ?? '';
    setPending(true);
    setQuestion('');
    let answer;
    try {
      const response = await fetch('/api/profile-assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]),
        body: JSON.stringify({ question: asked, previousQuestion }),
      });
      if (response.status === 429) {
        answer = { ...fallbackAnswer(asked, previousQuestion), mode: 'source-lookup' };
      } else {
        if (!response.ok) throw new Error('Assistant temporarily unavailable');
        answer = await response.json();
        if (typeof answer?.text !== 'string' || !Array.isArray(answer.links)) throw new Error('Invalid response');
      }
    } catch {
      answer = { ...fallbackAnswer(asked, previousQuestion), mode: 'source-lookup' };
    }
    if (request.signal.aborted) return;
    dispatch(chatActions.record({ question: asked, answer }));
    controller.current = null;
    setPending(false);
  }

  function reset() {
    controller.current?.abort();
    controller.current = null;
    setPending(false);
    dispatch(chatActions.reset());
    setQuestion('');
    input.current?.focus();
  }

  return (
    <dialog ref={panel} id="profile-chat" className="assistant-drawer" aria-labelledby="assistant-title" onClose={onClose}>
      <div className="assistant-header">
        <img src="./profile-mark.svg" alt="" width="38" height="38" />
        <div><h2 id="assistant-title">Ajith’s profile assistant</h2><small>Public GitHub and résumé</small></div>
        <button type="button" className="subtle-button" disabled={!turns.length && !pending} onClick={reset}>Reset</button>
        <button type="button" className="subtle-button close-assistant" aria-label="Close profile assistant" onClick={() => panel.current.close()}>×</button>
      </div>
      <div className="transcript" ref={transcript} role="log" aria-label="Profile assistant conversation">
        <div className="message answer"><p>Say hello or ask about Ajith’s projects, skills, and experience. I can point you to his résumé or GitHub.</p></div>
        {turns.map(({ question: asked, answer }, index) => (
          <div className="turn" key={index}>
            <div className="message question"><p><span className="sr-only">You asked </span>{asked}</p></div>
            <div className="message answer">
              <p><span className="sr-only">Assistant reply </span>{answer.text}</p>
              {answer.links.length > 0 && (
                <div className="message-links">{answer.links.map(({ label, href }) => <a key={href} href={href}>{label} <Arrow /></a>)}</div>
              )}
            </div>
          </div>
        ))}
        {pending && <p className="chat-pending" role="status">Thinking…</p>}
      </div>
      <div className="prompts" aria-label="Suggested questions">
        {prompts.map((prompt) => <button key={prompt} type="button" disabled={pending} onClick={() => send(prompt)}>{prompt}</button>)}
      </div>
      <form className="ask-form" onSubmit={(event) => { event.preventDefault(); send(question); }}>
        <label className="sr-only" htmlFor="question">Your question</label>
        <input id="question" ref={input} value={question} onChange={(event) => setQuestion(event.target.value)}
          maxLength={280} autoComplete="off" placeholder="Say hello or ask a question…" />
        <button className="button" type="submit" disabled={pending || !question.trim()}>Send <Arrow direction="right" /></button>
      </form>
      <p className="chat-privacy">Questions may be sent to Gemini. Use this chat for portfolio questions.</p>
    </dialog>
  );
}

export function Portfolio({ projectsPage = /\/projects(?:\.html)?$/.test(window.location.pathname) } = {}) {
  const panel = useRef(null);
  const trigger = useRef(null);
  const [assistantOpen, setAssistantOpen] = useState(false);

  function openAssistant(event) {
    trigger.current = event.currentTarget;
    panel.current.showModal();
    setAssistantOpen(true);
  }

  function closeAssistant() {
    setAssistantOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="site-header">
        <div className="wrap nav-inner">
          <a href="./" className="brand" aria-label="Ajith Reddy, home"><img src="./profile-mark.svg" alt="" width="35" height="35" /> Ajith Reddy</a>
          <nav aria-label="Main navigation">
            <a href="./" aria-current={!projectsPage ? 'page' : undefined}>Home</a><a href="./projects.html" aria-current={projectsPage ? 'page' : undefined}>Projects</a><button className="nav-assistant" type="button" onClick={openAssistant}>Ask my profile</button>
          </nav>
          <a className="nav-resume" href={profile.resume}>Résumé <Arrow /></a>
        </div>
      </header>
      <main id="main" className="wrap">
        {projectsPage ? <ProjectsPage /> : <OpeningPage openAssistant={openAssistant} />}
        <footer className="footer" id="contact">
          <div><strong>Ajith Reddy Pochimireddy</strong><br /><a href={'mailto:' + profile.email}>{profile.email}</a></div>
          <nav aria-label="Contact and profiles">
            <a href={profile.github}>GitHub <Arrow /></a><a href={profile.linkedin}>LinkedIn <Arrow /></a><a href={profile.resume}>Résumé <Arrow /></a>
          </nav>
        </footer>
      </main>
      <button type="button" className="assistant-launcher" aria-haspopup="dialog" aria-expanded={assistantOpen}
        aria-controls="profile-chat" onClick={openAssistant}>
        <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <path d="M20 11.6a7.8 7.8 0 0 1-8.1 7.5 8.5 8.5 0 0 1-2.7-.5l-4.4 1.3 1.2-3.7a7 7 0 0 1-2-4.6 8 8 0 0 1 16 0Z" /><path d="M8 12h8m-8-3h5" />
        </svg>
        <span>Ask Ajith</span>
      </button>
      <Assistant panel={panel} onClose={closeAssistant} />
    </>
  );
}

if (typeof document !== 'undefined') {
  createRoot(document.getElementById('root')).render(<Provider store={portfolioStore()}><Portfolio /></Provider>);
}
