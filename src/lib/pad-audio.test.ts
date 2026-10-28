import assert from 'node:assert/strict';
import test from 'node:test';
import { LoopAudioPlayer as PadAudio } from './loop-audio-player.ts';

class FakeParam {
  value = 0;
  ramps: number[] = [];
  cancelAndHoldAtTime() {}
  cancelScheduledValues() {}
  setValueAtTime(value: number) {
    this.value = value;
  }
  linearRampToValueAtTime(value: number) {
    this.ramps.push(value);
    this.value = value;
  }
  setTargetAtTime(value: number) {
    this.value = value;
  }
}

class FakeGain {
  gain = new FakeParam();
  connect() {
    return this;
  }
  disconnect() {}
}

class FakeSource {
  buffer: AudioBuffer | null = null;
  loop = false;
  startArgs: [number, number] | null = null;
  stopAt: number | null = null;
  onended: (() => void) | null = null;
  connect(gain: FakeGain) {
    return gain;
  }
  start(when: number, offset: number) {
    this.startArgs = [when, offset];
  }
  stop(when = 0) {
    this.stopAt = when;
  }
  disconnect() {}
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  currentTime = 0;
  destination = {};
  gains: FakeGain[] = [];
  sources: FakeSource[] = [];
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  createGain() {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }
  createBufferSource() {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }
  async decodeAudioData() {
    return { duration: 60 } as AudioBuffer;
  }
  async resume() {}
  async close() {}
}

test('pad loops continuously and crossfades key changes at the outgoing position', async () => {
  const originalContext = globalThis.AudioContext;
  globalThis.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
  const audio = new PadAudio(0.25, 2);
  try {
    const context = FakeAudioContext.instances.at(-1);
    assert.ok(context);
    const blob = new Blob(['pad']);

    await audio.play('G', blob);
    const first = context.sources[0];
    assert.equal(first.loop, true);
    assert.deepEqual(first.startArgs, [0, 0]);
    assert.equal(context.gains[1].gain.ramps.at(-1), 1);

    context.currentTime = 12;
    await audio.play('D', blob);
    const second = context.sources[1];
    assert.equal(second.loop, true);
    assert.deepEqual(second.startArgs, [12, 12]);
    const outgoingMid = context.gains[1].gain.ramps.slice(-32)[15];
    const incomingMid = context.gains[2].gain.ramps.slice(-32)[15];
    assert.ok(Math.abs(outgoingMid ** 2 + incomingMid ** 2 - 1) < 0.01);
    assert.equal(first.stopAt, 14);
    assert.ok(first.onended);

    context.currentTime = 13;
    await audio.play('E', blob);
    assert.deepEqual(context.sources[2].startArgs, [13, 13]);
    assert.equal(first.stopAt, 14);

    audio.stop();
    assert.equal(context.gains[3].gain.ramps.at(-1), 0);
    assert.equal(context.sources[2].stopAt, 15);
  } finally {
    audio.dispose();
    globalThis.AudioContext = originalContext;
  }
});
