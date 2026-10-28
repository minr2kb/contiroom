import assert from 'node:assert/strict';
import test from 'node:test';
import { PadAudio } from '../features/pads/pad-audio.ts';

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
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  currentTime = 0;
  destination = {};
  gains: FakeGain[] = [];
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  createGain() {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }
  createMediaElementSource() {
    return { connect: (gain: FakeGain) => gain };
  }
  async resume() {}
  async close() {}
}

class FakeAudio {
  static instances: FakeAudio[] = [];
  currentTime = 0;
  loop = false;
  preload = '';
  paused = true;
  src = '';
  ontimeupdate: (() => void) | null = null;
  constructor() {
    FakeAudio.instances.push(this);
  }
  async play() {
    this.paused = false;
  }
  pause() {
    this.paused = true;
  }
  removeAttribute(name: string) {
    if (name === 'src') this.src = '';
  }
  load() {}
}

test('pad switches skip recorded intro, follow the outgoing timeline, and preserve the louder channel', async () => {
  const originalAudio = globalThis.Audio;
  const originalContext = globalThis.AudioContext;
  globalThis.Audio = FakeAudio as unknown as typeof Audio;
  globalThis.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
  const audio = new PadAudio(0.25, 2);
  try {
    const [first, second] = FakeAudio.instances;
    const [, firstGain, secondGain] = FakeAudioContext.instances[0].gains;
    const blob = new Blob(['pad']);

    await audio.play('G', blob);
    assert.equal(first.currentTime, 8);

    first.currentTime = 120;
    await audio.play('D', blob);
    assert.equal(second.currentTime, 120);
    const outgoingMid = firstGain.gain.ramps.slice(-32)[15];
    const incomingMid = secondGain.gain.ramps.slice(-32)[15];
    assert.ok(Math.abs(outgoingMid ** 2 + incomingMid ** 2 - 1) < 0.01);

    first.currentTime = 122;
    firstGain.gain.value = 0.9;
    secondGain.gain.value = 0.2;
    await audio.play('E', blob);
    assert.equal(second.currentTime, 122);
    assert.equal(first.paused, false);

    second.currentTime = 930;
    second.ontimeupdate?.();
    assert.equal(second.currentTime, 8);
  } finally {
    audio.dispose();
    globalThis.Audio = originalAudio;
    globalThis.AudioContext = originalContext;
  }
});
