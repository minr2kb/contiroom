import type { PadKey } from './pad-storage';

// The bundled pads have a recorded fade-in before 8s and fade-out after 930s.
const PAD_START_SECONDS = 8;
const PAD_TAIL_SECONDS = 930;
const CURVE_STEPS = 32;

type Channel = {
  audio: HTMLAudioElement;
  gain: GainNode;
  key: PadKey | null;
  url: string | null;
  timer: ReturnType<typeof setTimeout> | null;
};

export class PadAudio {
  private readonly context = new AudioContext();
  private readonly master = this.context.createGain();
  private readonly channels: [Channel, Channel];
  private current: Channel | null = null;
  private sequence = 0;
  private fadeSeconds: number;

  constructor(volume: number, fadeSeconds: number) {
    this.fadeSeconds = fadeSeconds;
    this.master.gain.value = volume;
    this.master.connect(this.context.destination);
    this.channels = [this.createChannel(), this.createChannel()];
  }

  private createChannel(): Channel {
    const audio = new Audio();
    audio.loop = true;
    audio.preload = 'auto';
    // shortcut: timeupdate may briefly reach the recorded tail; use loopable assets for seamless looping.
    audio.ontimeupdate = () => {
      if (audio.currentTime >= PAD_TAIL_SECONDS) audio.currentTime = PAD_START_SECONDS;
    };
    const gain = this.context.createGain();
    gain.gain.value = 0;
    this.context.createMediaElementSource(audio).connect(gain).connect(this.master);
    return { audio, gain, key: null, url: null, timer: null };
  }

  private clear(channel: Channel) {
    if (channel.timer) clearTimeout(channel.timer);
    channel.timer = null;
    channel.audio.pause();
    channel.audio.removeAttribute('src');
    channel.audio.load();
    if (channel.url) URL.revokeObjectURL(channel.url);
    channel.url = null;
    channel.key = null;
    channel.gain.gain.cancelScheduledValues(this.context.currentTime);
    channel.gain.gain.value = 0;
  }

  private hold(channel: Channel): number {
    if (channel.timer) clearTimeout(channel.timer);
    channel.timer = null;
    const gain = channel.gain.gain;
    const now = this.context.currentTime;
    const value = gain.value;
    if (typeof gain.cancelAndHoldAtTime === 'function') gain.cancelAndHoldAtTime(now);
    else {
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(value, now);
    }
    return value;
  }

  private fade(channel: Channel, target: number, crossfade = false) {
    const gain = channel.gain.gain;
    const now = this.context.currentTime;
    const start = this.hold(channel);
    if (this.fadeSeconds === 0) {
      if (target === 0) this.clear(channel);
      else gain.setValueAtTime(target, now);
      return;
    }
    if (crossfade) {
      for (let step = 1; step <= CURVE_STEPS; step++) {
        const progress = step / CURVE_STEPS;
        const angle = (progress * Math.PI) / 2;
        const value = target === 1 ? start + (1 - start) * Math.sin(angle) : start * Math.cos(angle);
        gain.linearRampToValueAtTime(value, now + this.fadeSeconds * progress);
      }
    } else gain.linearRampToValueAtTime(target, now + this.fadeSeconds);
    if (target === 0) {
      channel.timer = setTimeout(() => this.clear(channel), this.fadeSeconds * 1000 + 100);
    }
  }

  setFadeSeconds(seconds: number) {
    this.fadeSeconds = seconds;
    if (seconds === 0) {
      for (const channel of this.channels) {
        if (!channel.key) continue;
        if (channel === this.current) {
          channel.gain.gain.cancelScheduledValues(this.context.currentTime);
          channel.gain.gain.setValueAtTime(1, this.context.currentTime);
        } else this.clear(channel);
      }
    }
  }

  setVolume(volume: number) {
    this.master.gain.setTargetAtTime(Math.min(1, Math.max(0, volume)), this.context.currentTime, 0.02);
  }

  resume(): Promise<void> {
    return this.context.resume();
  }

  async play(key: PadKey, blob: Blob): Promise<boolean> {
    const sequence = ++this.sequence;
    if (this.current?.key === key && !this.current.audio.paused) return true;
    await this.context.resume();
    if (sequence !== this.sequence) return false;

    const [first, second] = this.channels;
    const next = !first.key
      ? first
      : !second.key
        ? second
        : first.gain.gain.value <= second.gain.gain.value
          ? first
          : second;
    const other = next === first ? second : first;
    const previous = other.key ? other : null;
    if (previous && previous !== this.current) this.hold(previous);
    this.clear(next);
    next.url = URL.createObjectURL(blob);
    const url = next.url;
    next.key = key;
    next.audio.src = next.url;
    const position = previous?.audio.currentTime ?? PAD_START_SECONDS;
    next.audio.currentTime =
      position >= PAD_START_SECONDS && position < PAD_TAIL_SECONDS - this.fadeSeconds ? position : PAD_START_SECONDS;
    try {
      await next.audio.play();
    } catch (error) {
      if (next.url === url) this.clear(next);
      if (sequence !== this.sequence) return false;
      if (previous) {
        this.current = previous;
        this.fade(previous, 1);
      }
      throw error;
    }
    if (sequence !== this.sequence) {
      if (next.url === url) this.clear(next);
      return false;
    }
    this.current = next;
    this.fade(next, 1, Boolean(previous));
    if (previous) this.fade(previous, 0, true);
    return true;
  }

  stop() {
    ++this.sequence;
    this.current = null;
    for (const channel of this.channels) {
      if (channel.key) this.fade(channel, 0);
    }
  }

  dispose() {
    ++this.sequence;
    this.current = null;
    for (const channel of this.channels) this.clear(channel);
    void this.context.close();
  }
}
