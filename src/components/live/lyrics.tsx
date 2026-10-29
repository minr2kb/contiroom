'use client';

import { HStack } from '@astryxdesign/core/HStack';
import { VStack } from '@astryxdesign/core/VStack';
import { clamp } from 'es-toolkit/math';
import { useLayoutEffect, useRef, useState } from 'react';
import { graphemes } from '@/lib/graphemes';
import { type LiveLine, wrapLiveLine } from '@/lib/live';

type LyricMetrics = { width: number; fontSize: number; fontFamily: string };

export const Lyrics = ({
  line,
  showChords,
  showTranslations,
}: {
  line: LiveLine['line'];
  showChords: boolean;
  showTranslations: boolean;
}) => {
  const container = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<LyricMetrics>();
  useLayoutEffect(() => {
    const element = container.current;
    if (!element || !showChords) return;
    let active = true;
    const update = (force = false) => {
      if (!active) return;
      const style = getComputedStyle(element);
      const next = {
        width: element.clientWidth,
        fontSize: Number.parseFloat(style.fontSize),
        fontFamily: style.fontFamily,
      };
      setMetrics((previous) =>
        !force &&
        previous?.width === next.width &&
        previous.fontSize === next.fontSize &&
        previous.fontFamily === next.fontFamily
          ? previous
          : next,
      );
    };
    update();
    document.fonts.ready.then(() => update(true));
    const observer = new ResizeObserver(() => update());
    observer.observe(element);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [showChords]);

  if (!showChords)
    return (
      <div>
        <div className="font-mono whitespace-pre-wrap [overflow-wrap:anywhere] text-[clamp(28px,4vw,112px)] leading-normal font-semibold">
          {line.text || '　'}
        </div>
        {showTranslations && line.translation?.trim() && (
          <div className="-mt-1 whitespace-pre-wrap [overflow-wrap:anywhere] text-[clamp(20px,2.8vw,76px)] leading-normal text-neutral-300">
            {line.translation}
          </div>
        )}
      </div>
    );
  const characters = graphemes(line.text);
  const lastChordOffset = Math.max(-1, ...line.chords.map((chord) => chord.offset));
  const slots = Array.from(
    { length: Math.max(characters.length, lastChordOffset + 1, 1) },
    (_, offset) => characters[offset] ?? '\u00a0',
  );
  const fontSize = metrics?.fontSize ?? 40;
  const chordSize = clamp(fontSize * 0.46, 16, 48);
  const chordHeight = chordSize * 1.3;
  const context = metrics ? document.createElement('canvas').getContext('2d') : null;
  const fontFamily = metrics?.fontFamily ?? 'sans-serif';
  if (context) context.font = `600 ${fontSize}px ${fontFamily}`;
  const glyphWidths = slots.map((glyph) => context?.measureText(glyph).width ?? fontSize);
  if (context) context.font = `800 ${chordSize}px ${fontFamily}`;
  const chords = line.chords.map((chord) => ({
    ...chord,
    width: context?.measureText(chord.value).width ?? chord.value.length * chordSize,
  }));
  const rows = wrapLiveLine(glyphWidths, chords, metrics?.width ?? Number.POSITIVE_INFINITY);
  return (
    <div>
      <VStack
        ref={container}
        className="font-mono min-w-0 overflow-visible text-[clamp(28px,4vw,112px)] leading-normal font-semibold"
        role="img"
        aria-label={`${line.chords.map((x) => x.value).join(', ')} ${line.text}`}
      >
        {rows.map((row) => (
          <HStack
            key={row.start}
            className="relative w-max max-w-none whitespace-pre"
            style={{ paddingTop: row.lanes ? row.lanes * chordHeight + 4 : 0 }}
          >
            {row.chords.map((chord) => (
              <span
                key={chord.id}
                className="absolute top-0 whitespace-nowrap font-extrabold"
                style={{
                  left: chord.x,
                  top: chord.lane * chordHeight,
                  fontSize: chordSize,
                  lineHeight: `${chordHeight}px`,
                }}
              >
                {chord.value}
              </span>
            ))}
            {slots.slice(row.start, row.end).map((glyph, index) => (
              <span
                key={row.start + index}
                className="inline-block shrink-0"
                style={{ width: glyphWidths[row.start + index] }}
              >
                {glyph}
              </span>
            ))}
          </HStack>
        ))}
      </VStack>
      {showTranslations && line.translation?.trim() && (
        <div className="-mt-1 whitespace-pre-wrap [overflow-wrap:anywhere] text-[clamp(20px,2.8vw,76px)] leading-normal text-neutral-300">
          {line.translation}
        </div>
      )}
    </div>
  );
};
