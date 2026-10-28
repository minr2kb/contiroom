import assert from 'node:assert/strict';
import test from 'node:test';
import { contiEditorReducer, initialContiEditorState } from './conti-editor-state.ts';
import { sampleContis } from './model.ts';

test('conti editing keeps source and other arrangements unchanged', () => {
  const original = structuredClone(sampleContis);
  let state = contiEditorReducer(initialContiEditorState, { type: 'load', conti: sampleContis[0] });
  state = contiEditorReducer(state, { type: 'item/key', itemId: 'item-1', value: 'A' });
  state = contiEditorReducer(state, {
    type: 'form/add',
    itemId: 'item-1',
    step: { id: 'again', sectionId: 's3-chorus' },
  });
  state = contiEditorReducer(state, { type: 'form/move', itemId: 'item-1', stepId: 'again', direction: -1 });
  assert.equal(state.draft?.items[0].key, 'A');
  assert.equal(state.draft?.items[0].form.at(-2)?.id, 'again');
  assert.deepEqual(sampleContis, original);
});

test('scheduled date can be set and cleared without changing the loaded conti', () => {
  const legacy = { id: 'legacy', title: '기존 콘티', items: [] };
  let state = contiEditorReducer(initialContiEditorState, { type: 'load', conti: legacy });
  state = contiEditorReducer(state, { type: 'scheduled-date', value: '2026-10-18' });
  assert.equal(state.draft?.scheduledDate, '2026-10-18');
  assert.equal('scheduledDate' in legacy, false);

  state = contiEditorReducer(state, { type: 'scheduled-date' });
  assert.equal(state.draft?.scheduledDate, undefined);
  assert.equal(Object.hasOwn(state.draft ?? {}, 'scheduledDate'), false);
});
