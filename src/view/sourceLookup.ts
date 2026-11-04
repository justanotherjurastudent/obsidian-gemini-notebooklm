import { TFile } from 'obsidian';
import { SourceInfo } from '../types';
import { resolveSourceScope } from '../utils/sourceScope';
import { NotebookViewHost } from './notebookState';

export function disabledSourceIdsFor(
	host: NotebookViewHost,
	nbId: string
): string[] {
	return host.plugin.settings.disabledSourceIds[nbId] ?? [];
}

// Same lookup the uploader uses: path/name map first, then the source title
export function findSourceForFile(
	host: NotebookViewHost,
	file: TFile,
	nbId: string
): SourceInfo | undefined {
	const map = host.plugin.settings.uploadedFileMap[nbId] ?? {};
	const byPath = map[file.path];
	const byName = map[file.name];
	return host.state.sources.find(
		(s) => s.id === byPath || s.id === byName || s.title === file.name
	);
}

export function toggleSourceEnabled(
	host: NotebookViewHost,
	nbId: string,
	sourceId: string,
	enabled: boolean
): void {
	const disabled = new Set(disabledSourceIdsFor(host, nbId));
	if (enabled) {
		disabled.delete(sourceId);
	} else {
		disabled.add(sourceId);
	}
	host.plugin.settings.disabledSourceIds[nbId] = [...disabled];
	// Local toggle only - it applies to the next nlm call
	void host.plugin.saveSettings();
}

// undefined = nlm queries all sources; [] = nothing enabled
export function resolveQueryScope(
	host: NotebookViewHost,
	contextIds: string[]
): string[] | undefined {
	const nbId = host.plugin.settings.activeNotebookId;
	if (!nbId) return undefined;
	return resolveSourceScope(
		host.state.sources.map((s) => s.id),
		disabledSourceIdsFor(host, nbId),
		contextIds
	);
}
