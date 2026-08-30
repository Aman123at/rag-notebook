import { describe, expect, it } from 'vitest';

import {
  type CaptionTrack,
  parseJson3,
  parseTimedText,
  parseTimedTextXml,
  selectCaptionTrack,
} from '../src/integrations/youtube-captions.js';

describe('parseJson3', () => {
  it('reads json3 events as millisecond-based cues', () => {
    const body = JSON.stringify({
      events: [
        { tStartMs: 0, dDurationMs: 2500, segs: [{ utf8: 'First' }, { utf8: ' line' }] },
        { tStartMs: 2500, dDurationMs: 1500, segs: [{ utf8: 'Second line' }] },
      ],
    });
    expect(parseJson3(body)).toEqual([
      { startMs: 0, endMs: 2500, text: 'First line' },
      { startMs: 2500, endMs: 4000, text: 'Second line' },
    ]);
  });

  it('drops rolling-caption duplicates and window-only events', () => {
    const body = JSON.stringify({
      events: [
        { tStartMs: 0, dDurationMs: 1000, wWinStyles: 1 },
        { tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: 'Kept' }] },
        { tStartMs: 900, dDurationMs: 1000, aAppend: 1, segs: [{ utf8: ' repeated' }] },
      ],
    });
    expect(parseJson3(body)).toEqual([{ startMs: 0, endMs: 1000, text: 'Kept' }]);
  });

  it('skips whitespace-only cues and collapses internal newlines', () => {
    const body = JSON.stringify({
      events: [
        { tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: '\n' }] },
        { tStartMs: 1000, dDurationMs: 1000, segs: [{ utf8: 'wrapped\nacross  lines' }] },
      ],
    });
    expect(parseJson3(body)).toEqual([{ startMs: 1000, endMs: 2000, text: 'wrapped across lines' }]);
  });

  it('gives a zero-duration cue the next cue start as its end', () => {
    const body = JSON.stringify({
      events: [
        { tStartMs: 0, segs: [{ utf8: 'A' }] },
        { tStartMs: 4000, dDurationMs: 1000, segs: [{ utf8: 'B' }] },
      ],
    });
    expect(parseJson3(body)).toEqual([
      { startMs: 0, endMs: 4000, text: 'A' },
      { startMs: 4000, endMs: 5000, text: 'B' },
    ]);
  });

  it('falls back to a default span for a trailing cue with no duration', () => {
    const body = JSON.stringify({ events: [{ tStartMs: 1000, segs: [{ utf8: 'Last' }] }] });
    expect(parseJson3(body)).toEqual([{ startMs: 1000, endMs: 4000, text: 'Last' }]);
  });

  it('returns nothing for a non-JSON body rather than throwing', () => {
    expect(parseJson3('not json at all')).toEqual([]);
  });
});

describe('parseTimedTextXml', () => {
  it('reads srv3 <p t= d=> attributes as milliseconds', () => {
    const xml = `<?xml version="1.0" encoding="utf-8" ?><timedtext format="3"><body>
      <p t="1360" d="1680">Opening remark</p>
      <p t="3040" d="2000"><s>Split</s><s> across segments</s></p>
    </body></timedtext>`;
    expect(parseTimedTextXml(xml)).toEqual([
      { startMs: 1360, endMs: 3040, text: 'Opening remark' },
      { startMs: 3040, endMs: 5040, text: 'Split across segments' },
    ]);
  });

  it('reads srv1 <text start= dur=> attributes as seconds', () => {
    const xml = `<?xml version="1.0" encoding="utf-8" ?><transcript>
      <text start="0" dur="2.5">Hello there</text>
      <text start="2.5" dur="1.5">Goodbye</text>
    </transcript>`;
    expect(parseTimedTextXml(xml)).toEqual([
      { startMs: 0, endMs: 2500, text: 'Hello there' },
      { startMs: 2500, endMs: 4000, text: 'Goodbye' },
    ]);
  });

  it('decodes double-encoded entities', () => {
    const xml = `<transcript><text start="0" dur="1">it&amp;#39;s &amp;quot;quoted&amp;quot; &amp;amp; fine</text></transcript>`;
    expect(parseTimedTextXml(xml)[0]?.text).toBe('it\'s "quoted" & fine');
  });
});

describe('parseTimedText', () => {
  it('dispatches on body shape', () => {
    const json = JSON.stringify({ events: [{ tStartMs: 0, dDurationMs: 10, segs: [{ utf8: 'J' }] }] });
    expect(parseTimedText(json)).toEqual([{ startMs: 0, endMs: 10, text: 'J' }]);
    expect(parseTimedText('  <transcript><text start="0" dur="1">X</text></transcript>')).toEqual([
      { startMs: 0, endMs: 1000, text: 'X' },
    ]);
    expect(parseTimedText('   ')).toEqual([]);
  });
});

describe('selectCaptionTrack', () => {
  const track = (languageCode: string, kind?: string): CaptionTrack => ({
    baseUrl: `https://example.test/${languageCode}${kind ?? ''}`,
    languageCode,
    ...(kind !== undefined ? { kind } : {}),
  });

  it('prefers a manual English track over the English ASR track', () => {
    const chosen = selectCaptionTrack([track('en', 'asr'), track('de'), track('en')]);
    expect(chosen?.baseUrl).toBe('https://example.test/en');
  });

  it('accepts an English ASR track when no manual English track exists', () => {
    const chosen = selectCaptionTrack([track('de'), track('en', 'asr')]);
    expect(chosen).toMatchObject({ languageCode: 'en', kind: 'asr' });
  });

  it('matches regional English variants', () => {
    const chosen = selectCaptionTrack([track('ja'), track('en-GB')]);
    expect(chosen).toMatchObject({ languageCode: 'en-GB' });
  });

  it('falls back to a manual track in another language', () => {
    const chosen = selectCaptionTrack([track('hi', 'asr'), track('ja')]);
    expect(chosen).toMatchObject({ languageCode: 'ja' });
  });

  it('ignores tracks with no download URL', () => {
    const chosen = selectCaptionTrack([{ languageCode: 'en', baseUrl: '' }, track('ja')]);
    expect(chosen).toMatchObject({ languageCode: 'ja' });
  });

  it('returns null when there is nothing usable', () => {
    expect(selectCaptionTrack([])).toBeNull();
    expect(selectCaptionTrack([{ languageCode: 'en' }])).toBeNull();
  });
});
