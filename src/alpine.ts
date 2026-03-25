import type { Alpine } from "alpinejs";
import { registerTravelStore } from "./stores/travelStore";

export default function initAlpine(Alpine: Alpine) {
  registerTravelStore(Alpine);
}
