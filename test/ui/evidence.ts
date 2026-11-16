import path from "node:path";
export const evidencePath = (name: string): string =>
	path.join(process.env.NEST_TEST_EVIDENCE_DIR ?? "evidence", name);
