import { cleanupSourceFunction, cleanupUserFunction, cleanupWorkspaceFunction } from './cleanup.js';
import { expandPlaylistFunction } from './expand-playlist.js';
import {
  generateArtifactFunction,
  playlistArtifactAggregatorFunction,
} from './generate-artifact.js';
import { ingestSourceFunction } from './ingest-source.js';
import { generatePodcastFunction, markPodcastStaleFunction } from './podcast.js';
import { summarizeChatFunction } from './summarize.js';
import { sweepReservationsFunction } from './sweep-reservations.js';

export const inngestFunctions = [
  ingestSourceFunction,
  expandPlaylistFunction,
  cleanupSourceFunction,
  cleanupWorkspaceFunction,
  cleanupUserFunction,
  summarizeChatFunction,
  sweepReservationsFunction,
  playlistArtifactAggregatorFunction,
  generateArtifactFunction,
  generatePodcastFunction,
  markPodcastStaleFunction,
];

export {
  cleanupSourceFunction,
  cleanupUserFunction,
  cleanupWorkspaceFunction,
  expandPlaylistFunction,
  generateArtifactFunction,
  generatePodcastFunction,
  ingestSourceFunction,
  markPodcastStaleFunction,
  playlistArtifactAggregatorFunction,
  summarizeChatFunction,
  sweepReservationsFunction,
};
