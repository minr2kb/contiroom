'use client';

import { Button } from '@astryxdesign/core/Button';
import { Link } from '@astryxdesign/core/Link';
import { Selector } from '@astryxdesign/core/Selector';
import { useQueries } from '@tanstack/react-query';
import { useState } from 'react';
import { queries } from '@/lib/data-api';
import type { Conti, ContiItem, LyricLine, Song } from '@/lib/model';
import { itemSemitones, keyPitch, transposeChord } from '@/lib/music';
import { printForm, printLineSegments } from '@/lib/print-score';
import './print.css';

function PrintLine({ line, semitones, preferFlats }: { line: LyricLine; semitones: number; preferFlats: boolean }) {
  return (
    <div className="print-line">
      {printLineSegments(line).map(({ offset, chords, text }) => (
        <span className="print-segment" key={offset}>
          <span className="print-chord">
            {chords
              .map((chord) => (semitones ? transposeChord(chord.value, semitones, preferFlats) : chord.value))
              .join(' / ')}
          </span>
          <span className="print-lyric">{text}</span>
        </span>
      ))}
    </div>
  );
}

function PrintSong({
  song,
  item,
  displayKey,
  index,
  contiTitle,
}: {
  song: Song;
  item?: ContiItem;
  displayKey?: string;
  index?: number;
  contiTitle?: string;
}) {
  const key = item?.key || displayKey || song.baseKey;
  const semitones = item ? itemSemitones(song, item) : keyPitch(key) - keyPitch(song.baseKey);
  const sections = song.sections;
  return (
    <article className="print-song">
      {contiTitle && <h1 className="print-conti-title">{contiTitle}</h1>}
      <header className="print-song-header">
        <h2>
          {index == null ? '' : `${index + 1}. `}
          {song.title}
        </h2>
        <p>
          {key} {(item?.bpm ?? song.bpm) ? `· ${item?.bpm ?? song.bpm} BPM` : ''}
        </p>
        <p className="print-form">송폼: {printForm(song, item) || '없음'}</p>
      </header>
      <div className="print-sections">
        {sections.length ? (
          sections.map((section, sectionIndex) => (
            <section className="print-section" key={`${section.id}-${sectionIndex}`}>
              <h3>{section.name}</h3>
              {section.lines.map((line) => (
                <PrintLine key={line.id} line={line} semitones={semitones} preferFlats={key.includes('b')} />
              ))}
            </section>
          ))
        ) : (
          <p className="print-empty">출력할 가사와 코드가 없습니다.</p>
        )}
      </div>
    </article>
  );
}

export function PrintPage({
  songId,
  contiId,
  itemId,
  displayKey,
}: {
  songId?: string;
  contiId?: string;
  itemId?: string;
  displayKey?: string;
}) {
  const [columns, setColumns] = useState<1 | 2>(2);
  const [paperColor, setPaperColor] = useState<'white' | 'black'>('white');
  const [songsQuery, contisQuery] = useQueries({
    queries: [
      contiId ? queries.listContiSongs({ path: { id: contiId } }) : queries.listSongs(),
      { ...queries.listContis(), enabled: Boolean(contiId) },
    ],
  });
  const conti: Conti | undefined = contisQuery.data?.find((entry) => entry.id === contiId);
  const songs = songsQuery.data ?? [];
  const singleSong = songs.find((entry) => entry.id === songId);
  const singleItem = itemId ? conti?.items.find((entry) => entry.id === itemId && entry.songId === songId) : undefined;
  const isPending = songsQuery.isPending || (Boolean(contiId) && contisQuery.isPending);
  const isError = songsQuery.isError || (Boolean(contiId) && contisQuery.isError);
  const emptyConti = Boolean(conti && !songId && conti.items.length === 0);
  const missingSongNumbers =
    !songId && conti
      ? conti.items.flatMap((item, index) => (songs.some((entry) => entry.id === item.songId) ? [] : [index + 1]))
      : [];
  const invalid =
    !isPending &&
    !isError &&
    ((!songId && !contiId) ||
      (Boolean(songId) && !singleSong) ||
      (Boolean(contiId) && !conti) ||
      (Boolean(itemId || (songId && contiId)) && !singleItem));

  return (
    <main className="print-page">
      <div className="print-toolbar">
        <Link
          href={
            contiId
              ? `/contis/${encodeURIComponent(contiId)}`
              : songId
                ? `/songs/${encodeURIComponent(songId)}`
                : '/songs'
          }
          color="secondary"
          isStandalone
        >
          ← 상세로
        </Link>
        <Selector
          label="세로 배치"
          options={[
            { label: '한 줄', value: '1' },
            { label: '두 줄', value: '2' },
          ]}
          value={String(columns)}
          onChange={(value) => setColumns(Number(value) as 1 | 2)}
        />
        <Selector
          label="용지 색상"
          options={[
            { label: '흰색', value: 'white' },
            { label: '검정', value: 'black' },
          ]}
          value={paperColor}
          onChange={(value) => setPaperColor(value as 'white' | 'black')}
        />
        <Button
          label="PDF로 저장 / 인쇄"
          onClick={() => window.print()}
          isDisabled={isPending || isError || invalid || emptyConti || missingSongNumbers.length > 0}
        />
      </div>
      {isPending ? (
        <p className="print-status">악보를 불러오는 중…</p>
      ) : isError ? (
        <p className="print-status" role="alert">
          악보를 불러오지 못했습니다. 새로고침해 주세요.
        </p>
      ) : invalid ? (
        <p className="print-status" role="alert">
          출력할 곡이나 콘티를 찾을 수 없습니다.
        </p>
      ) : (
        <>
          {emptyConti && (
            <p className="print-status print-blocked" role="alert">
              콘티에 출력할 곡이 없습니다. 곡을 추가한 뒤 다시 시도해 주세요.
            </p>
          )}
          {missingSongNumbers.length > 0 && (
            <p className="print-status print-blocked" role="alert">
              {missingSongNumbers.join(', ')}번째 곡을 사용할 수 없습니다. 누락된 곡이 있어 PDF 출력을 중단했습니다.
            </p>
          )}
          {!emptyConti && (
            <div
              className={`print-document print-columns-${columns} print-paper-${paperColor}${missingSongNumbers.length ? ' print-document-unavailable' : ''}`}
            >
              {singleSong ? (
                <PrintSong song={singleSong} item={singleItem} displayKey={displayKey} />
              ) : conti?.items.length ? (
                conti.items.map((item, index) => {
                  const song = songs.find((entry) => entry.id === item.songId);
                  return song ? (
                    <PrintSong
                      key={item.id}
                      song={song}
                      item={item}
                      index={index}
                      contiTitle={
                        index === 0
                          ? `${conti.title}${conti.scheduledDate ? ` · ${conti.scheduledDate}` : ''}`
                          : undefined
                      }
                    />
                  ) : (
                    <article className="print-song print-empty" key={item.id}>
                      {index + 1}. 사용할 수 없는 곡
                    </article>
                  );
                })
              ) : null}
            </div>
          )}
        </>
      )}
    </main>
  );
}
