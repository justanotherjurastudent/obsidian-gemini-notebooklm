import type { App, Component, TFile } from 'obsidian';
import type NotebookLMPlugin from '../main';
import type { TranslationStrings } from '../i18n';
import type {
	ArtifactType,
	NlmHealthStatus,
	NotebookInfo,
	SourceInfo,
	StudioArtifactStatus,
} from '../types';

/** Mutable view model shared by all sidebar render/action modules. */
export interface NotebookViewState {
	notebooks: NotebookInfo[];
	sources: SourceInfo[];
	studioArtifacts: StudioArtifactStatus[];
	studioArtifactsLoaded: boolean;
	contextFiles: TFile[];
	includeActiveNote: boolean;
	activeNoteFile: TFile | null;
	isSourcesExpanded: boolean;
	isStudioDrawerExpanded: boolean;
	isViewOpen: boolean;
	postChatStudioCheckTimer: number | null;
	playingArtifactId: string | null;
	activeAudioEl: HTMLAudioElement | null;
	activeAudioArtifactId: string | null;
	currentLoadedNotebookId: string | null;
	isLoadingNotebooks: boolean;
	isSendingChat: boolean;
	uploadQueue: Promise<unknown>;
	healthStatus: NlmHealthStatus | null;
}

export function createViewState(includeActiveNote: boolean): NotebookViewState {
	return {
		notebooks: [],
		sources: [],
		studioArtifacts: [],
		studioArtifactsLoaded: false,
		contextFiles: [],
		includeActiveNote,
		activeNoteFile: null,
		isSourcesExpanded: false,
		isStudioDrawerExpanded: false,
		isViewOpen: false,
		postChatStudioCheckTimer: null,
		playingArtifactId: null,
		activeAudioEl: null,
		activeAudioArtifactId: null,
		currentLoadedNotebookId: null,
		isLoadingNotebooks: false,
		isSendingChat: false,
		uploadQueue: Promise.resolve(),
		healthStatus: null,
	};
}

/** DOM handles filled by buildUI(); undefined until the layout exists. */
export interface NotebookViewDom {
	onboardingBannerEl?: HTMLElement;
	notebookSelectEl?: HTMLSelectElement;
	sourcesContainerEl?: HTMLElement;
	sourcesCountBadgeEl?: HTMLElement;
	studioDrawerHeaderEl?: HTMLElement;
	studioDrawerListEl?: HTMLElement;
	studioDrawerBadgeEl?: HTMLElement;
	studioDrawerChevronEl?: HTMLElement;
	artifactsContainerEl?: HTMLElement;
	chatFeedEl?: HTMLElement;
	contextChipsEl?: HTMLElement;
	promptInputEl?: HTMLTextAreaElement;
	sendBtnEl?: HTMLButtonElement;
	statusBannerEl?: HTMLElement;
}

/**
 * The sidebar view as seen by the feature modules. Rendering and cross-module
 * actions are implemented by the view so the modules stay free of each other.
 */
export interface NotebookViewHost {
	readonly app: App;
	readonly containerEl: HTMLElement;
	/** Markdown render owner (the view itself). */
	readonly component: Component;
	readonly plugin: NotebookLMPlugin;
	readonly i18n: TranslationStrings;
	readonly state: NotebookViewState;
	readonly dom: NotebookViewDom;

	renderOnboardingBanner(): void;
	renderNotebookSelect(): void;
	renderSourcesList(): void;
	renderContextChips(): void;
	renderStudioDrawerList(): void;
	renderChatFeed(): void;
	renderArtifactsPanel(): void;
	setStatusBanner(text: string | null): void;
	expandStudioDrawer(): void;
	stopAudioPlayback(): void;

	loadNotebooksAndSources(): Promise<void>;
	loadSourcesForActiveNotebook(): Promise<void>;
	loadStudioArtifactsForActiveNotebook(): Promise<void>;

	uploadVaultFileToNotebook(
		file: TFile,
		forceUpload?: boolean
	): Promise<string | null>;
	ensureContextFilesUploaded(): Promise<{
		sourceIds: string[];
		fileNames: string[];
	}>;
	importStudioArtifactToVault(
		remote: StudioArtifactStatus
	): Promise<string | null>;
	detectAndTrackChatArtifacts(
		nbId: string,
		question: string,
		preStudioIds: Set<string>,
		hadPreStudioSnapshot: boolean,
		queryStartedAt: number
	): Promise<void>;

	openArtifactModal(initialType: ArtifactType): void;
	openDirectUploadModal(): void;
	openCreateNotebookModal(): void;
	openContextFilePicker(): void;
	handleSendPrompt(): Promise<void>;
}

export function iconForArtifactType(type: ArtifactType): string {
	switch (type) {
		case 'audio':
			return 'headphones';
		case 'report':
			return 'file-text';
		case 'quiz':
			return 'help-circle';
		case 'flashcards':
			return 'layers';
		case 'mind_map':
			return 'git-fork';
		case 'slide_deck':
			return 'presentation';
		case 'infographic':
			return 'image';
	}
}
