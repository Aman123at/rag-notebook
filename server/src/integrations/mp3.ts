/**
 * In-process MP3 assembly for the podcast feature — no ffmpeg, no subprocess.
 *
 * OpenAI `gpt-4o-mini-tts` MP3 output was empirically confirmed (ticket 02) to be
 * tag-free CBR MPEG-2 Layer III with the bit reservoir unused, so byte-concatenating
 * fragments produces a valid, correctly-timed file. But NONE of that is documented,
 * so we validate frame headers at runtime rather than trusting the encoder: each
 * fragment must begin with a parseable MPEG audio frame, and any ID3 tag that does
 * appear is stripped. Duration is measured by walking frame headers, never guessed
 * from the first frame (which is how naive concatenations report the wrong length).
 */

// Bitrate tables in kbps, indexed by the 4-bit bitrate index. Index 0 = "free",
// 15 = "bad"; both are invalid for our fixed-CBR input.
const BITRATE_MPEG1_L3 = [
  0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0,
] as const;
const BITRATE_MPEG2_L3 = [
  0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0,
] as const;

// Sample-rate tables in Hz, indexed by the 2-bit sample-rate index (3 = reserved).
const SAMPLERATE_BY_VERSION: Record<number, readonly number[]> = {
  3: [44100, 48000, 32000, 0], // MPEG 1
  2: [22050, 24000, 16000, 0], // MPEG 2
  0: [11025, 12000, 8000, 0], // MPEG 2.5
};

interface FrameHeader {
  frameLength: number; // total bytes of this frame, including the 4-byte header
  sampleCount: number; // PCM samples this frame decodes to
  sampleRate: number; // Hz
}

/**
 * Parse an MPEG audio frame header at `offset`. Returns null when the four bytes
 * are not a valid Layer III frame header (bad sync, reserved version/layer, free
 * or bad bitrate, reserved sample rate) — the caller uses null to resync or stop.
 */
function parseFrameHeader(buf: Buffer, offset: number): FrameHeader | null {
  if (offset + 4 > buf.length) return null;
  const b1 = buf.readUInt8(offset);
  const b2 = buf.readUInt8(offset + 1);
  const b3 = buf.readUInt8(offset + 2);

  // Frame sync: 11 bits set (0xFFE).
  if (b1 !== 0xff || (b2 & 0xe0) !== 0xe0) return null;

  const version = (b2 >> 3) & 0x03; // 3=MPEG1, 2=MPEG2, 0=MPEG2.5, 1=reserved
  const layer = (b2 >> 1) & 0x03; // 1 = Layer III
  if (version === 1 || layer !== 0x01) return null;

  const bitrateIndex = (b3 >> 4) & 0x0f;
  const sampleRateIndex = (b3 >> 2) & 0x03;
  const padding = (b3 >> 1) & 0x01;

  const bitrateTable = version === 3 ? BITRATE_MPEG1_L3 : BITRATE_MPEG2_L3;
  const bitrateKbps = bitrateTable[bitrateIndex] ?? 0;
  const sampleRate = SAMPLERATE_BY_VERSION[version]?.[sampleRateIndex] ?? 0;
  if (bitrateKbps === 0 || sampleRate === 0) return null;

  const sampleCount = version === 3 ? 1152 : 576; // per Layer III frame
  const frameLength =
    Math.floor((sampleCount / 8) * ((bitrateKbps * 1000) / sampleRate)) + padding;
  if (frameLength <= 4) return null;

  return { frameLength, sampleCount, sampleRate };
}

/** Length in bytes of a leading ID3v2 tag at offset 0, or 0 if none is present. */
function id3v2Length(buf: Buffer): number {
  if (buf.length < 10 || buf.toString('latin1', 0, 3) !== 'ID3') return 0;
  // Synchsafe 28-bit size across bytes 6..9 (each low 7 bits), plus the 10-byte header.
  const size =
    ((buf.readUInt8(6) & 0x7f) << 21) |
    ((buf.readUInt8(7) & 0x7f) << 14) |
    ((buf.readUInt8(8) & 0x7f) << 7) |
    (buf.readUInt8(9) & 0x7f);
  return 10 + size;
}

/** True when a trailing 128-byte ID3v1 tag ("TAG...") is present. */
function hasId3v1(buf: Buffer): boolean {
  return buf.length >= 128 && buf.toString('latin1', buf.length - 128, buf.length - 125) === 'TAG';
}

/**
 * Return the audio-frame region of one fragment: ID3v2 stripped from the front,
 * ID3v1 from the back, and the first byte confirmed to start a real MPEG frame.
 * Throws when no valid frame is found near the start — that means the fragment is
 * not the CBR MP3 we assume, and a silent concatenation would corrupt the stream.
 */
function extractAudioRegion(fragment: Buffer, index: number): Buffer {
  let start = id3v2Length(fragment);
  let end = fragment.length;
  if (hasId3v1(fragment.subarray(start))) end -= 128;

  // Resync to the first frame within a small window (tolerates stray leading bytes).
  const scanLimit = Math.min(start + 4096, end - 4);
  let synced = -1;
  for (let i = start; i <= scanLimit; i++) {
    if (parseFrameHeader(fragment, i)) {
      synced = i;
      break;
    }
  }
  if (synced === -1) {
    throw new Error(`mp3 fragment #${index} has no MPEG frame header in its first 4KB`);
  }
  start = synced;
  return fragment.subarray(start, end);
}

/**
 * Concatenate TTS MP3 fragments into one valid MP3 buffer. Each fragment is
 * validated and tag-stripped first (see extractAudioRegion). Throws on the first
 * unparseable fragment rather than emitting a subtly corrupt file.
 */
export function concatMp3Fragments(fragments: readonly Buffer[]): Buffer {
  if (fragments.length === 0) throw new Error('concatMp3Fragments: no fragments');
  const regions = fragments.map((f, i) => extractAudioRegion(f, i));
  return Buffer.concat(regions);
}

/**
 * Measure duration in seconds by walking every frame header and summing
 * sampleCount / sampleRate. This is the real length even for a byte-concatenated
 * file, where the first frame's header describes only the first clip.
 */
export function measureMp3DurationSeconds(buf: Buffer): number {
  let offset = id3v2Length(buf);
  const end = hasId3v1(buf) ? buf.length - 128 : buf.length;
  let seconds = 0;
  let frames = 0;
  while (offset + 4 <= end) {
    const header = parseFrameHeader(buf, offset);
    if (!header) {
      // Resync: skip a byte and keep looking (robust to any inter-frame slack).
      offset += 1;
      continue;
    }
    seconds += header.sampleCount / header.sampleRate;
    frames += 1;
    offset += header.frameLength;
  }
  if (frames === 0) throw new Error('measureMp3DurationSeconds: no MPEG frames found');
  return seconds;
}
