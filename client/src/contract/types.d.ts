/**
 * AUTO-GENERATED FROM src/contract/. Do not edit manually.
 * Regenerate with: pnpm contract:build
 */
export interface paths {
    "/_contract": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** What contract version this server speaks. */
        get: operations["ops.contract"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/artifacts/{artifactId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get one artifact. */
        get: operations["artifacts.get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/billing/checkout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Start a Razorpay checkout for an upgrade. */
        post: operations["billing.checkout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/chats/{chatId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get one chat. */
        get: operations["chats.get"];
        put?: never;
        post?: never;
        /** Soft-delete a chat. */
        delete: operations["chats.delete"];
        options?: never;
        head?: never;
        /** Rename, archive, or publish a chat. */
        patch: operations["chats.update"];
        trace?: never;
    };
    "/chats/{chatId}/messages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List messages in a chat (oldest → newest). */
        get: operations["chats.messages"];
        put?: never;
        /** Send a message; stream the assistant answer as chat SSE events. */
        post: operations["chats.sendMessage"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/coupons/redeem": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Redeem a plan coupon for the caller. */
        post: operations["billing.redeemCoupon"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/healthz": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Liveness probe — no dependencies checked. */
        get: operations["ops.healthz"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get the authenticated user, plan, quotas, and limits. */
        get: operations["identity.me"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Update the authenticated user profile. */
        patch: operations["identity.updateMe"];
        trace?: never;
    };
    "/me/usage": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Per-day usage breakdown for the caller. */
        get: operations["ops.usage"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/memories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List long-term memories for the caller. */
        get: operations["memories.list"];
        put?: never;
        /** Create a memory. */
        post: operations["memories.create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/memories/{memoryId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete a memory. */
        delete: operations["memories.delete"];
        options?: never;
        head?: never;
        /** Update a memory. */
        patch: operations["memories.update"];
        trace?: never;
    };
    "/messages/{messageId}/reaction": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Set, change, or clear a reaction on an assistant message. */
        post: operations["messages.reaction"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/plans": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Public plan catalogue. */
        get: operations["billing.plans"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/readyz": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Readiness probe — checks database and Qdrant. */
        get: operations["ops.readyz"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/sources/{sourceId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Fetch one source with the last failure attached when relevant. */
        get: operations["sources.get"];
        put?: never;
        post?: never;
        /** Soft-delete a source and schedule Qdrant/chunk cleanup. */
        delete: operations["sources.delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/sources/{sourceId}/artifacts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List derived artifacts for a source (newest first). */
        get: operations["artifacts.list"];
        put?: never;
        /** Trigger regeneration of an artifact for the source. Creates a new row; the latest is returned by artifacts.list. */
        post: operations["artifacts.create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/sources/{sourceId}/download": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Signed download URL for the original upload (5 minutes). */
        get: operations["sources.download"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/sources/{sourceId}/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Citation preview payload: PDF signed URL + page, or full text with char range for TEXT/VTT. */
        get: operations["sources.preview"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/sources/{sourceId}/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Retry a FAILED source (only when `failure.retryable`). */
        post: operations["sources.retry"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/sources/{sourceId}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Snapshot of a source’s pipeline status. */
        get: operations["sources.status"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/workspaces": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List the caller’s workspaces (excluding soft-deleted). */
        get: operations["workspaces.list"];
        put?: never;
        /** Create a workspace. Enforces the per-plan workspace cap. */
        post: operations["workspaces.create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/workspaces/{workspaceId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get one workspace. */
        get: operations["workspaces.get"];
        put?: never;
        post?: never;
        /** Soft-delete a workspace and schedule Qdrant cleanup. */
        delete: operations["workspaces.delete"];
        options?: never;
        head?: never;
        /** Rename or re-describe a workspace. */
        patch: operations["workspaces.update"];
        trace?: never;
    };
    "/workspaces/{workspaceId}/chats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List chats in a workspace, paginated. */
        get: operations["chats.list"];
        put?: never;
        /** Create a chat inside a workspace. */
        post: operations["chats.create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/workspaces/{workspaceId}/sources": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List sources in a workspace. `failure` is present only on FAILED rows (v1.2.0). */
        get: operations["sources.list"];
        put?: never;
        /** Register a source (file already uploaded, or URL) and enqueue extraction. */
        post: operations["sources.create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/workspaces/{workspaceId}/sources/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Server-sent stream of source pipeline updates (heartbeat every 20s). */
        get: operations["sources.statusStream"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/workspaces/{workspaceId}/sources/upload-intent": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Return a signed Cloudinary upload envelope. Never returns the API secret. */
        post: operations["sources.uploadIntent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export interface webhooks {
    "/webhooks/clerk": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Clerk lifecycle webhook (user.created, user.updated, user.deleted). */
        post: operations["identity.clerkWebhook"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/webhooks/razorpay": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Razorpay payment lifecycle webhook. */
        post: operations["billing.razorpayWebhook"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export interface components {
    schemas: {
        ApiError: {
            error: {
                /** @enum {string} */
                code: "VALIDATION_ERROR" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "PAYLOAD_TOO_LARGE" | "UNSUPPORTED_MEDIA_TYPE" | "PLAN_LIMIT_EXCEEDED" | "TOKEN_QUOTA_EXCEEDED" | "PROMPT_TOO_LONG" | "SECURITY_VIOLATION" | "USER_BLOCKED" | "SOURCE_NOT_READY" | "RATE_LIMITED" | "UPSTREAM_ERROR" | "INTERNAL_ERROR";
                details?: unknown;
                message: string;
                requestId: string;
            };
        };
        PaginationMeta: {
            hasMore?: boolean;
            page?: number;
            pageSize?: number;
            total?: number;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    "ops.contract": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description What contract version this server speaks. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            /** Format: date-time */
                            generatedAt: string;
                            gitSha: string;
                            version: string;
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "artifacts.get": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                artifactId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Get one artifact. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            content: unknown | null;
                            /** Format: date-time */
                            createdAt: string;
                            /** Format: uuid */
                            id: string;
                            /** @enum {string} */
                            kind: "PLAYLIST_ROADMAP";
                            modelName: string | null;
                            skipReason: string | null;
                            /** Format: uuid */
                            sourceId: string;
                            /** @enum {string} */
                            status: "PENDING" | "READY" | "SKIPPED" | "FAILED";
                            title: string;
                            tokensConsumed: number | null;
                            /** Format: date-time */
                            updatedAt: string;
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description FORBIDDEN */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description NOT_FOUND */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "billing.checkout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    couponCode?: string;
                    /** @enum {string} */
                    planTier: "FREE" | "PRO" | "CUSTOM";
                };
            };
        };
        responses: {
            /** @description Start a Razorpay checkout for an upgrade. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            keyId: string;
                            orderId: string;
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description VALIDATION_ERROR */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description CONFLICT */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description UPSTREAM_ERROR */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "chats.get": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                chatId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Get one chat. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            /** Format: date-time */
                            createdAt: string;
                            /** Format: uuid */
                            id: string;
                            isArchived: boolean;
                            isPublic: boolean;
                            messageCount: number;
                            publicSlug: string | null;
                            summary: string | null;
                            summaryUpdatedAt: string | null;
                            title: string;
                            /** Format: date-time */
                            updatedAt: string;
                            /** Format: uuid */
                            workspaceId: string;
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description FORBIDDEN */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description NOT_FOUND */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "chats.delete": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                chatId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Soft-delete a chat. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            /** @constant */
                            deleted: true;
                            /** Format: uuid */
                            id: string;
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description FORBIDDEN */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description NOT_FOUND */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "chats.update": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                chatId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    isArchived?: boolean;
                    isPublic?: boolean;
                    title?: string;
                };
            };
        };
        responses: {
            /** @description Rename, archive, or publish a chat. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            /** Format: date-time */
                            createdAt: string;
                            /** Format: uuid */
                            id: string;
                            isArchived: boolean;
                            isPublic: boolean;
                            messageCount: number;
                            publicSlug: string | null;
                            summary: string | null;
                            summaryUpdatedAt: string | null;
                            title: string;
                            /** Format: date-time */
                            updatedAt: string;
                            /** Format: uuid */
                            workspaceId: string;
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description VALIDATION_ERROR */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description FORBIDDEN */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description NOT_FOUND */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description CONFLICT */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "chats.messages": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                chatId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description List messages in a chat (oldest → newest). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            /** Format: uuid */
                            chatId: string;
                            citations: {
                                /** Format: uuid */
                                chunkId: string;
                                /** Format: uri */
                                deepLink?: string;
                                index: number;
                                locator: {
                                    /** @constant */
                                    kind: "pdf_page";
                                    page: number;
                                } | {
                                    endMs: number;
                                    /** @constant */
                                    kind: "timestamp";
                                    startMs: number;
                                    videoId?: string;
                                } | {
                                    endChar: number;
                                    /** @constant */
                                    kind: "text_range";
                                    startChar: number;
                                } | {
                                    /** @constant */
                                    kind: "web";
                                    section?: string;
                                    /** Format: uri */
                                    url: string;
                                };
                                score: number;
                                snippet: string;
                                /** Format: uuid */
                                sourceId: string;
                                sourceTitle: string;
                                /** @enum {string} */
                                sourceType: "PDF" | "TEXT" | "VTT" | "WEB_URL" | "YOUTUBE_VIDEO" | "YOUTUBE_PLAYLIST";
                            }[];
                            consumedTokens: number;
                            content: string;
                            /** Format: date-time */
                            createdAt: string;
                            dislikedReason: ("INAPPROPRIATE" | "HALLUCINATED" | "INCOMPLETE" | "OFF_TOPIC" | "OTHER") | null;
                            /** Format: uuid */
                            id: string;
                            modelName: string | null;
                            reaction: ("like" | "dislike") | null;
                            responseOfMessageId: string | null;
                            /** @enum {string} */
                            role: "user" | "assistant" | "system";
                            webCitations: {
                                index: number;
                                snippet: string;
                                title: string;
                                /** Format: uri */
                                url: string;
                            }[];
                        }[];
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description FORBIDDEN */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description NOT_FOUND */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "chats.sendMessage": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                chatId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    content: string;
                    /** @enum {string} */
                    model?: "gpt-4o-mini" | "gpt-4o";
                    webSearch?: boolean;
                };
            };
        };
        responses: {
            /** @description Send a message; stream the assistant answer as chat SSE events. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/event-stream": {
                        data: {
                            /** Format: uuid */
                            assistantMessageId: string;
                            /** Format: uuid */
                            chatId: string;
                            /** @enum {string} */
                            model: "gpt-4o-mini" | "gpt-4o";
                            /** Format: uuid */
                            userMessageId: string;
                        };
                        /** @constant */
                        type: "message_start";
                    } | {
                        data: {
                            chunkCount: number;
                            /** @enum {string} */
                            status: "started" | "completed" | "failed";
                        };
                        /** @constant */
                        type: "retrieval";
                    } | {
                        data: {
                            citations: {
                                /** Format: uuid */
                                chunkId: string;
                                /** Format: uri */
                                deepLink?: string;
                                index: number;
                                locator: {
                                    /** @constant */
                                    kind: "pdf_page";
                                    page: number;
                                } | {
                                    endMs: number;
                                    /** @constant */
                                    kind: "timestamp";
                                    startMs: number;
                                    videoId?: string;
                                } | {
                                    endChar: number;
                                    /** @constant */
                                    kind: "text_range";
                                    startChar: number;
                                } | {
                                    /** @constant */
                                    kind: "web";
                                    section?: string;
                                    /** Format: uri */
                                    url: string;
                                };
                                score: number;
                                snippet: string;
                                /** Format: uuid */
                                sourceId: string;
                                sourceTitle: string;
                                /** @enum {string} */
                                sourceType: "PDF" | "TEXT" | "VTT" | "WEB_URL" | "YOUTUBE_VIDEO" | "YOUTUBE_PLAYLIST";
                            }[];
                        };
                        /** @constant */
                        type: "citations";
                    } | {
                        data: {
                            query?: string;
                            remainingSearches?: number;
                            resultCount?: number;
                            /** @enum {string} */
                            status: "started" | "completed" | "failed";
                            /** @constant */
                            tool: "web_search";
                        };
                        /** @constant */
                        type: "tool_call";
                    } | {
                        data: {
                            citations: {
                                index: number;
                                snippet: string;
                                title: string;
                                /** Format: uri */
                                url: string;
                            }[];
                        };
                        /** @constant */
                        type: "web_citations";
                    } | {
                        data: {
                            query: string;
                            remainingSearches: number;
                        };
                        /** @constant */
                        type: "web_search_offer";
                    } | {
                        data: {
                            delta: string;
                        };
                        /** @constant */
                        type: "token";
                    } | {
                        data: {
                            completionTokens: number;
                            promptTokens: number;
                            remainingTokens: number | null;
                            totalTokens: number;
                        };
                        /** @constant */
                        type: "usage";
                    } | {
                        data: {
                            /** Format: uuid */
                            assistantMessageId: string;
                            /** @enum {string} */
                            finishReason: "stop" | "length" | "tool" | "aborted";
                        };
                        /** @constant */
                        type: "message_end";
                    } | {
                        data: {
                            /** @enum {string} */
                            code: "VALIDATION_ERROR" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "PAYLOAD_TOO_LARGE" | "UNSUPPORTED_MEDIA_TYPE" | "PLAN_LIMIT_EXCEEDED" | "TOKEN_QUOTA_EXCEEDED" | "PROMPT_TOO_LONG" | "SECURITY_VIOLATION" | "USER_BLOCKED" | "SOURCE_NOT_READY" | "RATE_LIMITED" | "UPSTREAM_ERROR" | "INTERNAL_ERROR";
                            details?: unknown;
                            message: string;
                        };
                        /** @constant */
                        type: "error";
                    } | {
                        data: {
                            t: number;
                        };
                        /** @constant */
                        type: "heartbeat";
                    };
                };
            };
            /** @description VALIDATION_ERROR */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description PLAN_LIMIT_EXCEEDED | TOKEN_QUOTA_EXCEEDED */
            402: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description FORBIDDEN | USER_BLOCKED */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description NOT_FOUND */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description SOURCE_NOT_READY */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description PROMPT_TOO_LONG | SECURITY_VIOLATION */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description RATE_LIMITED */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description UPSTREAM_ERROR */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "billing.redeemCoupon": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    code: string;
                };
            };
        };
        responses: {
            /** @description Redeem a plan coupon for the caller. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            /** Format: date-time */
                            activatedAt: string;
                            expiresAt: string | null;
                            /** @enum {string} */
                            planTier: "FREE" | "PRO" | "CUSTOM";
                            tokensGranted: number;
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description VALIDATION_ERROR */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description RATE_LIMITED */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "ops.healthz": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Liveness probe — no dependencies checked. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            /** @constant */
                            status: "ok";
                            uptimeSeconds: number;
                            version: string;
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "identity.me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Get the authenticated user, plan, quotas, and limits. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            displayName: string | null;
                            /** Format: email */
                            email: string;
                            /** Format: uuid */
                            id: string;
                            isActive: boolean;
                            isBlocked: boolean;
                            limits: {
                                /** @constant */
                                contactOnly?: false;
                                lifetimeTokens: number | null;
                                maxFileBytes: number;
                                maxPlaylistVideos: number;
                                maxPromptWords: number | null;
                                maxSourcesPerWorkspace: number | null;
                                maxWorkspaces: number | null;
                            } | {
                                /** @constant */
                                contactOnly: true;
                                lifetimeTokens: null;
                                maxFileBytes: null;
                                maxPlaylistVideos: null;
                                maxPromptWords: null;
                                maxSourcesPerWorkspace: null;
                                maxWorkspaces: null;
                            };
                            /** @enum {string} */
                            planTier: "FREE" | "PRO" | "CUSTOM";
                            tokens: {
                                assigned: number | null;
                                remaining: number | null;
                                usedCompletion: number;
                                usedEmbedding: number;
                            };
                            usage: {
                                overCaps: boolean;
                                workspaces: number;
                            };
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description USER_BLOCKED */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "identity.updateMe": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    displayName?: string;
                };
            };
        };
        responses: {
            /** @description Update the authenticated user profile. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            displayName: string | null;
                            /** Format: email */
                            email: string;
                            /** Format: uuid */
                            id: string;
                            isActive: boolean;
                            isBlocked: boolean;
                            limits: {
                                /** @constant */
                                contactOnly?: false;
                                lifetimeTokens: number | null;
                                maxFileBytes: number;
                                maxPlaylistVideos: number;
                                maxPromptWords: number | null;
                                maxSourcesPerWorkspace: number | null;
                                maxWorkspaces: number | null;
                            } | {
                                /** @constant */
                                contactOnly: true;
                                lifetimeTokens: null;
                                maxFileBytes: null;
                                maxPlaylistVideos: null;
                                maxPromptWords: null;
                                maxSourcesPerWorkspace: null;
                                maxWorkspaces: null;
                            };
                            /** @enum {string} */
                            planTier: "FREE" | "PRO" | "CUSTOM";
                            tokens: {
                                assigned: number | null;
                                remaining: number | null;
                                usedCompletion: number;
                                usedEmbedding: number;
                            };
                            usage: {
                                overCaps: boolean;
                                workspaces: number;
                            };
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description VALIDATION_ERROR */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description USER_BLOCKED */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "ops.usage": {
        parameters: {
            query?: {
                days?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Per-day usage breakdown for the caller. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            days: {
                                completionTokens: number;
                                date: string;
                                embeddingTokens: number;
                                messageCount: number;
                                promptTokens: number;
                            }[];
                            totals: {
                                completionTokens: number;
                                embeddingTokens: number;
                                messageCount: number;
                                promptTokens: number;
                            };
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description VALIDATION_ERROR */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "memories.list": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description List long-term memories for the caller. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            content: string;
                            /** Format: date-time */
                            createdAt: string;
                            /** Format: uuid */
                            id: string;
                            /** Format: date-time */
                            updatedAt: string;
                        }[];
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "memories.create": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    content: string;
                };
            };
        };
        responses: {
            /** @description Create a memory. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            content: string;
                            /** Format: date-time */
                            createdAt: string;
                            /** Format: uuid */
                            id: string;
                            /** Format: date-time */
                            updatedAt: string;
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description VALIDATION_ERROR */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "memories.delete": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                memoryId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Delete a memory. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            /** @constant */
                            deleted: true;
                            /** Format: uuid */
                            id: string;
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description FORBIDDEN */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description NOT_FOUND */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "memories.update": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                memoryId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    content: string;
                };
            };
        };
        responses: {
            /** @description Update a memory. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            content: string;
                            /** Format: date-time */
                            createdAt: string;
                            /** Format: uuid */
                            id: string;
                            /** Format: date-time */
                            updatedAt: string;
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description VALIDATION_ERROR */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description FORBIDDEN */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description NOT_FOUND */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "messages.reaction": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                messageId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    dislikedNote?: string;
                    /** @enum {string} */
                    dislikedReason?: "INAPPROPRIATE" | "HALLUCINATED" | "INCOMPLETE" | "OFF_TOPIC" | "OTHER";
                    reaction: ("like" | "dislike") | null;
                };
            };
        };
        responses: {
            /** @description Set, change, or clear a reaction on an assistant message. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            /** Format: uuid */
                            chatId: string;
                            citations: {
                                /** Format: uuid */
                                chunkId: string;
                                /** Format: uri */
                                deepLink?: string;
                                index: number;
                                locator: {
                                    /** @constant */
                                    kind: "pdf_page";
                                    page: number;
                                } | {
                                    endMs: number;
                                    /** @constant */
                                    kind: "timestamp";
                                    startMs: number;
                                    videoId?: string;
                                } | {
                                    endChar: number;
                                    /** @constant */
                                    kind: "text_range";
                                    startChar: number;
                                } | {
                                    /** @constant */
                                    kind: "web";
                                    section?: string;
                                    /** Format: uri */
                                    url: string;
                                };
                                score: number;
                                snippet: string;
                                /** Format: uuid */
                                sourceId: string;
                                sourceTitle: string;
                                /** @enum {string} */
                                sourceType: "PDF" | "TEXT" | "VTT" | "WEB_URL" | "YOUTUBE_VIDEO" | "YOUTUBE_PLAYLIST";
                            }[];
                            consumedTokens: number;
                            content: string;
                            /** Format: date-time */
                            createdAt: string;
                            dislikedReason: ("INAPPROPRIATE" | "HALLUCINATED" | "INCOMPLETE" | "OFF_TOPIC" | "OTHER") | null;
                            /** Format: uuid */
                            id: string;
                            modelName: string | null;
                            reaction: ("like" | "dislike") | null;
                            responseOfMessageId: string | null;
                            /** @enum {string} */
                            role: "user" | "assistant" | "system";
                            webCitations: {
                                index: number;
                                snippet: string;
                                title: string;
                                /** Format: uri */
                                url: string;
                            }[];
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description VALIDATION_ERROR */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description FORBIDDEN */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description NOT_FOUND */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "billing.plans": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Public plan catalogue. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            currency: string;
                            displayName: string;
                            features: string[];
                            interval: ("month" | "year" | "once") | null;
                            limits: {
                                /** @constant */
                                contactOnly?: false;
                                lifetimeTokens: number | null;
                                maxFileBytes: number;
                                maxPlaylistVideos: number;
                                maxPromptWords: number | null;
                                maxSourcesPerWorkspace: number | null;
                                maxWorkspaces: number | null;
                            } | {
                                /** @constant */
                                contactOnly: true;
                                lifetimeTokens: null;
                                maxFileBytes: null;
                                maxPlaylistVideos: null;
                                maxPromptWords: null;
                                maxSourcesPerWorkspace: null;
                                maxWorkspaces: null;
                            };
                            priceCents: number;
                            /** @enum {string} */
                            tier: "FREE" | "PRO" | "CUSTOM";
                        }[];
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "ops.readyz": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Readiness probe — checks database and Qdrant. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            checks: {
                                db: {
                                    latencyMs: number | null;
                                    message: string | null;
                                    ok: boolean;
                                } | null;
                                qdrant: {
                                    latencyMs: number | null;
                                    message: string | null;
                                    ok: boolean;
                                } | null;
                            };
                            /** @enum {string} */
                            status: "ok" | "degraded" | "down";
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "sources.get": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sourceId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Fetch one source with the last failure attached when relevant. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            chunkCount: number;
                            /** Format: date-time */
                            createdAt: string;
                            /** @enum {string} */
                            displayStatus: "uploading" | "processing" | "indexed" | "failed";
                            failure?: {
                                code: string;
                                message: string;
                                retryable: boolean;
                            };
                            /** Format: uuid */
                            id: string;
                            mediaId: string | null;
                            originalRef: string;
                            parentSourceId: string | null;
                            sizeBytes: number | null;
                            /** @enum {string} */
                            status: "PENDING" | "UPLOADED" | "EXTRACTING" | "EXTRACTED" | "SCANNING" | "CHUNKING" | "CHUNKED" | "INDEXING" | "READY" | "QUARANTINED" | "FAILED";
                            title: string;
                            /** @enum {string} */
                            type: "PDF" | "TEXT" | "VTT" | "WEB_URL" | "YOUTUBE_VIDEO" | "YOUTUBE_PLAYLIST";
                            /** Format: date-time */
                            updatedAt: string;
                            /** Format: uuid */
                            workspaceId: string;
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description FORBIDDEN */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description NOT_FOUND */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "sources.delete": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sourceId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Soft-delete a source and schedule Qdrant/chunk cleanup. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            /** @constant */
                            deleted: true;
                            /** Format: uuid */
                            id: string;
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description FORBIDDEN */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description NOT_FOUND */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "artifacts.list": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sourceId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description List derived artifacts for a source (newest first). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            content: unknown | null;
                            /** Format: date-time */
                            createdAt: string;
                            /** Format: uuid */
                            id: string;
                            /** @enum {string} */
                            kind: "PLAYLIST_ROADMAP";
                            modelName: string | null;
                            skipReason: string | null;
                            /** Format: uuid */
                            sourceId: string;
                            /** @enum {string} */
                            status: "PENDING" | "READY" | "SKIPPED" | "FAILED";
                            title: string;
                            tokensConsumed: number | null;
                            /** Format: date-time */
                            updatedAt: string;
                        }[];
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description FORBIDDEN */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description NOT_FOUND */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "artifacts.create": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sourceId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    kind?: "PLAYLIST_ROADMAP";
                };
            };
        };
        responses: {
            /** @description Trigger regeneration of an artifact for the source. Creates a new row; the latest is returned by artifacts.list. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            content: unknown | null;
                            /** Format: date-time */
                            createdAt: string;
                            /** Format: uuid */
                            id: string;
                            /** @enum {string} */
                            kind: "PLAYLIST_ROADMAP";
                            modelName: string | null;
                            skipReason: string | null;
                            /** Format: uuid */
                            sourceId: string;
                            /** @enum {string} */
                            status: "PENDING" | "READY" | "SKIPPED" | "FAILED";
                            title: string;
                            tokensConsumed: number | null;
                            /** Format: date-time */
                            updatedAt: string;
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description VALIDATION_ERROR */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description TOKEN_QUOTA_EXCEEDED */
            402: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description FORBIDDEN */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description NOT_FOUND */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description CONFLICT | SOURCE_NOT_READY */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "sources.download": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sourceId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Signed download URL for the original upload (5 minutes). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            /** Format: date-time */
                            expiresAt: string;
                            /** Format: uri */
                            url: string;
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description FORBIDDEN */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description NOT_FOUND */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "sources.preview": {
        parameters: {
            query: {
                chunkId: string;
            };
            header?: never;
            path: {
                sourceId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Citation preview payload: PDF signed URL + page, or full text with char range for TEXT/VTT. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            /** @constant */
                            contentType: "pdf";
                            /** Format: date-time */
                            expiresAt: string;
                            page: number;
                            /** Format: uri */
                            signedUrl: string;
                            sizeBytes: number;
                            snippet: string;
                        } | {
                            /** @enum {string} */
                            contentType: "text" | "vtt";
                            highlight: {
                                endChar: number;
                                snippet: string;
                                startChar: number;
                            };
                            sizeBytes: number;
                            text: string;
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description VALIDATION_ERROR */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description FORBIDDEN */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description NOT_FOUND */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description PAYLOAD_TOO_LARGE */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description UPSTREAM_ERROR */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "sources.retry": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sourceId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Retry a FAILED source (only when `failure.retryable`). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            chunkCount: number;
                            /** Format: date-time */
                            createdAt: string;
                            /** @enum {string} */
                            displayStatus: "uploading" | "processing" | "indexed" | "failed";
                            /** Format: uuid */
                            id: string;
                            mediaId: string | null;
                            originalRef: string;
                            parentSourceId: string | null;
                            sizeBytes: number | null;
                            /** @enum {string} */
                            status: "PENDING" | "UPLOADED" | "EXTRACTING" | "EXTRACTED" | "SCANNING" | "CHUNKING" | "CHUNKED" | "INDEXING" | "READY" | "QUARANTINED" | "FAILED";
                            title: string;
                            /** @enum {string} */
                            type: "PDF" | "TEXT" | "VTT" | "WEB_URL" | "YOUTUBE_VIDEO" | "YOUTUBE_PLAYLIST";
                            /** Format: date-time */
                            updatedAt: string;
                            /** Format: uuid */
                            workspaceId: string;
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description FORBIDDEN */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description NOT_FOUND */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description CONFLICT | SOURCE_NOT_READY */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "sources.status": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sourceId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Snapshot of a source’s pipeline status. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            /** @enum {string} */
                            displayStatus: "uploading" | "processing" | "indexed" | "failed";
                            /** Format: uuid */
                            id: string;
                            progress: number;
                            /** @enum {string} */
                            status: "PENDING" | "UPLOADED" | "EXTRACTING" | "EXTRACTED" | "SCANNING" | "CHUNKING" | "CHUNKED" | "INDEXING" | "READY" | "QUARANTINED" | "FAILED";
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description FORBIDDEN */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description NOT_FOUND */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "workspaces.list": {
        parameters: {
            query?: {
                page?: number;
                pageSize?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description List the caller’s workspaces (excluding soft-deleted). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            /** Format: date-time */
                            createdAt: string;
                            description: string | null;
                            /** Format: uuid */
                            id: string;
                            name: string;
                            sourceCount: number;
                            /** Format: date-time */
                            updatedAt: string;
                        }[];
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description VALIDATION_ERROR */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "workspaces.create": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    description?: string;
                    name: string;
                };
            };
        };
        responses: {
            /** @description Create a workspace. Enforces the per-plan workspace cap. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            /** Format: date-time */
                            createdAt: string;
                            description: string | null;
                            /** Format: uuid */
                            id: string;
                            name: string;
                            sourceCount: number;
                            /** Format: date-time */
                            updatedAt: string;
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description VALIDATION_ERROR */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description PLAN_LIMIT_EXCEEDED */
            402: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description CONFLICT */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "workspaces.get": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                workspaceId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Get one workspace. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            /** Format: date-time */
                            createdAt: string;
                            description: string | null;
                            /** Format: uuid */
                            id: string;
                            name: string;
                            sourceCount: number;
                            /** Format: date-time */
                            updatedAt: string;
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description FORBIDDEN */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description NOT_FOUND */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "workspaces.delete": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                workspaceId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Soft-delete a workspace and schedule Qdrant cleanup. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            /** @constant */
                            deleted: true;
                            /** Format: uuid */
                            id: string;
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description FORBIDDEN */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description NOT_FOUND */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "workspaces.update": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                workspaceId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    description?: string | null;
                    name?: string;
                };
            };
        };
        responses: {
            /** @description Rename or re-describe a workspace. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            /** Format: date-time */
                            createdAt: string;
                            description: string | null;
                            /** Format: uuid */
                            id: string;
                            name: string;
                            sourceCount: number;
                            /** Format: date-time */
                            updatedAt: string;
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description VALIDATION_ERROR */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description FORBIDDEN */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description NOT_FOUND */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description CONFLICT */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "chats.list": {
        parameters: {
            query?: {
                page?: number;
                pageSize?: number;
            };
            header?: never;
            path: {
                workspaceId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description List chats in a workspace, paginated. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            /** Format: date-time */
                            createdAt: string;
                            /** Format: uuid */
                            id: string;
                            isArchived: boolean;
                            isPublic: boolean;
                            messageCount: number;
                            publicSlug: string | null;
                            summary: string | null;
                            summaryUpdatedAt: string | null;
                            title: string;
                            /** Format: date-time */
                            updatedAt: string;
                            /** Format: uuid */
                            workspaceId: string;
                        }[];
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description VALIDATION_ERROR */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description FORBIDDEN */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description NOT_FOUND */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "chats.create": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                workspaceId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    title?: string;
                };
            };
        };
        responses: {
            /** @description Create a chat inside a workspace. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            /** Format: date-time */
                            createdAt: string;
                            /** Format: uuid */
                            id: string;
                            isArchived: boolean;
                            isPublic: boolean;
                            messageCount: number;
                            publicSlug: string | null;
                            summary: string | null;
                            summaryUpdatedAt: string | null;
                            title: string;
                            /** Format: date-time */
                            updatedAt: string;
                            /** Format: uuid */
                            workspaceId: string;
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description VALIDATION_ERROR */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description FORBIDDEN */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description NOT_FOUND */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "sources.list": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                workspaceId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description List sources in a workspace. `failure` is present only on FAILED rows (v1.2.0). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            chunkCount: number;
                            /** Format: date-time */
                            createdAt: string;
                            /** @enum {string} */
                            displayStatus: "uploading" | "processing" | "indexed" | "failed";
                            failure?: {
                                code: string;
                                message: string;
                                retryable: boolean;
                            };
                            /** Format: uuid */
                            id: string;
                            mediaId: string | null;
                            originalRef: string;
                            parentSourceId: string | null;
                            sizeBytes: number | null;
                            /** @enum {string} */
                            status: "PENDING" | "UPLOADED" | "EXTRACTING" | "EXTRACTED" | "SCANNING" | "CHUNKING" | "CHUNKED" | "INDEXING" | "READY" | "QUARANTINED" | "FAILED";
                            title: string;
                            /** @enum {string} */
                            type: "PDF" | "TEXT" | "VTT" | "WEB_URL" | "YOUTUBE_VIDEO" | "YOUTUBE_PLAYLIST";
                            /** Format: date-time */
                            updatedAt: string;
                            /** Format: uuid */
                            workspaceId: string;
                        }[];
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description FORBIDDEN */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description NOT_FOUND */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "sources.create": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                workspaceId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Register a source (file already uploaded, or URL) and enqueue extraction. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            chunkCount: number;
                            /** Format: date-time */
                            createdAt: string;
                            /** @enum {string} */
                            displayStatus: "uploading" | "processing" | "indexed" | "failed";
                            /** Format: uuid */
                            id: string;
                            mediaId: string | null;
                            originalRef: string;
                            parentSourceId: string | null;
                            sizeBytes: number | null;
                            /** @enum {string} */
                            status: "PENDING" | "UPLOADED" | "EXTRACTING" | "EXTRACTED" | "SCANNING" | "CHUNKING" | "CHUNKED" | "INDEXING" | "READY" | "QUARANTINED" | "FAILED";
                            title: string;
                            /** @enum {string} */
                            type: "PDF" | "TEXT" | "VTT" | "WEB_URL" | "YOUTUBE_VIDEO" | "YOUTUBE_PLAYLIST";
                            /** Format: date-time */
                            updatedAt: string;
                            /** Format: uuid */
                            workspaceId: string;
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description VALIDATION_ERROR */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description PLAN_LIMIT_EXCEEDED */
            402: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description FORBIDDEN */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description NOT_FOUND */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description CONFLICT */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "sources.statusStream": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                workspaceId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Server-sent stream of source pipeline updates (heartbeat every 20s). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/event-stream": {
                        data: {
                            chunkCount: number;
                            /** @enum {string} */
                            displayStatus: "uploading" | "processing" | "indexed" | "failed";
                            /** Format: uuid */
                            sourceId: string;
                            /** @enum {string} */
                            status: "PENDING" | "UPLOADED" | "EXTRACTING" | "EXTRACTED" | "SCANNING" | "CHUNKING" | "CHUNKED" | "INDEXING" | "READY" | "QUARANTINED" | "FAILED";
                        };
                        /** @constant */
                        type: "source_status";
                    } | {
                        data: {
                            t: number;
                        };
                        /** @constant */
                        type: "heartbeat";
                    };
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description FORBIDDEN */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description NOT_FOUND */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "sources.uploadIntent": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                workspaceId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    fileName: string;
                    mimeType: string;
                    sizeBytes: number;
                };
            };
        };
        responses: {
            /** @description Return a signed Cloudinary upload envelope. Never returns the API secret. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            apiKey: string;
                            /** Format: date-time */
                            expiresAt: string;
                            publicId: string;
                            /** @enum {string} */
                            resourceType: "auto" | "image" | "video" | "raw";
                            signature: string;
                            timestamp: number;
                            /** Format: uri */
                            uploadUrl: string;
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description VALIDATION_ERROR */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description PLAN_LIMIT_EXCEEDED */
            402: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description FORBIDDEN */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description NOT_FOUND */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description PAYLOAD_TOO_LARGE */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description UNSUPPORTED_MEDIA_TYPE */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "identity.clerkWebhook": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Clerk lifecycle webhook (user.created, user.updated, user.deleted). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            /** @constant */
                            received: true;
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description VALIDATION_ERROR */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    "billing.razorpayWebhook": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Razorpay payment lifecycle webhook. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            /** @constant */
                            received: true;
                        };
                        meta?: components["schemas"]["PaginationMeta"];
                    };
                };
            };
            /** @description VALIDATION_ERROR */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
}
