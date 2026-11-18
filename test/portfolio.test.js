import assert from 'node:assert/strict';
import test from 'node:test';
import { fallbackAnswer } from '../src/evidence.js';
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
});

test('function does not send malformed or cross-origin inputs upstream', async () => {
  assert.equal((await handler(request('x'.repeat(281)))).status, 400);
  assert.equal((await handler(new Request(endpoint, { method: 'POST', headers: { origin: 'https://example.org' } }))).status, 403);
});

test('Gemini can greet without sources while portfolio claims still require allowed citations', async (t) => {
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
    const { question } = JSON.parse(payload.contents[0].parts[0].text);
    const replies = {
      'Hi there': { kind: 'conversation', answer: 'Hello! What would you like to explore?', sources: [] },
      'How many clients did he have?': { kind: 'portfolio', answer: 'He worked with twenty clients.', sources: [] },
      'Can you describe FlowForge?': { kind: 'portfolio', answer: 'FlowForge is a data workflow project.', sources: ['github', 'outside'] },
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
