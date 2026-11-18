import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/dm-sans';
import './styles.css';
import './model-trainer.css';
import { projects } from './profile.js';
import { TrainerVisual } from './trainer-visual.jsx';

const trainer = projects.find(({ id }) => id === 'trainer');
const stages = ['Prepare datasets', 'Monitor and diagnose', 'Review and export'];

function ModelTrainer() {
  return (
    <>
      <a className="skip" href="#main">Skip to case study</a>
      <header className="trainer-header">
        <div className="wrap trainer-header-inner">
          <a href="#main" className="trainer-brand">Model Trainer</a>
          <a href="#workflow" className="trainer-nav-link">Workflow</a>
        </div>
      </header>
      <main id="main" className="wrap">
        <section className="trainer-hero" aria-labelledby="trainer-title">
          <div>
            <p className="label">Case study · Country Delight</p>
            <h1 id="trainer-title">{trainer.title}</h1>
            <p className="trainer-lead">{trainer.description}</p>
            <ul className="chips" aria-label="Technologies">
              {trainer.stack.map((tech) => <li key={tech}>{tech}</li>)}
            </ul>
          </div>
          <figure>
            <TrainerVisual />
            <figcaption>Illustrative training run with sample metrics.</figcaption>
          </figure>
        </section>
        <section id="workflow" className="trainer-workflow" aria-labelledby="workflow-title">
          <h2 id="workflow-title">Training workflow</h2>
          <p>{trainer.brief}</p>
          <ol>
            {trainer.decisions.map((decision, index) => (
              <li key={decision}>
                <h3>{stages[index]}</h3>
                <p>{decision}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <footer className="wrap trainer-footer">Ajith Reddy Pochimireddy · AI/ML Intern, May–Aug 2026</footer>
    </>
  );
}

createRoot(document.getElementById('root')).render(<ModelTrainer />);
