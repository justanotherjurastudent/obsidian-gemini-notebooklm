import { Notice } from 'obsidian';
import {
	ArtifactCreateOptions,
	ArtifactJob,
	ArtifactType,
} from '../types';
import { ArtifactConfigModal } from '../suggest/fileSuggestModal';
import { sanitizeVaultFolderPath } from '../utils/vaultFolder';
import {
	ActiveNoteFolderInfo,
	getActiveNoteFolderInfo,
} from './activeNote';
import { NotebookViewHost } from './notebookState';
import { resolveQueryScope } from './sourceLookup';

export function openArtifactModal(
	host: NotebookViewHost,
	initialType: ArtifactType
): void {
	const i18n = host.i18n;
	if (!host.plugin.settings.activeNotebookId) {
		new Notice(i18n.noticeSelectNotebookFirst);
		return;
	}

	const folderInfo = getActiveNoteFolderInfo(host);
	new ArtifactConfigModal(
		host.app,
		initialType,
		host.plugin.settings.defaultLanguage,
		folderInfo.folderRel,
		host.plugin.settings.uiLanguage,
		(options) => {
			void startArtifactGeneration(host, options, folderInfo);
		}
	).open();
}

export async function startArtifactGeneration(
	host: NotebookViewHost,
	options: ArtifactCreateOptions,
	folderInfo: ActiveNoteFolderInfo
): Promise<void> {
	const i18n = host.i18n;
	const nbId = host.plugin.settings.activeNotebookId;
	if (!nbId) return;

	const nbObj = host.state.notebooks.find((n) => n.id === nbId);
	const nbTitle = nbObj ? nbObj.title : 'Notebook';

	const chosenFolderRel = sanitizeVaultFolderPath(
		options.targetFolderRel !== undefined
			? options.targetFolderRel
			: folderInfo.folderRel
	);

	try {
		const { sourceIds } = await host.ensureContextFilesUploaded();
		const scope = resolveQueryScope(host, sourceIds);
		if (scope && scope.length === 0) {
			new Notice(i18n.sourcesAllDisabled);
			return;
		}
		if (scope) {
			options.sourceIds = scope;
		}

		const typeLabel = host.plugin.tracker.getTypeLabel(options.type);
		host.setStatusBanner(i18n.statusStartingArtifact(typeLabel));

		const res = await host.plugin.bridge.createArtifact(nbId, options);

		const job: ArtifactJob = {
			id: res.artifact_id,
			notebookId: nbId,
			notebookTitle: nbTitle,
			type: options.type,
			label: `${typeLabel} (${folderInfo.noteName})`,
			focusPrompt: options.focus,
			targetFolderRel: chosenFolderRel,
			sourceNoteName: folderInfo.noteName,
			sourceNotePath: folderInfo.notePath,
			createdAt: Date.now(),
			status: 'queued',
			downloaded: false,
		};

		await host.plugin.tracker.addJob(job);
		await host.loadStudioArtifactsForActiveNotebook();
		new Notice(i18n.noticeArtifactStarted(typeLabel, chosenFolderRel));
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		new Notice(i18n.noticeArtifactStartError(msg));
	} finally {
		host.setStatusBanner(null);
	}
}
