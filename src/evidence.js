import resume from './resume-evidence.js';
import github from './github-evidence.js';

export const sourceLinks = {
  resume: { label: 'Résumé', href: './Ajith_Reddy_Frontend_Resume.pdf' },
  github: { label: 'GitHub · ajithreddy1234', href: 'https://github.com/ajithreddy1234' },
};

export const prompts = [
  'What frontend projects can I try?',
  'What did Ajith do at Country Delight?',
  'How does FlowForge work?',
  'What does Ajith use React for?',
];

export const unknownAnswer = {
  text: 'I couldn’t find that in Ajith’s résumé or public GitHub profile. Try asking about his projects, frontend skills, education, or internship.',
  links: [],
};

export function fallbackAnswer(question, previousQuestion = '') {
  const normalized = question.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const context = /^(tell me more|more details|what about that|how does it|what else)\b/.test(normalized)
    ? previousQuestion + ' ' + question : question;
  if (/\b(salary|phone|religion|caste|password|roll number|salary|age)\b/.test(normalized)) return unknownAnswer;
  if (/\b(resume|cv|contact|email)\b/.test(normalized)) {
    return { text: 'Ajith’s résumé includes his contact details, projects, skills, and education.', links: [sourceLinks.resume] };
  }
  const tokens = new Set(context.toLowerCase().match(/[a-z0-9]+/g) ?? []);
  const matches = [...resume, ...github].map((record) => ({
    ...record, score: record.terms.reduce((sum, term) => sum + Number(tokens.has(term)), 0),
  })).sort((a, b) => b.score - a.score);
  const best = matches[0];
  return best?.score ? { text: best.text, links: [sourceLinks[best.source]] } : unknownAnswer;
}

export function toContext(groups) {
  return groups.map(({ source, text }) => '[' + source + '] ' + text).join('\n');
}
