import { Catalog } from "@a2ui/web_core/catalog";
import { MessageProcessor } from "@a2ui/web_core/processing";
import { ADVENTURE_CATALOG_ID, ADVENTURE_SCENE_PATH, ADVENTURE_SURFACE_ID } from "./adventure";

const ROOT_ID = "root";
const definition = Catalog.fromJson({
  catalogId: ADVENTURE_CATALOG_ID,
  protocolVersion: "1.0",
  components: {
    ExplorationPanel: {
      type: "object",
      properties: {
        component: { const: "ExplorationPanel" },
        scene: { type: "object", properties: { "@path": { const: ADVENTURE_SCENE_PATH } }, required: ["@path"] },
      },
      required: ["component", "scene"],
    },
  },
});
const catalog = new Catalog(ADVENTURE_CATALOG_ID, "1.0", [...definition.components.values()]);

export function createAdventureSurface() {
  const processor = new MessageProcessor([catalog], undefined, { version: "v1.0" });
  processor.processMessages({
    version: "1.0",
    createSurface: {
      surfaceId: ADVENTURE_SURFACE_ID,
      catalogId: ADVENTURE_CATALOG_ID,
      components: [{ id: ROOT_ID, component: "ExplorationPanel", scene: { "@path": ADVENTURE_SCENE_PATH } }],
    },
  });
  const surface = processor.getSurface(ADVENTURE_SURFACE_ID)!;
  return {
    processor,
    surface,
    dispatchAction: (action: string) => surface.dispatchAction({ event: { name: "chooseAction", context: { action } } }, ROOT_ID),
  };
}
