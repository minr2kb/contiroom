'use client';

import { Button } from '@astryxdesign/core/Button';
import { Selector } from '@astryxdesign/core/Selector';
import { useQueries } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download } from 'lucide-react';
import { useRef, useState } from 'react';
import { queries } from '@/lib/data-api';
import type { Conti, ContiItem, LyricLine, Song } from '@/lib/model';
import { itemSemitones, keyPitch, transposeChord } from '@/lib/music';
import { printForm, printLineSegments } from '@/lib/print-score';
import './print.css';
import { HStack } from '@astryxdesign/core/HStack';

function PrintLine({
  line,
  semitones,
  preferFlats,
  showTranslation,
}: {
  line: LyricLine;
  semitones: number;
  preferFlats: boolean;
  showTranslation: boolean;
}) {
  return (
    <div className="print-line-group">
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
      {showTranslation && line.translation?.trim() && <p className="print-translation">{line.translation}</p>}
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
                <PrintLine
                  key={line.id}
                  line={line}
                  semitones={semitones}
                  preferFlats={key.includes('b')}
                  showTranslation={Boolean(song.translationEnabled)}
                />
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
  const router = useRouter();
  const [paperColor, setPaperColor] = useState<'white' | 'black'>('white');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const documentRef = useRef<HTMLDivElement>(null);
  const downloadingRef = useRef(false);
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

  async function downloadPdf() {
    if (downloadingRef.current || !documentRef.current) return;
    downloadingRef.current = true;
    setIsDownloading(true);
    setDownloadError(false);

    const capture = documentRef.current.cloneNode(true) as HTMLDivElement;
    capture.style.cssText = 'position: fixed; top: 0; left: -10000px; width: 210mm; padding: 0; pointer-events: none;';
    document.body.append(capture);

    try {
      const [{ toCanvas }, { PDFDocument }] = await Promise.all([import('html-to-image'), import('pdf-lib')]);
      await document.fonts.ready;
      const pdf = await PDFDocument.create();
      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const cssPageHeight = 297 * (96 / 25.4);
      const cssMargin = 14 * (96 / 25.4);
      const background = paperColor === 'black' ? '#111' : '#fff';

      for (const song of capture.querySelectorAll<HTMLElement>('.print-song')) {
        song.style.zoom = '1';
        const canvas = await toCanvas(song, { pixelRatio: 2, backgroundColor: background });
        const scale = canvas.height / song.scrollHeight;
        const songTop = song.getBoundingClientRect().top;
        const occupied = [
          ...song.querySelectorAll<HTMLElement>(
            '.print-conti-title, .print-song-header, .print-section h3, .print-line-group, .print-empty',
          ),
        ].map((element) => {
          const rect = element.getBoundingClientRect();
          return { top: rect.top - songTop, bottom: rect.bottom - songTop };
        });
        for (const section of song.querySelectorAll<HTMLElement>('.print-section')) {
          const heading = section.querySelector('h3');
          const firstLine = section.querySelector('.print-line-group');
          if (heading && firstLine) {
            occupied.push({
              top: heading.getBoundingClientRect().top - songTop,
              bottom: firstLine.getBoundingClientRect().bottom - songTop,
            });
          }
        }
        const contentBottom = Math.max(...occupied.map(({ bottom }) => bottom));

        let start = 0;
        while (start < contentBottom) {
          const firstPage = start === 0;
          const limit = Math.min(contentBottom, start + cssPageHeight - (firstPage ? cssMargin : 2 * cssMargin));
          let end = limit;
          if (limit < contentBottom) {
            // Keep each lyric group intact when a long song continues on another A4 page.
            while (true) {
              const crossing = occupied.find(({ top, bottom }) => top < end && end < bottom);
              if (!crossing) break;
              end = crossing.top;
            }
            if (end <= start) throw new Error('A lyric line is taller than one PDF page.');
          }

          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = Math.round(cssPageHeight * scale);
          const context = pageCanvas.getContext('2d');
          if (!context) throw new Error('Canvas is unavailable.');
          context.fillStyle = background;
          context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          const sourceY = Math.round(start * scale);
          const sourceHeight = Math.min(canvas.height - sourceY, Math.round((end - start) * scale));
          context.drawImage(
            canvas,
            0,
            sourceY,
            canvas.width,
            sourceHeight,
            0,
            firstPage ? 0 : Math.round(cssMargin * scale),
            canvas.width,
            sourceHeight,
          );
          const image = await pdf.embedPng(pageCanvas.toDataURL('image/png'));
          pdf.addPage([pageWidth, pageHeight]).drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight });
          start = end;
        }
      }

      const bytes = await pdf.save();
      const url = URL.createObjectURL(new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' }));
      const filename =
        (singleSong?.title || conti?.title || '악보')
          .replace(/[\\/:*?"<>|]|\p{Cc}/gu, '')
          .replace(/^\.+|\.+$/g, '')
          .trim() || '악보';
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      console.error('PDF 다운로드 실패', error);
      setDownloadError(true);
    } finally {
      capture.remove();
      downloadingRef.current = false;
      setIsDownloading(false);
    }
  }

  return (
    <main className="print-page">
      <div className="print-toolbar">
        <Button
          label="뒤로가기"
          icon={<ArrowLeft aria-hidden="true" />}
          variant="ghost"
          onClick={() => router.back()}
          isIconOnly
        />
        <HStack align="center" gap={2}>
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-400">배경</span>
            <Selector
              label="배경"
              isLabelHidden
              options={[
                { label: '흰색', value: 'white' },
                { label: '검정', value: 'black' },
              ]}
              value={paperColor}
              onChange={(value) => setPaperColor(value as 'white' | 'black')}
            />
          </div>
          <Button
            label={isDownloading ? 'PDF 만드는 중…' : 'PDF 다운로드'}
            tooltip={isDownloading ? 'PDF 만드는 중…' : 'PDF 다운로드'}
            icon={<Download aria-hidden="true" />}
            isIconOnly
            onClick={downloadPdf}
            isDisabled={isDownloading || isPending || isError || invalid || emptyConti || missingSongNumbers.length > 0}
          />
        </HStack>
      </div>
      {downloadError && (
        <p className="print-status" role="alert">
          PDF를 만들지 못했습니다. 다시 시도해 주세요.
        </p>
      )}
      {isPending ? (
        <p className="print-status">악보를 불러오는 중…</p>
      ) : isError ? (
        <p className="print-status" role="alert">
          악보를 불러오지 못했습니다. 새로고침해 주세요.
        </p>
      ) : invalid ? (
        <p className="print-status" role="alert">
          다운로드할 곡이나 콘티를 찾을 수 없습니다.
        </p>
      ) : (
        <>
          {emptyConti && (
            <p className="print-status print-blocked" role="alert">
              콘티에 다운로드할 곡이 없습니다. 곡을 추가한 뒤 다시 시도해 주세요.
            </p>
          )}
          {missingSongNumbers.length > 0 && (
            <p className="print-status print-blocked" role="alert">
              {missingSongNumbers.join(', ')}번째 곡을 사용할 수 없습니다. 누락된 곡이 있어 PDF 다운로드를 중단했습니다.
            </p>
          )}
          {!emptyConti && (
            <div
              ref={documentRef}
              className={`print-document print-paper-${paperColor}${missingSongNumbers.length ? ' print-document-unavailable' : ''}`}
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
