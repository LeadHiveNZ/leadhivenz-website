import { rm } from "node:fs/promises";
import path from "node:path";

/** Start every test run with empty data files. */
export default async function globalSetup() {
  await rm(path.join(__dirname, "..", ".data", "e2e"), { recursive: true, force: true });
}
