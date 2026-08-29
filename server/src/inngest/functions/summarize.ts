import { inngest } from '@/inngest/client.js';
import { ChatSummarizeRequested } from '@/inngest/events.js';
import { regenerateChatSummary } from '@/services/chat/summary.js';

export const summarizeChatFunction = inngest.createFunction(
  {
    id: 'summarize-chat',
    name: 'Summarize chat',
    triggers: [{ event: 'chat/summarize.requested' }],

    concurrency: [{ key: 'event.data.chatId', limit: 1 }],
    retries: 2,
  },
  async ({ event, step }) => {
    const parsed = ChatSummarizeRequested.parse(event.data);
    return step.run('regenerate-summary', () =>
      regenerateChatSummary(parsed.userId, parsed.chatId),
    );
  },
);
