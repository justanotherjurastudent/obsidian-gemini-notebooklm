import { ItemView, TFile, WorkspaceLeaf } from 'obsidian';
import NotebookLMPlugin from '../main';
import { NOTEBOOKLM_ICON_ID } from '../icons/notebooklmLogo';
import { TranslationStrings, t } from '../i18n';
import { ArtifactType, StudioArtifactStatus } from '../types';
import {
	detectAndTrackChatArtifacts,
	renderArtifactsPanel,
} from './artifactsPanel';
import { openArtifactModal } from './artifactModal';
import { handleSendPrompt, renderChatFeed } from './chatPanel';
import { openCreateNotebookModal } from './createNotebook';
import { stopAudioPlayback } from './audioPlayback';
import {
	ensureContextFilesUploaded,
	loadNotebooksAndSources,
	loadSourcesForActiveNotebook,
	loadStudioArtifactsForActiveNotebook,
	uploadVaultFileToNotebook,
} from './notebookData';
import {
	createViewState,
	NotebookViewDom,
	NotebookViewHost,
	NotebookViewState,
} from './notebookState';
import {
	openContextFilePicker,
	openDirectUploadModal,
	renderContextChips,
	renderSourcesList,
} from './sourcesPanel';
import {
	expandStudioDrawer,
	importStudioArtifactToVault,
	renderStudioDrawerList,
} from './studioPanel';
import {
	buildUI,
	renderNotebookSelect,
	renderOnboardingBanner,
	setStatusBanner,
} from './viewLayout';

export const VIEW_TYPE_NOTEBOOKLM = 'gemini-notebooklm-sidebar-view';

export class NotebookLMSidebarView extends ItemView implements NotebookViewHost {
	readonly plugin: NotebookLMPlugin;
	readonly state: NotebookViewState;
	readonly dom: NotebookViewDom;

	private unsubscribeTracker: (() => void) | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: NotebookLMPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.state = createViewState(plugin.settings.autoIncludeActiveNote);
		this.dom = {};
	}

	/** Markdown rendered inside the chat feed belongs to this view's lifecycle. */
	get component(): this {
		return this;
	}

	get i18n(): TranslationStrings {
		return t(this.plugin.settings.uiLanguage);
	}

	getViewType(): string {
		return VIEW_TYPE_NOTEBOOKLM;
	}

	getDisplayText(): string {
		return this.i18n.sidebarTitle;
	}

	getIcon(): string {
		return NOTEBOOKLM_ICON_ID;
	}

	async onOpen(): Promise<void> {
		this.state.isViewOpen = true;
		this.state.activeNoteFile = this.app.workspace.getActiveFile();
		this.buildUI();

		// file-open fires when switching notes inside the same leaf, which
		// active-leaf-change alone misses - the active note must never be stale.
		const syncActiveNote = () => {
			this.state.activeNoteFile = this.app.workspace.getActiveFile();
			this.renderContextChips();
			this.renderSourcesList();
		};
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', syncActiveNote)
		);
		this.registerEvent(this.app.workspace.on('file-open', syncActiveNote));

		this.unsubscribeTracker = this.plugin.tracker.onUpdate(() => {
			this.renderArtifactsPanel();
			this.renderStudioDrawerList();
		});

		await this.loadNotebooksAndSources();
		this.renderChatFeed();
		this.renderArtifactsPanel();
		this.renderStudioDrawerList();
	}

	async onClose(): Promise<void> {
		this.state.isViewOpen = false;
		if (this.state.postChatStudioCheckTimer !== null) {
			window.clearTimeout(this.state.postChatStudioCheckTimer);
			this.state.postChatStudioCheckTimer = null;
		}
		this.stopAudioPlayback();
		if (this.unsubscribeTracker) {
			this.unsubscribeTracker();
			this.unsubscribeTracker = null;
		}
	}

	public rebuildUI(): void {
		const wasPlaying = Boolean(
			this.state.activeAudioEl && !this.state.activeAudioEl.paused
		);
		const savedTime = this.state.activeAudioEl
			? this.state.activeAudioEl.currentTime
			: 0;

		this.buildUI();
		this.renderOnboardingBanner();
		this.renderNotebookSelect();
		this.renderSourcesList();
		this.renderStudioDrawerList();
		this.renderChatFeed();
		this.renderArtifactsPanel();

		const audioEl = this.state.activeAudioEl;
		if (audioEl) {
			if (audioEl.currentTime === 0 && savedTime > 0) {
				audioEl.currentTime = savedTime;
			}
			if (wasPlaying && audioEl.paused) {
				void audioEl.play().catch(() => {
					// Ignore autoplay interruption
				});
			}
		}
	}

	// --- host actions, delegated to the feature modules -------------------

	buildUI(): void {
		buildUI(this);
	}

	renderOnboardingBanner(): void {
		renderOnboardingBanner(this);
	}

	renderNotebookSelect(): void {
		renderNotebookSelect(this);
	}

	renderSourcesList(): void {
		renderSourcesList(this);
	}

	renderContextChips(): void {
		renderContextChips(this);
	}

	renderStudioDrawerList(): void {
		renderStudioDrawerList(this);
	}

	renderChatFeed(): void {
		renderChatFeed(this);
	}

	renderArtifactsPanel(): void {
		renderArtifactsPanel(this);
	}

	setStatusBanner(text: string | null): void {
		setStatusBanner(this, text);
	}

	expandStudioDrawer(): void {
		expandStudioDrawer(this);
	}

	stopAudioPlayback(): void {
		stopAudioPlayback(this);
	}

	loadNotebooksAndSources(): Promise<void> {
		return loadNotebooksAndSources(this);
	}

	loadSourcesForActiveNotebook(): Promise<void> {
		return loadSourcesForActiveNotebook(this);
	}

	loadStudioArtifactsForActiveNotebook(): Promise<void> {
		return loadStudioArtifactsForActiveNotebook(this);
	}

	uploadVaultFileToNotebook(
		file: TFile,
		forceUpload = false
	): Promise<string | null> {
		return uploadVaultFileToNotebook(this, file, forceUpload);
	}

	ensureContextFilesUploaded(): Promise<{
		sourceIds: string[];
		fileNames: string[];
	}> {
		return ensureContextFilesUploaded(this);
	}

	importStudioArtifactToVault(
		remote: StudioArtifactStatus
	): Promise<string | null> {
		return importStudioArtifactToVault(this, remote);
	}

	detectAndTrackChatArtifacts(
		nbId: string,
		question: string,
		preStudioIds: Set<string>,
		hadPreStudioSnapshot: boolean,
		queryStartedAt: number
	): Promise<void> {
		return detectAndTrackChatArtifacts(
			this,
			nbId,
			question,
			preStudioIds,
			hadPreStudioSnapshot,
			queryStartedAt
		);
	}

	openArtifactModal(initialType: ArtifactType): void {
		openArtifactModal(this, initialType);
	}

	openDirectUploadModal(): void {
		openDirectUploadModal(this);
	}

	openCreateNotebookModal(): void {
		openCreateNotebookModal(this);
	}

	openContextFilePicker(): void {
		openContextFilePicker(this);
	}

	handleSendPrompt(): Promise<void> {
		return handleSendPrompt(this);
	}
}
