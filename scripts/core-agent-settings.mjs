// Nest owns its Agent configuration; never inherit workspace settings or credentials.
export {
	mergeWorkspaceSettings,
	parseExecutionActionMode,
} from "@cybergarage/orbit/dist/core/settings.js";
export function loadWorkspaceSettingsSync() {
	return {};
}
