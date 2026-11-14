import type { UIMessageChunk } from "ai";
import { ADVENTURE_PART_TYPE, createAdventureUpdate, type AdventureState, type AdventureUpdate } from "./adventure";
import { createAdventureDraftReader } from "./adventure-draft";

export function createAdventureTransform(recover?: (story: string) => Promise<AdventureState | undefined>) {
  let reader = createAdventureDraftReader();
  let update: AdventureUpdate | undefined;
  let failed = false;
  let story = "";

  return new TransformStream<UIMessageChunk, UIMessageChunk>({
    async transform(chunk, controller) {
      if (chunk.type === "error" || chunk.type === "abort") failed = true;
      if (chunk.type === "text-start") {
        reader = createAdventureDraftReader();
      }
      if (chunk.type === "text-delta") {
        const delta = reader.push(chunk.delta);
        if (recover) story = (story + delta).slice(-6000);
        if (delta) controller.enqueue({ ...chunk, delta });
        return;
      }
      if (chunk.type === "text-end" && !failed) {
        const result = reader.finish();
        if (recover) story = (story + result.text).slice(-6000);
        if (result.text) controller.enqueue({ type: "text-delta", id: chunk.id, delta: result.text });
        update = result.update ?? update;
      }
      if (chunk.type === "finish" && chunk.finishReason === "stop" && !failed) {
        if (!update && story.trim() && recover) {
          const state = await recover(story);
          if (state) update = createAdventureUpdate(state);
        }
        if (update) controller.enqueue({ type: ADVENTURE_PART_TYPE, data: update });
      }
      controller.enqueue(chunk);
    },
  });
}
