import { Notice } from 'obsidian';
import { ArtifactJob } from '../types';
import { isSupportedArtifactType } from '../utils/artifactParser';
import { sanitizeVaultFolderPath } from '../utils/vaultFolder';
import { getActiveNoteFolderInfo } from './activeNote';
import { NotebookViewHost } from './notebookState';
import { expandStudioDrawer } from './studioPanel';

export function renderArtifactsPanel(host: NotebookViewHost): void {
	const artifactsContainerEl = host.dom.artifactsContainerEl;
	if (!artifactsContainerEl) return;
	const i18n = host.i18n;
	artifactsContainerEl.empty();

	const allJobs = host.plugin.settings.artifactJobs || [];
	if (allJobs.length === 0) {
		artifactsContainerEl.addClass('is-empty');
		return;
	}
	artifactsContainerEl.removeClass('is-empty');

	const headerRow = artifactsContainerEl.createDiv({
		cls: 'nlm-artifacts-header',
	});
	const pendingCount = allJobs.filter(
		(j) => !j.downloaded && j.status !== 'failed'
	).length;

	headerRow.createSpan({
		text:
			pendingCount > 0
				? `⏳ ${i18n.artifactsActiveTitle(pendingCount)}`
				: `✅ ${i18n.artifactsCompletedTitle(allJobs.length)}`,
		cls: 'nlm-artifacts-title',
	});

	const actionsGroup = headerRow.createDiv({ cls: 'nlm-artifacts-actions' });

	const pollNowBtn = actionsGroup.createEl('button', {
		cls: 'nlm-artifacts-mini-btn',
		text: i18n.btnPollNow,
		attr: { title: i18n.btnPollNowTooltip },
	});
	pollNowBtn.addEventListener('click', () => {
		void host.plugin.tracker.checkPendingJobs();
	});

	const clearDoneBtn = actionsGroup.createEl('button', {
		cls: 'nlm-artifacts-mini-btn',
		text: i18n.btnClearDone,
	});
	clearDoneBtn.addEventListener('click', () => {
		void host.plugin.tracker.clearCompletedJobs();
	});

	const listEl = artifactsContainerEl.createDiv({
		cls: 'nlm-artifacts-list',
	});

	for (const job of allJobs.slice(0, 8)) {
		const isRunning = !job.downloaded && job.status !== 'failed';
		const card = listEl.createDiv({
			cls: `nlm-artifact-card is-${job.status} ${isRunning ? 'is-running' : ''}`,
		});

		const topRow = card.createDiv({ cls: 'nlm-artifact-card-top' });
		if (isRunning) {
			const eq = topRow.createDiv({ cls: 'nlm-equalizer' });
			eq.createSpan();
			eq.createSpan();
			eq.createSpan();
		} else {
			topRow.createSpan({
				cls: `nlm-status-dot is-${job.status}`,
			});
		}

		topRow.createSpan({
			text: job.label,
			cls: 'nlm-artifact-label',
			attr: { title: job.focusPrompt || job.label },
		});

		const removeBtn = topRow.createEl('button', {
			cls: 'nlm-artifact-remove-btn',
			text: '×',
			attr: { title: i18n.btnRemoveJobTooltip },
		});
		removeBtn.addEventListener('click', () => {
			void host.plugin.tracker.removeJob(job.id);
		});

		const subRow = card.createDiv({ cls: 'nlm-artifact-card-sub' });
		if (job.downloaded && job.downloadedFilePath) {
			const openLink = subRow.createEl('a', {
				cls: 'nlm-artifact-open-link',
				text: `📂 ${i18n.artifactSavedPrefix} ${job.downloadedFilePath}`,
			});
			openLink.addEventListener('click', (e) => {
				e.preventDefault();
				if (job.downloadedFilePath) {
					void host.app.workspace.openLinkText(
						job.downloadedFilePath,
						'',
						false
					);
				}
			});
		} else if (job.status === 'failed') {
			subRow.createSpan({
				text: job.error || i18n.artifactFailed,
				cls: 'nlm-artifact-error',
			});
		} else {
			subRow.createSpan({
				text: i18n.artifactGeneratingTo(job.targetFolderRel),
				cls: 'nlm-artifact-pending-info',
			});
		}
	}
}

export async function detectAndTrackChatArtifacts(
	host: NotebookViewHost,
	nbId: string,
	question: string,
	preStudioIds: Set<string>,
	hadPreStudioSnapshot: boolean,
	queryStartedAt: number
): Promise<void> {
	const i18n = host.i18n;
	const folderInfo = getActiveNoteFolderInfo(host);
	const nbObj = host.state.notebooks.find((n) => n.id === nbId);
	const nbTitle = nbObj ? nbObj.title : 'Notebook';
	const chosenFolderRel = sanitizeVaultFolderPath(folderInfo.folderRel);

	try {
		const latestStudio = await host.plugin.bridge.getStudioStatus(nbId, true);
		if (!host.state.isViewOpen) return;
		if (host.plugin.settings.activeNotebookId === nbId) {
			host.state.studioArtifacts = latestStudio;
			host.state.studioArtifactsLoaded = true;
			host.renderStudioDrawerList();
		}

		const existingJobIds = new Set(
			(host.plugin.settings.artifactJobs || []).map((j) => j.id)
		);
		const newlyCreatedRemote = latestStudio.filter((item) => {
			const artId = item.artifact_id || item.id;
			if (
				!artId ||
				!isSupportedArtifactType(item.type) ||
				existingJobIds.has(artId) ||
				preStudioIds.has(artId)
			) {
				return false;
			}
			const createdMs = item.created_at ? Date.parse(item.created_at) : NaN;
			if (!Number.isNaN(createdMs)) {
				return createdMs >= queryStartedAt - 30000;
			}
			return hadPreStudioSnapshot && item.status !== 'completed';
		});

		if (newlyCreatedRemote.length === 0) return;

		if (host.plugin.settings.activeNotebookId === nbId) {
			expandStudioDrawer(host);
		}
		for (const remote of newlyCreatedRemote) {
			const artId = remote.artifact_id || remote.id;
			const normType = host.plugin.tracker.normalizeArtifactType(remote.type);
			const typeLabel = host.plugin.tracker.getTypeLabel(normType);
			const displayTitle =
				remote.title?.trim() || `${typeLabel} (${folderInfo.noteName})`;

			const job: ArtifactJob = {
				id: artId,
				notebookId: nbId,
				notebookTitle: nbTitle,
				type: normType,
				label: displayTitle,
				focusPrompt: remote.custom_instructions || question,
				targetFolderRel: chosenFolderRel,
				sourceNoteName: folderInfo.noteName,
				sourceNotePath: folderInfo.notePath,
				createdAt: Date.now(),
				status: remote.status === 'completed' ? 'completed' : 'processing',
				downloaded: false,
			};
			await host.plugin.tracker.addJob(job);
			if (remote.status === 'completed') {
				await host.plugin.tracker.downloadCompletedJob(job);
				await host.plugin.saveSettings();
				host.renderArtifactsPanel();
				host.renderStudioDrawerList();
			} else {
				new Notice(
					i18n.noticeArtifactStarted(typeLabel, chosenFolderRel)
				);
			}
		}
	} catch (err) {
		console.warn('Chat artifact studio status check failed:', err);
	}
}
