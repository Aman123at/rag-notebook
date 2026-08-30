









export interface PlanLimits {
  
  maxWorkspaces: number | null;
  
  maxSourcesPerWorkspace: number | null;
  



  lifetimeTokens: number | null;
  
  maxPromptWords: number | null;
  
  maxFileBytes: number;
  
  maxPlaylistVideos: number;
  /** Max concurrent podcasts across ALL workspaces (a live slot count, not lifetime). null = unlimited. */
  maxPodcasts: number | null;
}






export interface CustomPlanLimits {
  contactOnly: true;
  maxWorkspaces: null;
  maxSourcesPerWorkspace: null;
  lifetimeTokens: null;
  maxPromptWords: null;
  maxFileBytes: null;
  maxPlaylistVideos: null;
  maxPodcasts: null;
}

export const FREE_PLAN_LIMITS: PlanLimits = Object.freeze({
  maxWorkspaces: 10,
  maxSourcesPerWorkspace: 7,
  lifetimeTokens: 1_000_000,
  maxPromptWords: 5000,
  maxFileBytes: 10 * 1024 * 1024,
  maxPlaylistVideos: 20,
  maxPodcasts: 1,
});

export const PRO_PLAN_LIMITS: PlanLimits = Object.freeze({
  maxWorkspaces: 100,
  maxSourcesPerWorkspace: null,
  lifetimeTokens: null,
  maxPromptWords: null,
  maxFileBytes: 100 * 1024 * 1024,
  maxPlaylistVideos: 200,
  maxPodcasts: 10,
});

export const CUSTOM_PLAN_LIMITS: CustomPlanLimits = Object.freeze({
  contactOnly: true,
  maxWorkspaces: null,
  maxSourcesPerWorkspace: null,
  lifetimeTokens: null,
  maxPromptWords: null,
  maxFileBytes: null,
  maxPlaylistVideos: null,
  maxPodcasts: null,
});


export const PLAN_LIMITS = Object.freeze({
  FREE: FREE_PLAN_LIMITS,
  PRO: PRO_PLAN_LIMITS,
  CUSTOM: CUSTOM_PLAN_LIMITS,
});





export const CHUNKING = Object.freeze({
  CHUNK_SIZE: 1000,
  CHUNK_OVERLAP: 100,
  VTT_CHUNK_TARGET_MS: 45_000,
  







  EMBEDDING_TEXT_HEADER: true,
  




  VTT_TOPIC_GAP_MS: 30_000,
});

export const RETRIEVAL = Object.freeze({
  denseTopK: 40,
  sparseTopK: 40,
  rrfK: 60,
  finalTopK: 8,
  maxPerSource: 4,
});

export const EMBEDDING = Object.freeze({
  EMBEDDING_DIMENSIONS: 1536,
});

export const BM25 = Object.freeze({
  k1: 1.2,
  b: 0.75,
  fixedAvgDocLength: 256,
});

export const CHAT_CONTEXT = Object.freeze({
  SUMMARY_INTERVAL: 8,
  RECENT_MESSAGE_WINDOW: 12,
});











export const WEB_SEARCH = Object.freeze({
  
  MAX_PER_CHAT: 5,
  
  MAX_RESULTS: 5,
});


export const TUNABLES = Object.freeze({
  chunking: CHUNKING,
  retrieval: RETRIEVAL,
  embedding: EMBEDDING,
  bm25: BM25,
  chatContext: CHAT_CONTEXT,
  webSearch: WEB_SEARCH,
});
