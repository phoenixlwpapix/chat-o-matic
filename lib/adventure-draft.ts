import { adventureStateSchema, createAdventureUpdate } from "./adventure";

const MAX_DRAFT_LENGTH = 6000;
const DRAFT_FENCE = /^[ \t]{0,3}(`{3,}|~{3,})adventure(?=$|[ \t\r\n{])/i;
const MARKDOWN_FENCE = /^[ \t]{0,3}(`{3,}|~{3,})([^\n]*)$/;

function parseDraft(marker: string, raw: string) {
  if (raw.length > MAX_DRAFT_LENGTH) return;
  const closing = new RegExp(`(?:^[ \\t]{0,3}|(?<=\\})[ \\t]*)${marker[0]}{${marker.length},}[ \\t]*\\r?$`, "m").exec(raw);
  if (!closing) return;
  try {
    const result = adventureStateSchema.safeParse(JSON.parse(raw.slice(0, closing.index)));
    if (result.success) return createAdventureUpdate(result.data);
  } catch {
    // The optional panel can be discarded while keeping the story prose.
  }
}

/** Read Markdown incrementally, keeping the trailing panel draft out of the story. */
export function createAdventureDraftReader() {
  let line = "";
  let atLineStart = true;
  let markdownFence = "";
  let draftFence = "";
  let draft = "";

  function collectDraft(segment: string) {
    if (draft.length <= MAX_DRAFT_LENGTH) draft += segment.slice(0, MAX_DRAFT_LENGTH + 1 - draft.length);
  }

  function releaseLine(complete: boolean) {
    const text = line;
    line = "";
    atLineStart = complete;
    if (complete) {
      const fence = MARKDOWN_FENCE.exec(text.replace(/\n$/, ""));
      if (fence) {
        const [, marker, info] = fence;
        if (!markdownFence && (marker[0] === "~" || !info.includes("`"))) markdownFence = marker;
        else if (marker[0] === markdownFence[0] && marker.length >= markdownFence.length && !info.trim()) markdownFence = "";
      }
    }
    return text;
  }

  function startDraft(complete: boolean) {
    const opening = !markdownFence && DRAFT_FENCE.exec(line);
    // When the token ends exactly at the label, wait for its delimiter.
    if (!opening || (!complete && opening[0].length === line.length)) return false;
    draftFence = opening[1];
    collectDraft(line.slice(opening[0].length));
    line = "";
    return true;
  }

  return {
    push(delta: string) {
      let visible = "";
      for (const segment of delta.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
        if (draftFence) {
          collectDraft(segment);
          continue;
        }
        const complete = segment.endsWith("\n");
        if (!atLineStart) {
          visible += segment;
          atLineStart = complete;
          continue;
        }
        line += segment;
        if (startDraft(complete)) continue;
        if (!complete && /^(?:[ \t]{0,3}$|[ \t]{0,3}[`~])/.test(line) && line.length <= 256) continue;
        visible += releaseLine(complete);
      }
      return visible;
    },
    finish() {
      const text = line && !startDraft(true) ? releaseLine(true) : "";
      return { text, found: Boolean(draftFence), update: draftFence ? parseDraft(draftFence, draft) : undefined };
    },
  };
}
