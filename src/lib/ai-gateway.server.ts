import { createOpenAI } from "@ai-sdk/openai";

const RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

export function createLovableResponsesProvider(apiKey: string, initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  let resolveRunId: (value: string | undefined) => void = () => {};
  let settled = false;
  const ready = new Promise<string | undefined>((resolve) => {
    resolveRunId = resolve;
  });

  const publish = (value?: string) => {
    if (!runId && value?.trim()) runId = value.trim();
    if (!settled) {
      settled = true;
      resolveRunId(runId);
    }
  };
  if (runId) publish(runId);

  const runIdFetch: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    if (runId && !headers.has(RUN_ID_HEADER)) headers.set(RUN_ID_HEADER, runId);

    try {
      const response = await fetch(input, { ...init, headers });
      publish(response.headers.get(RUN_ID_HEADER) ?? undefined);
      return response;
    } catch (error) {
      publish(undefined);
      throw error;
    }
  };

  return {
    provider: createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: {
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      fetch: runIdFetch,
    }),
    getRunId: () => runId,
    waitForRunId: () => (runId ? Promise.resolve(runId) : ready),
  };
}
