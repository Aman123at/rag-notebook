import { inngest } from '@/inngest/client.js';
import { PlaylistExpandRequested } from '@/inngest/events.js';

export const expandPlaylistFunction = inngest.createFunction(
  {
    id: 'expand-playlist',
    name: 'Expand YouTube playlist',
    triggers: [{ event: 'playlist/expand.requested' }],
  },

  ({ event }) => {
    const parsed = PlaylistExpandRequested.parse(event.data);

    return { deferred: 'S9', sourceId: parsed.sourceId, playlistId: parsed.playlistId };
  },
);
