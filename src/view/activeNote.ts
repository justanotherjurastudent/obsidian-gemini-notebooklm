import { FileSystemAdapter, TFile } from 'obsidian';
import { NotebookViewHost } from './notebookState';

export interface ActiveNoteFolderInfo {
	folderRel: string;
	noteName: string;
	notePath: string;
}

/** Active note, or the last one seen - the active file can be null mid-switch. */
export function activeOrLastFile(host: NotebookViewHost): TFile | null {
	return host.app.workspace.getActiveFile() ?? host.state.activeNoteFile;
}

export function getActiveNoteFolderInfo(
	host: NotebookViewHost
): ActiveNoteFolderInfo {
	const file = activeOrLastFile(host);

	if (file) {
		const folderRel =
			file.parent?.path && file.parent.path !== '/' ? file.parent.path : '';
		return {
			folderRel,
			noteName: file.basename,
			notePath: file.path,
		};
	}

	return {
		folderRel: '',
		noteName: 'NotebookLM',
		notePath: '',
	};
}

export function getAbsolutePathForVaultFile(
	host: NotebookViewHost,
	file: TFile
): string {
	const adapter = host.app.vault.adapter;
	if (adapter instanceof FileSystemAdapter) {
		return adapter.getFullPath(file.path);
	}
	throw new Error('FileSystemAdapter unavailable.');
}
