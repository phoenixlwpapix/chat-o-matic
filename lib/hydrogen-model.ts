import { createGoogleGenerativeAI } from "@ai-sdk/google";

const hydrogenProvider = createGoogleGenerativeAI({
  // The installed SDK predates Gemini 4 and serializes its search tool as legacy retrieval.
  fetch(input, init) {
    if (typeof init?.body !== "string" || !init.body.includes('"googleSearchRetrieval"')) {
      return fetch(input, init);
    }

    const body: { tools?: Record<string, unknown>[] } = JSON.parse(init.body);
    body.tools = body.tools?.map((tool) => "googleSearchRetrieval" in tool ? { googleSearch: {} } : tool);
    return fetch(input, { ...init, body: JSON.stringify(body) });
  },
});

export const hydrogenModel = hydrogenProvider("gemini-4-hydrogen");
