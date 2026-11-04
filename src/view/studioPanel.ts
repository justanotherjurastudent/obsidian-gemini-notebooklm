import { Notice, TFile, normalizePath, setIcon } from 'obsidian';
import { ArtifactJob, StudioArtifactStatus } from '../types';
import { isSupportedArtifactType } from '../utils/artifactParser';
import { sanitizeVaultFolderPath } from '../utils/vaultFolder';
import { getActiveNoteFolderInfo } from './activeNote';
import { iconForArtifactType, NotebookViewHost } from './notebookState';

/**
 * Remote metadata decides this URL, so only plain HTTPS media URLs are allowed
 * into an <audio> element. Blocks javascript:/data:/file: and plain http.
 */
function safeRemoteMediaUrl(raw: string | null | undefined): string {
	if (!raw) return '';
	try {
		const url = new URL(raw);
		return url.protocol === 'https:' ? url.href : '';
	} catch {
		return '';
	}
}

export function expandStudioDrawer(host: NotebookViewHost): void {
	host.state.isStudioDrawerExpanded = true;
	host.dom.studioDrawerListEl?.removeClass('is-collapsed');
	host.dom.studioDrawerHeaderEl?.setAttr('aria-expanded', 'true');
	if (host.dom.studioDrawerChevronEl) {
		setIcon(host.dom.studioDrawerChevronEl, 'chevron-down');
	}
}

export async function importStudioArtifactToVault(
	host: NotebookViewHost,
	remote: StudioArtifactStatus
): Promise<string | null> {
	const nbId = host.plugin.settings.activeNotebookId;
	if (!nbId || !isSupportedArtifactType(remote.type)) return null;

	const artId = remote.artifact_id || remote.id;
	const existingJob = (host.plugin.settings.artifactJobs || []).find(
		(j) => j.id === artId
	);
	if (existingJob && existingJob.downloaded) {
		if (existingJob.downloadedFilePath) {
			const existsInVault = await host.app.vault.adapter.exists(
				existingJob.downloadedFilePath
			);
			if (existsInVault) {
				return existingJob.downloadedFilePath;
			}
		}
		existingJob.downloaded = false;
		existingJob.downloadedFilePath = undefined;
	}

	const folderInfo = getActiveNoteFolderInfo(host);
	const nbObj = host.state.notebooks.find((n) => n.id === nbId);
	const nbTitle = nbObj ? nbObj.title : 'Notebook';
	const normType = host.plugin.tracker.normalizeArtifactType(remote.type);
	const typeLabel = host.plugin.tracker.getTypeLabel(normType);
	const chosenFolderRel = sanitizeVaultFolderPath(folderInfo.folderRel);

	const wasNewlyAdded = !existingJob;
	let job = existingJob;
	if (!job) {
		job = {
			id: artId,
			notebookId: nbId,
			notebookTitle: nbTitle,
			type: normType,
			label: remote.title?.trim() || `${typeLabel} (${folderInfo.noteName})`,
			focusPrompt: remote.custom_instructions || undefined,
			targetFolderRel: chosenFolderRel,
			sourceNoteName: remote.title?.trim() || folderInfo.noteName,
			sourceNotePath: folderInfo.notePath,
			createdAt: remote.created_at
				? Date.parse(remote.created_at) || Date.now()
				: Date.now(),
			status: 'completed',
			downloaded: false,
		};
		await host.plugin.tracker.addJob(job);
	}

	const ok = await host.plugin.tracker.downloadCompletedJob(job);
	if (ok && job.downloadedFilePath) {
		await host.plugin.saveSettings();
		host.renderArtifactsPanel();
		host.renderStudioDrawerList();
		return job.downloadedFilePath;
	}
	if (wasNewlyAdded) {
		await host.plugin.tracker.removeJob(job.id);
	}
	return null;
}

export function renderStudioDrawerList(host: NotebookViewHost): void {
	const studioDrawerListEl = host.dom.studioDrawerListEl;
	const studioDrawerBadgeEl = host.dom.studioDrawerBadgeEl;
	if (!studioDrawerListEl || !studioDrawerBadgeEl) return;

	const i18n = host.i18n;
	const state = host.state;
	studioDrawerBadgeEl.setText(String(state.studioArtifacts.length));

	const preservedAudioEl =
		state.activeAudioEl &&
		state.playingArtifactId &&
		state.activeAudioArtifactId === state.playingArtifactId
			? state.activeAudioEl
			: null;
	const wasAudioPlaying = preservedAudioEl ? !preservedAudioEl.paused : false;
	const savedAudioTime = preservedAudioEl ? preservedAudioEl.currentTime : 0;

	studioDrawerListEl.empty();

	if (state.studioArtifacts.length === 0) {
		if (state.activeAudioEl || state.playingArtifactId) {
			host.stopAudioPlayback();
		}
		studioDrawerListEl.createDiv({
			cls: 'nlm-sources-empty',
			text: i18n.studioArtifactsEmpty,
		});
		return;
	}

	const allJobs = host.plugin.settings.artifactJobs || [];
	let reattachedActiveAudio = false;

	for (const item of state.studioArtifacts) {
		const artId = item.artifact_id || item.id;
		const isSupported = isSupportedArtifactType(item.type);
		const normType = host.plugin.tracker.normalizeArtifactType(item.type);
		const typeLabel = isSupported
			? host.plugin.tracker.getTypeLabel(normType)
			: item.type || 'Artifact';
		const matchingJob = allJobs.find((j) => j.id === artId);
		const isCompleted =
			item.status === 'completed' ||
			matchingJob?.status === 'completed' ||
			Boolean(matchingJob?.downloaded);
		const isFailed =
			!isCompleted &&
			(item.status === 'failed' || matchingJob?.status === 'failed');
		const isRunning = !isCompleted && !isFailed;
		const isDownloaded = Boolean(
			matchingJob?.downloaded && matchingJob.downloadedFilePath
		);
		const isDownloadingThis = host.plugin.tracker.isDownloading(artId);

		const card = studioDrawerListEl.createDiv({
			cls: `nlm-studio-item-card ${isRunning ? 'is-running' : ''}`,
		});

		const topRow = card.createDiv({ cls: 'nlm-studio-item-top' });
		const iconSpan = topRow.createSpan({ cls: 'nlm-studio-item-icon' });
		setIcon(iconSpan, iconForArtifactType(normType));

		const titleText = item.title?.trim() || typeLabel;
		topRow.createSpan({
			text: titleText,
			cls: 'nlm-studio-item-title',
			attr: {
				title: item.custom_instructions
					? `${titleText}\n\n${item.custom_instructions}`
					: titleText,
			},
		});

		const statusBadge = topRow.createSpan({
			cls: `nlm-studio-status-pill is-${isCompleted ? 'completed' : isFailed ? 'failed' : 'running'}`,
			text: isCompleted
				? typeLabel
				: isFailed
					? i18n.artifactFailed
					: `⏳ ${i18n.artifactProcessing}`,
		});
		if (isRunning) {
			statusBadge.setAttr('title', item.status);
		}

		const actionsRow = card.createDiv({ cls: 'nlm-studio-item-actions' });

		// Play button for completed audio artifacts
		if (isSupported && isCompleted && normType === 'audio') {
			const isPlayingThis = state.playingArtifactId === artId;
			const playBtn = actionsRow.createEl('button', {
				cls: `nlm-studio-action-btn ${isPlayingThis ? 'is-active' : ''}`,
				text: isPlayingThis
					? `⏹ ${i18n.btnPauseArtifact}`
					: `▶ ${i18n.btnPlayArtifact}`,
			});
			playBtn.disabled = isDownloadingThis;
			playBtn.addEventListener('click', () => {
				void (async () => {
					if (state.playingArtifactId === artId) {
						host.stopAudioPlayback();
						host.renderStudioDrawerList();
						return;
					}
					const currentNbId = host.plugin.settings.activeNotebookId;
					playBtn.disabled = true;
					try {
						// Ensure downloaded locally so it plays reliably inside Obsidian without Google cookie CORS issues
						const localRelPath = await importStudioArtifactToVault(
							host,
							item
						);
						if (
							!state.isViewOpen ||
							host.plugin.settings.activeNotebookId !== currentNbId
						) {
							return;
						}
						if (localRelPath) {
							host.stopAudioPlayback();
							state.playingArtifactId = artId;
							host.renderStudioDrawerList();
						}
					} finally {
						if (playBtn.isConnected) {
							playBtn.disabled = host.plugin.tracker.isDownloading(artId);
						}
					}
				})();
			});
		}

		// Download / Open in Vault button for all completed supported artifacts
		if (isSupported && isCompleted) {
			const dlOrOpenBtn = actionsRow.createEl('button', {
				cls: 'nlm-studio-action-btn',
				text: isDownloaded
					? `📂 ${i18n.btnOpenVaultArtifact}`
					: `⬇ ${i18n.btnDownloadStudioArtifact}`,
			});
			dlOrOpenBtn.disabled = isDownloadingThis;
			dlOrOpenBtn.addEventListener('click', () => {
				void (async () => {
					const currentNbId = host.plugin.settings.activeNotebookId;
					dlOrOpenBtn.disabled = true;
					try {
						const localRelPath = await importStudioArtifactToVault(
							host,
							item
						);
						if (
							!state.isViewOpen ||
							host.plugin.settings.activeNotebookId !== currentNbId
						) {
							return;
						}
						if (localRelPath) {
							await host.app.workspace.openLinkText(
								localRelPath,
								'',
								false
							);
						}
					} finally {
						if (dlOrOpenBtn.isConnected) {
							dlOrOpenBtn.disabled =
								host.plugin.tracker.isDownloading(artId);
						}
					}
				})();
			});
		} else if (isSupported && isRunning) {
			// Allow tracking this running remote job if not already in tracker
			if (!matchingJob) {
				const trackBtn = actionsRow.createEl('button', {
					cls: 'nlm-studio-action-btn',
					text: `⏬ ${i18n.btnDownloadStudioArtifact}`,
				});
				trackBtn.addEventListener('click', () => {
					void (async () => {
						const folderInfo = getActiveNoteFolderInfo(host);
						const nbId = host.plugin.settings.activeNotebookId;
						const nbObj = host.state.notebooks.find((n) => n.id === nbId);
						const job: ArtifactJob = {
							id: artId,
							notebookId: nbId,
							notebookTitle: nbObj ? nbObj.title : 'Notebook',
							type: normType,
							label: `${titleText} (${folderInfo.noteName})`,
							focusPrompt: item.custom_instructions || undefined,
							targetFolderRel: sanitizeVaultFolderPath(
								folderInfo.folderRel
							),
							sourceNoteName: folderInfo.noteName,
							sourceNotePath: folderInfo.notePath,
							createdAt: Date.now(),
							status: 'processing',
							downloaded: false,
						};
						await host.plugin.tracker.addJob(job);
						host.renderStudioDrawerList();
						new Notice(
							i18n.noticeArtifactStarted(typeLabel, job.targetFolderRel)
						);
					})();
				});
			}
		}

		// Delete from NotebookLM studio button
		const delBtn = actionsRow.createEl('button', {
			cls: 'nlm-studio-del-btn',
			attr: { 'aria-label': i18n.btnDeleteStudioArtifactTitle },
		});
		setIcon(delBtn, 'trash-2');
		delBtn.addEventListener('click', () => {
			void (async () => {
				const nbId = host.plugin.settings.activeNotebookId;
				if (!nbId) return;
				delBtn.disabled = true;
				try {
					host.setStatusBanner(i18n.statusDeletingArtifact(titleText));
					await host.plugin.bridge.deleteStudioArtifact(nbId, artId);
					if (state.playingArtifactId === artId) {
						host.stopAudioPlayback();
					}
					await host.plugin.tracker.removeJob(artId);
					await host.loadStudioArtifactsForActiveNotebook();
					new Notice(i18n.noticeStudioArtifactDeleted(titleText));
				} catch (err: unknown) {
					const msg = err instanceof Error ? err.message : String(err);
					new Notice(i18n.noticeDeleteError(msg));
				} finally {
					if (delBtn.isConnected) {
						delBtn.disabled = false;
					}
					host.setStatusBanner(null);
				}
			})();
		});

		// Embedded audio player if currently playing
		if (
			state.playingArtifactId === artId &&
			isCompleted &&
			normType === 'audio'
		) {
			if (preservedAudioEl && state.activeAudioArtifactId === artId) {
				const playerWrap = card.createDiv({
					cls: 'nlm-studio-audio-player-wrap',
				});
				playerWrap.appendChild(preservedAudioEl);
				if (preservedAudioEl.currentTime === 0 && savedAudioTime > 0) {
					preservedAudioEl.currentTime = savedAudioTime;
				}
				if (wasAudioPlaying && preservedAudioEl.paused) {
					void preservedAudioEl.play().catch(() => {
						// Ignore autoplay interruption
					});
				}
				reattachedActiveAudio = true;
			} else {
				const updatedJob = (host.plugin.settings.artifactJobs || []).find(
					(j) => j.id === artId
				);
				let audioSrc = '';
				if (updatedJob?.downloadedFilePath) {
					const normPath = normalizePath(updatedJob.downloadedFilePath);
					const af = host.app.vault.getAbstractFileByPath(normPath);
					if (af instanceof TFile) {
						audioSrc = host.app.vault.getResourcePath(af);
					} else {
						audioSrc = host.app.vault.adapter.getResourcePath(normPath);
					}
				}
				const remoteAudioUrl = safeRemoteMediaUrl(item.audio_url);
				if (!audioSrc && remoteAudioUrl) {
					audioSrc = remoteAudioUrl;
				}
				if (audioSrc) {
					const playerWrap = card.createDiv({
						cls: 'nlm-studio-audio-player-wrap',
					});
					const audioEl = playerWrap.createEl('audio', {
						cls: 'nlm-studio-audio-player',
						attr: {
							controls: 'true',
							autoplay: 'true',
							src: audioSrc,
						},
					});
					audioEl.addEventListener(
						'error',
						() => {
							if (remoteAudioUrl && audioEl.src !== remoteAudioUrl) {
								audioEl.src = remoteAudioUrl;
							}
						},
						{ once: true }
					);
					state.activeAudioEl = audioEl;
					state.activeAudioArtifactId = artId;
					reattachedActiveAudio = true;
				}
			}
		}
	}

	if (!reattachedActiveAudio && (state.activeAudioEl || state.playingArtifactId)) {
		host.stopAudioPlayback();
	}
}
