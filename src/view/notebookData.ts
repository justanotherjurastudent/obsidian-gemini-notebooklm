import { Notice, TFile } from 'obsidian';
import {
	getAbsolutePathForVaultFile,
	activeOrLastFile,
} from './activeNote';
import { NotebookViewHost } from './notebookState';
import { findSourceForFile } from './sourceLookup';

export async function loadNotebooksAndSources(
	host: NotebookViewHost
): Promise<void> {
	const state = host.state;
	if (state.isLoadingNotebooks) return;
	state.isLoadingNotebooks = true;
	try {
		state.notebooks = await host.plugin.bridge.listNotebooks();
		state.healthStatus = {
			installed: true,
			authenticated: true,
			version: '',
			account: '',
			resolvedPath: host.plugin.bridge.getEffectivePath(),
		};
		host.renderOnboardingBanner();
		host.renderNotebookSelect();
		if (host.plugin.settings.activeNotebookId) {
			await host.loadSourcesForActiveNotebook();
		}
	} catch (err: unknown) {
		state.healthStatus = await host.plugin.bridge.checkHealth();
		host.renderOnboardingBanner();
		const msg = err instanceof Error ? err.message : String(err);
		new Notice(host.i18n.noticeConnectionError(msg));
	} finally {
		state.isLoadingNotebooks = false;
	}
}

export async function loadSourcesForActiveNotebook(
	host: NotebookViewHost
): Promise<void> {
	const state = host.state;
	const nbId = host.plugin.settings.activeNotebookId;
	if (!nbId) {
		state.currentLoadedNotebookId = null;
		state.sources = [];
		state.studioArtifacts = [];
		state.studioArtifactsLoaded = false;
		host.stopAudioPlayback();
		host.renderSourcesList();
		host.renderStudioDrawerList();
		return;
	}

	if (state.currentLoadedNotebookId !== nbId) {
		state.currentLoadedNotebookId = nbId;
		state.sources = [];
		state.studioArtifacts = [];
		state.studioArtifactsLoaded = false;
		host.stopAudioPlayback();
		host.renderSourcesList();
		host.renderStudioDrawerList();
	}

	try {
		const [sourcesList, studioResult] = await Promise.all([
			host.plugin.bridge.listSources(nbId),
			host.plugin.bridge
				.getStudioStatus(nbId, true)
				.then((list) => ({ ok: true, list }))
				.catch(() => ({ ok: false, list: [] })),
		]);
		if (host.plugin.settings.activeNotebookId !== nbId) {
			return;
		}
		state.sources = sourcesList;
		state.studioArtifacts = studioResult.list;
		state.studioArtifactsLoaded = studioResult.ok;

		// Drop toggles of sources that were deleted in NotebookLM
		const liveIds = new Set(sourcesList.map((s) => s.id));
		const storedDisabled = host.plugin.settings.disabledSourceIds[nbId] ?? [];
		const keptDisabled = storedDisabled.filter((id) => liveIds.has(id));
		if (keptDisabled.length !== storedDisabled.length) {
			host.plugin.settings.disabledSourceIds[nbId] = keptDisabled;
		}

		if (!host.plugin.settings.uploadedFileMap[nbId]) {
			host.plugin.settings.uploadedFileMap[nbId] = {};
		}
		for (const src of state.sources) {
			host.plugin.settings.uploadedFileMap[nbId][src.title] = src.id;
		}
		await host.plugin.saveSettings();
		if (host.plugin.settings.activeNotebookId !== nbId) {
			return;
		}
		host.renderSourcesList();
		host.renderStudioDrawerList();
	} catch (err) {
		console.warn('Failed to load notebook sources:', err);
	}
}

export async function loadStudioArtifactsForActiveNotebook(
	host: NotebookViewHost
): Promise<void> {
	const state = host.state;
	const nbId = host.plugin.settings.activeNotebookId;
	if (!nbId) {
		state.studioArtifacts = [];
		state.studioArtifactsLoaded = false;
		host.stopAudioPlayback();
		host.renderStudioDrawerList();
		return;
	}
	try {
		const artifacts = await host.plugin.bridge.getStudioStatus(nbId, true);
		if (host.plugin.settings.activeNotebookId !== nbId) {
			return;
		}
		state.studioArtifacts = artifacts;
		state.studioArtifactsLoaded = true;
		host.renderStudioDrawerList();
	} catch (err) {
		console.warn('Failed to load studio artifacts:', err);
	}
}

export function uploadVaultFileToNotebook(
	host: NotebookViewHost,
	file: TFile,
	forceUpload = false
): Promise<string | null> {
	const task = host.state.uploadQueue.then(() =>
		performUploadVaultFile(host, file, forceUpload)
	);
	host.state.uploadQueue = task.catch(() => null);
	return task;
}

async function performUploadVaultFile(
	host: NotebookViewHost,
	file: TFile,
	forceUpload: boolean
): Promise<string | null> {
	const i18n = host.i18n;
	const nbId = host.plugin.settings.activeNotebookId;
	if (!nbId) {
		new Notice(i18n.noticeSelectNotebookFirst);
		return null;
	}

	if (!host.plugin.settings.uploadedFileMap[nbId]) {
		host.plugin.settings.uploadedFileMap[nbId] = {};
	}
	if (!host.plugin.settings.uploadedFileMtimes[nbId]) {
		host.plugin.settings.uploadedFileMtimes[nbId] = {};
	}

	const map = host.plugin.settings.uploadedFileMap[nbId];
	const mtimes = host.plugin.settings.uploadedFileMtimes[nbId];

	const foundInSources = findSourceForFile(host, file, nbId);

	const lastUploadedMtime = mtimes[file.path] || 0;
	const isNoteModified =
		(file.extension === 'md' || file.extension === 'txt') &&
		lastUploadedMtime > 0 &&
		file.stat.mtime > lastUploadedMtime;

	if (!forceUpload && foundInSources && !isNoteModified) {
		return foundInSources.id;
	}

	try {
		if (foundInSources && (isNoteModified || forceUpload)) {
			host.setStatusBanner(i18n.statusUpdatingSource(file.name));
			try {
				await host.plugin.bridge.deleteSource(foundInSources.id);
			} catch {
				// Ignore if already deleted remotely
			}
		} else {
			host.setStatusBanner(i18n.statusUploadingSource(file.name));
		}

		const absPath = getAbsolutePathForVaultFile(host, file);
		const res = await host.plugin.bridge.addFileSource(nbId, absPath, true);
		map[file.path] = res.source_id;
		map[file.name] = res.source_id;
		mtimes[file.path] = file.stat.mtime;
		await host.plugin.saveSettings();
		await host.loadSourcesForActiveNotebook();
		new Notice(i18n.noticeSourceUploaded(file.name));
		return res.source_id;
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		new Notice(i18n.noticeUploadFailed(file.name, msg));
		return null;
	} finally {
		host.setStatusBanner(null);
	}
}

export async function ensureContextFilesUploaded(
	host: NotebookViewHost
): Promise<{ sourceIds: string[]; fileNames: string[] }> {
	const filesToSync: TFile[] = [];
	const activeFile = activeOrLastFile(host);

	if (host.state.includeActiveNote && activeFile) {
		filesToSync.push(activeFile);
	}
	for (const f of host.state.contextFiles) {
		if (!filesToSync.some((existing) => existing.path === f.path)) {
			filesToSync.push(f);
		}
	}

	const sourceIds: string[] = [];
	const fileNames: string[] = [];

	for (const file of filesToSync) {
		if (file.stat.size === 0) {
			continue;
		}
		const srcId = await host.uploadVaultFileToNotebook(file, false);
		if (!srcId) {
			throw new Error(host.i18n.errorContextSyncFailed(file.name));
		}
		fileNames.push(file.name);
		sourceIds.push(srcId);
	}

	return { sourceIds, fileNames };
}
