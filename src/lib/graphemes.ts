const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' });

export const graphemes = (text: string): string[] => Array.from(segmenter.segment(text), (part) => part.segment);

export const graphemeCount = (text: string): number => Array.from(segmenter.segment(text)).length;
