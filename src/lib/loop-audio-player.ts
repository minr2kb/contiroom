const CURVE_STEPS = 32;

type Channel = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  key: string;
  startedAt: number;
  offset: number;
};

export class LoopAudioPlayer<Key extends string> {
  private readonly context = new AudioContext();
  private readonly master = this.context.createGain();
  private readonly channels = new Set<Channel>();
  private current: Channel | null = null;
  private sequence = 0;
  private fadeSeconds: number;
  private disposed = false;

  constructor(volume: number, fadeSeconds: number) {
    this.fadeSeconds = fadeSeconds;
    this.master.gain.value = volume;
    this.master.connect(this.context.destination);
  }

  private clear(channel: Channel, ended = false) {
    if (!this.channels.has(channel)) return;
    channel.source.onended = null;
    if (!ended) channel.source.stop();
    channel.source.disconnect();
    channel.gain.disconnect();
    this.channels.delete(channel);
    if (this.current === channel) this.current = null;
  }

  private hold(channel: Channel): number {
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
      channel.source.onended = () => this.clear(channel, true);
      channel.source.stop(now + this.fadeSeconds);
    }
  }

  setFadeSeconds(seconds: number) {
    this.fadeSeconds = seconds;
    if (seconds === 0) {
      for (const channel of this.channels) {
        if (channel === this.current) {
          this.hold(channel);
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

  async play(key: Key, blob: Blob): Promise<boolean> {
    const sequence = ++this.sequence;
    if (this.current?.key === key) return true;
    await this.context.resume();
    if (sequence !== this.sequence || this.disposed) return false;

    const buffer = await this.context.decodeAudioData(await blob.arrayBuffer());
    if (sequence !== this.sequence || this.disposed) return false;

    const now = this.context.currentTime;
    const previous = this.current;
    const offset = previous ? (previous.offset + now - previous.startedAt) % buffer.duration : 0;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.value = 0;
    source.connect(gain).connect(this.master);
    try {
      source.start(now, offset);
    } catch (error) {
      source.disconnect();
      gain.disconnect();
      throw error;
    }
    const next: Channel = { source, gain, key, startedAt: now, offset };
    this.channels.add(next);
    this.current = next;
    this.fade(next, 1, Boolean(previous));
    if (previous) this.fade(previous, 0, true);
    return true;
  }

  stop() {
    ++this.sequence;
    this.current = null;
    for (const channel of this.channels) this.fade(channel, 0);
  }

  dispose() {
    ++this.sequence;
    this.disposed = true;
    this.current = null;
    for (const channel of this.channels) this.clear(channel);
    void this.context.close();
  }
}
