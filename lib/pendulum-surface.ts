import { Catalog } from "@a2ui/web_core/catalog";
import { MessageProcessor } from "@a2ui/web_core/processing";
import { PENDULUM_PATH, PENDULUM_SURFACE_ID, type PendulumUpdate } from "./pendulum";

const ROOT_ID = "root";
const CATALOG_ID = "a2ui://chat-o-matic/pendulum/v1";
const definition = Catalog.fromJson({
  catalogId: CATALOG_ID,
  protocolVersion: "1.0",
  components: {
    PendulumLab: {
      type: "object",
      properties: {
        component: { const: "PendulumLab" },
        lengthCm: { type: "object", properties: { "@path": { const: PENDULUM_PATH } }, required: ["@path"] },
      },
      required: ["component", "lengthCm"],
    },
  },
});
const catalog = new Catalog(CATALOG_ID, "1.0", [...definition.components.values()]);

export function createPendulumSurface(update: PendulumUpdate) {
  const processor = new MessageProcessor([catalog], undefined, { version: "v1.0" });
  processor.processMessages({
    version: "1.0",
    createSurface: {
      surfaceId: PENDULUM_SURFACE_ID,
      catalogId: CATALOG_ID,
      components: [{ id: ROOT_ID, component: "PendulumLab", lengthCm: { "@path": PENDULUM_PATH } }],
    },
  });
  processor.processMessages(update);
  const surface = processor.getSurface(PENDULUM_SURFACE_ID)!;
  return {
    processor,
    surface,
    explain: (lengthCm: number) => surface.dispatchAction({ event: { name: "explain", context: { lengthCm } } }, ROOT_ID),
  };
}
