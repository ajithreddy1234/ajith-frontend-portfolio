import assert from 'node:assert/strict';
import test from 'node:test';
import { fallbackAnswer, scopeAnswer } from '../src/evidence.js';
import { basketActions, storefrontStore } from '../src/store.js';
import handler from '../netlify/functions/profile-assistant.mjs';

const endpoint = 'https://ajith-reddy-frontend.netlify.app/api/profile-assistant';
function request(question, previousQuestion = '') {
  return new Request(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: new URL(endpoint).origin },
    body: JSON.stringify({ question, previousQuestion }),
  });
}

test('lookup uses the two approved profile sources and retains follow-up context', () => {
  assert.match(fallbackAnswer('What is FlowForge?').links[0].href, /^https:\/\/github\.com\/ajithreddy1234$/);
  assert.match(fallbackAnswer('Tell me more', 'What did he do at Country Delight?').text, /AI\/ML Intern/);
  assert.equal(fallbackAnswer('What is the weather today?').links.length, 0);
  for (const question of ['What is dynamic programming?', 'Explain React', 'Hi, explain JavaScript', 'Write a sorting algorithm']) {
    assert.deepEqual(fallbackAnswer(question), scopeAnswer);
  }
  assert.deepEqual(fallbackAnswer('Tell me more', 'What is dynamic programming?'), scopeAnswer);
  assert.match(fallbackAnswer('What does Ajith use React for?').text, /Atelier/);
});

test('function does not send malformed or cross-origin inputs upstream', async () => {
  assert.equal((await handler(request('x'.repeat(281)))).status, 400);
  assert.equal((await handler(new Request(endpoint, { method: 'POST', headers: { origin: 'https://example.org' } }))).status, 403);
});

test('Gemini gets a profile-only prompt, can greet, redirects unrelated topics, and requires citations for profile facts', async (t) => {
  const original = globalThis.Netlify;
  globalThis.Netlify = { env: { get: (name) => name === 'GEMINI_API_KEY' ? 'test-key-only' : undefined } };
  t.after(() => { globalThis.Netlify = original; });
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    const url = String(input);
    if (url.includes('/repos?')) {
      return Response.json([
        { name: 'Public Example', private: false, owner: { login: 'ajithreddy1234' } },
        { name: 'Excluded Example', private: true, owner: { login: 'ajithreddy1234' } },
      ]);
    }
    if (url.startsWith('https://api.github.com/')) return Response.json({ login: 'ajithreddy1234' });
    assert.match(url, /generativelanguage\.googleapis\.com/);
    assert.equal(new Headers(options.headers).get('x-goog-api-key'), 'test-key-only');
    assert.match(options.body, /Public Example/);
    assert.doesNotMatch(options.body, /Excluded Example|test-key-only/);
    const payload = JSON.parse(options.body);
    const instructions = payload.systemInstruction.parts.map((part) => part.text).join(' ');
    assert.match(instructions, /not a general-purpose assistant or programming tutor/);
    assert.match(instructions, /Do not answer, define, summarize, solve/);
    assert.match(instructions, /A previous unrelated question never authorizes answering it/);
    assert.doesNotMatch(instructions, /may also answer harmless general questions/);
    const { question } = JSON.parse(payload.contents[0].parts[0].text);
    const replies = {
      'Hi there': { kind: 'social', answer: 'Hello! What would you like to explore?', sources: [] },
      'How many clients did he have?': { kind: 'portfolio', answer: 'He worked with twenty clients.', sources: [] },
      'Can you describe FlowForge?': { kind: 'portfolio', answer: 'FlowForge is a data workflow project.', sources: ['github', 'outside'] },
      'What is dynamic programming?': { kind: 'redirect', answer: 'I can help with Ajith’s résumé, GitHub, and projects. What would you like to know about his work?', sources: [] },
      'Hi, explain React': { kind: 'redirect', answer: 'Hi! I can discuss Ajith’s projects and background. Would you like to hear what he built with React?', sources: [] },
      'Legacy general answer': { kind: 'conversation', answer: 'Here is an unrelated programming lesson.', sources: [] },
    };
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(replies[question]) }] } }] });
  });
  const answer = await (await handler(request('Can you describe FlowForge?'))).json();
  assert.equal(answer.mode, 'gemini');
  assert.deepEqual(answer.links, [{ label: 'GitHub · ajithreddy1234', href: 'https://github.com/ajithreddy1234' }]);
  const greeting = await (await handler(request('Hi there'))).json();
  assert.equal(greeting.mode, 'gemini');
  assert.equal(greeting.text, 'Hello! What would you like to explore?');
  assert.deepEqual(greeting.links, []);
  for (const question of ['What is dynamic programming?', 'Hi, explain React']) {
    const redirected = await (await handler(request(question))).json();
    assert.equal(redirected.mode, 'gemini');
    assert.deepEqual(redirected.links, []);
    assert.match(redirected.text, /Ajith/);
  }
  const legacy = await (await handler(request('Legacy general answer'))).json();
  assert.doesNotMatch(legacy.text, /programming lesson/);
  const unknown = await (await handler(request('How many clients did he have?'))).json();
  assert.doesNotMatch(unknown.text, /twenty/);
  assert.deepEqual(unknown.links, []);
});

test('different variants stay separate and removing one preserves the other', () => {
  const store = storefrontStore();
  const a = { productId: 'arc', variant: 'Size 5' };
  const b = { productId: 'arc', variant: 'Size 6' };
  store.dispatch(basketActions.add(a));
  store.dispatch(basketActions.add(b));
  store.dispatch(basketActions.add(a));
  assert.deepEqual(store.getState().basket.lines.map(({ quantity }) => quantity), [2, 1]);
  store.dispatch(basketActions.setQuantity({ ...a, quantity: 0 }));
  assert.deepEqual(store.getState().basket.lines, [{ ...b, quantity: 1 }]);
});
