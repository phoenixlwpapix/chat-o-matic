import { Catalog } from "@a2ui/web_core/catalog";
import { MessageProcessor } from "@a2ui/web_core/processing";
import { EQUATION_PATH, EQUATION_SURFACE_ID, type EquationUpdate } from "./equation-practice";

const ROOT_ID = "root";
const CATALOG_ID = "a2ui://chat-o-matic/equation-practice/v1";
const definition = Catalog.fromJson({
  catalogId: CATALOG_ID,
  protocolVersion: "1.0",
  components: {
    EquationPractice: {
      type: "object",
      properties: {
        component: { const: "EquationPractice" },
        practice: { type: "object", properties: { "@path": { const: EQUATION_PATH } }, required: ["@path"] },
      },
      required: ["component", "practice"],
    },
  },
});
const catalog = new Catalog(CATALOG_ID, "1.0", [...definition.components.values()]);

export function createEquationSurface(update: EquationUpdate) {
  const processor = new MessageProcessor([catalog], undefined, { version: "v1.0" });
  processor.processMessages({
    version: "1.0",
    createSurface: {
      surfaceId: EQUATION_SURFACE_ID,
      catalogId: CATALOG_ID,
      components: [{ id: ROOT_ID, component: "EquationPractice", practice: { "@path": EQUATION_PATH } }],
    },
  });
  processor.processMessages(update);
  const surface = processor.getSurface(EQUATION_SURFACE_ID)!;
  return {
    processor,
    surface,
    submit: (answer: string, stage: "isolate" | "solve") => surface.dispatchAction({ event: { name: "checkAnswer", context: { answer, stage } } }, ROOT_ID),
  };
}
