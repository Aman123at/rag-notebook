export interface CollectedToolCall {
  id: string;
  name: string;
  argsBuffer: string;
}

export interface RoundOutcome {
  content: string;

  toolCalls: Map<number, CollectedToolCall>;

  finishReason: 'length' | 'stop' | 'tool_calls' | null;

  aborted: boolean;

  usage: { promptTokens: number; completionTokens: number; totalTokens: number };

  ttftMs: number | null;
}

export interface RoundSink {
  isClosed(): boolean;

  onToken(delta: string): void;
}

export interface StreamChunk {
  choices?: Array<{
    delta?:
      | {
          content?: string | null | undefined;
          tool_calls?:
            | Array<{
                index?: number | undefined;
                id?: string | undefined;
                function?:
                  { name?: string | undefined; arguments?: string | undefined } | undefined;
              }>
            | undefined;
        }
      | undefined;
    finish_reason?: string | null | undefined;
  }>;
  usage?:
    | {
        prompt_tokens?: number | undefined;
        completion_tokens?: number | undefined;
        total_tokens?: number | undefined;
      }
    | null
    | undefined;
}

export async function consumeModelRound(
  stream: AsyncIterable<StreamChunk>,
  sink: RoundSink,
  prior: { promptTokens: number; completionTokens: number; totalTokens: number },
  startedAt: number,
): Promise<RoundOutcome> {
  const toolCalls = new Map<number, CollectedToolCall>();
  const usage = { ...prior };
  let content = '';
  let finishReason: 'length' | 'stop' | 'tool_calls' | null = null;
  let ttftMs: number | null = null;
  let aborted = false;

  for await (const chunk of stream) {
    if (sink.isClosed()) {
      aborted = true;
      break;
    }
    const choice = chunk.choices?.[0];
    if (choice) {
      const delta = choice.delta;
      if (typeof delta?.content === 'string' && delta.content.length > 0) {
        if (ttftMs === null) ttftMs = Date.now() - startedAt;
        content += delta.content;
        sink.onToken(delta.content);
      }
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = typeof tc.index === 'number' ? tc.index : 0;
          let entry = toolCalls.get(idx);
          if (!entry) {
            entry = { id: tc.id ?? '', name: '', argsBuffer: '' };
            toolCalls.set(idx, entry);
          }
          if (tc.id) entry.id = tc.id;
          if (tc.function?.name) entry.name = tc.function.name;
          if (typeof tc.function?.arguments === 'string') {
            entry.argsBuffer += tc.function.arguments;
          }
        }
      }
      if (choice.finish_reason) {
        finishReason =
          choice.finish_reason === 'stop' ||
          choice.finish_reason === 'length' ||
          choice.finish_reason === 'tool_calls'
            ? choice.finish_reason
            : 'stop';
      }
    }
    if (chunk.usage) {
      usage.promptTokens = chunk.usage.prompt_tokens ?? usage.promptTokens;
      usage.completionTokens = chunk.usage.completion_tokens ?? usage.completionTokens;
      usage.totalTokens = chunk.usage.total_tokens ?? usage.totalTokens;
    }
  }

  return { content, toolCalls, finishReason, aborted, usage, ttftMs };
}
