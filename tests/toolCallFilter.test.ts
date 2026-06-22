import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseDsmlToolCalls,
  stripToolCallArtifacts,
} from '../src/utils/toolCallFilter.js';

const dsmlWebFetch = '<｜｜DSML｜｜tool_calls>'
  + '<｜｜DSML｜｜invokename="web_fetch">'
  + '<｜｜DSML｜｜parametername="url"string="true">'
  + 'https://money.kompas.com/read/2026/06//151444026/pln-ungkap-penyebab-pemadaman-bergilir-di-pulau-jawa'
  + '</｜｜DSML｜｜parameter>'
  + '</｜｜DSML｜｜invoke>'
  + '</｜｜DSML｜｜tool_calls>';

test('recovers a registered DSML tool call from visible model text', () => {
  const calls = parseDsmlToolCalls(dsmlWebFetch, new Set(['web_fetch']));

  assert.equal(calls.length, 1);
  assert.equal(calls[0].function.name, 'web_fetch');
  assert.deepEqual(JSON.parse(calls[0].function.arguments), {
    url: 'https://money.kompas.com/read/2026/06//151444026/pln-ungkap-penyebab-pemadaman-bergilir-di-pulau-jawa',
  });
});

test('never exposes DSML markup in user-visible text', () => {
  assert.equal(
    stripToolCallArtifacts(`Sedang mencari.\n${dsmlWebFetch}\nSelesai.`),
    'Sedang mencari.\n\nSelesai.'
  );
});

test('does not execute a DSML call for an unregistered tool', () => {
  assert.deepEqual(parseDsmlToolCalls(dsmlWebFetch, new Set(['web_search'])), []);
  assert.equal(stripToolCallArtifacts(dsmlWebFetch), '');
});

test('fails closed for incomplete DSML markup', () => {
  const incomplete = '<｜｜DSML｜｜tool_calls><｜｜DSML｜｜invokename="web_fetch">';

  assert.deepEqual(parseDsmlToolCalls(incomplete, new Set(['web_fetch'])), []);
  assert.equal(stripToolCallArtifacts(incomplete), '');
});

test('fails closed for a truncated standard tool_calls tag', () => {
  assert.equal(stripToolCallArtifacts('<tool_calls'), '');
  assert.equal(stripToolCallArtifacts('Memproses\n<tool_calls'), 'Memproses');
  assert.equal(stripToolCallArtifacts('</tool_calls'), '');
});
