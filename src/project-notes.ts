import type { ContextTarget } from "./context-target";
import type { ProjectMemoryEntry } from "@cybergarage/orbit/dist/core/projects/types.js";
import type { ProjectContextSnapshot } from "@cybergarage/orbit/dist/core/projects/memory-context.js";
export interface NoteGuard {
	target: ContextTarget;
	generation: number;
}
export interface NoteChange extends NoteGuard {
	noteId: string;
	expectedRevision: number;
	operationId: string;
	action: "correct" | "deactivate";
	body: string;
}
export interface NoteHistory extends NoteGuard {
	notes: ProjectMemoryEntry[];
	next?: string;
}
export interface NotesInspection {
	target?: ContextTarget;
	notes: ProjectMemoryEntry[];
	inactive: ProjectMemoryEntry[];
	inactiveNext?: string;
	preview?: ProjectContextSnapshot;
	noteError?: string;
}
