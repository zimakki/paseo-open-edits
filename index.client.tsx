import type { PluginClientContext } from "@getpaseo/plugin/client";
import { startOpenEdits } from "./client/web";

export default function contribute(_client: PluginClientContext) {
  return startOpenEdits();
}
