import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { AIService } from '../src/services/aiService.js';

type StreamCallback = (chunk: { content: string; done: boolean }) => void;

function openAiEvent(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n`;
}

test('OpenAI stream preserves token whitespace and fragmented SSE lines', async () => {
  const service = new AIService();
  const stream = new PassThrough();
  const snapshots: string[] = [];
  const wire = openAiEvent('Menurut')
    + openAiEvent(' info')
    + openAiEvent(' terbaru')
    + 'data: [DONE]\n';

  const resultPromise = (service as any).handleOpenAICompatibleSSEStream(
    'stream-spacing-test',
    [],
    stream,
    ((chunk) => {
      if (!chunk.done) snapshots.push(chunk.content);
    }) satisfies StreamCallback
  );

  // Deliberately split in the middle of JSON/SSE records.
  stream.write(wire.slice(0, 13));
  stream.write(wire.slice(13, 47));
  stream.end(wire.slice(47));

  assert.equal(await resultPromise, 'Menurut info terbaru');
  assert.equal(snapshots.at(-1), 'Menurut info terbaru');
});

test('Ollama stream preserves token whitespace and fragmented JSON lines', async () => {
  const service = new AIService();
  const stream = new PassThrough();
  const snapshots: string[] = [];
  const wire = [
    JSON.stringify({ message: { content: 'Penyebabnya' }, done: false }),
    JSON.stringify({ message: { content: ' ada' }, done: false }),
    JSON.stringify({ message: { content: ' dua.' }, done: false }),
    JSON.stringify({ message: { content: '' }, done: true }),
  ].join('\n') + '\n';

  const resultPromise = (service as any).handleOllamaStream(
    'ollama-stream-spacing-test',
    [],
    stream,
    ((chunk) => {
      if (!chunk.done) snapshots.push(chunk.content);
    }) satisfies StreamCallback
  );

  stream.write(wire.slice(0, 9));
  stream.write(wire.slice(9, 61));
  stream.end(wire.slice(61));

  assert.equal(await resultPromise, 'Penyebabnya ada dua.');
  assert.equal(snapshots.at(-1), 'Penyebabnya ada dua.');
});
