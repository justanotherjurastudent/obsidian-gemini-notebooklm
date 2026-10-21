import { UILanguage } from './i18n';

export interface NotebookInfo {
	id: string;
	title: string;
	source_count: number;
	updated_at: string;
}

export interface SourceInfo {
	id: string;
	title: string;
	type: string;
	url: string | null;
	status: number;
}

export interface QueryReference {
	source_id: string;
	citation_number: number;
	cited_text: string;
}

export interface QueryResult {
	answer: string;
	question: string;
	conversation_id?: string;
	sources_used?: string[];
	citations?: Record<string, string>;
	references?: QueryReference[];
}

export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	timestamp: number;
	references?: QueryReference[];
	contextFiles?: string[];
}

export type ArtifactType =
	| 'audio'
	| 'report'
	| 'quiz'
	| 'flashcards'
	| 'mind_map'
	| 'slide_deck'
	| 'infographic';

export interface ArtifactCreateOptions {
	type: ArtifactType;
	focus?: string;
	language?: string;
	targetFolderRel?: string;
	audioFormat?: 'deep_dive' | 'brief' | 'critique' | 'debate';
	audioLength?: 'short' | 'default' | 'long';
	reportFormat?: 'Briefing Doc' | 'Study Guide' | 'Blog Post' | 'Create Your Own';
	quizCount?: number;
	quizDifficulty?: number;
	flashcardsDifficulty?: 'easy' | 'medium' | 'hard';
	mindmapTitle?: string;
	sourceIds?: string[];
}

export interface ArtifactJob {
	id: string;
	notebookId: string;
	notebookTitle: string;
	type: ArtifactType;
	label: string;
	focusPrompt?: string;
	targetFolderRel: string;
	targetFolderAbs?: string;
	sourceNoteName: string;
	sourceNotePath: string;
	createdAt: number;
	status: 'queued' | 'processing' | 'completed' | 'failed';
	downloaded: boolean;
	downloadedFilePath?: string;
	error?: string;
}

export interface StudioArtifactStatus {
	id: string;
	artifact_id: string;
	type: string;
	status: string;
	custom_instructions?: string | null;
	title?: string;
}

export interface NlmHealthStatus {
	installed: boolean;
	authenticated: boolean;
	version: string;
	account: string;
	resolvedPath: string;
}

export interface NotebookLMPluginSettings {
	uiLanguage: UILanguage;
	nlmPath: string;
	defaultLanguage: string;
	pollIntervalSeconds: number;
	autoIncludeActiveNote: boolean;
	autoInsertLinkIntoNote: boolean;
	convertMindmapToMermaid: boolean;
	activeNotebookId: string;
	artifactJobs: ArtifactJob[];
	chatHistories: Record<string, { conversationId?: string; messages: ChatMessage[] }>;
	uploadedFileMap: Record<string, Record<string, string>>;
	uploadedFileMtimes: Record<string, Record<string, number>>;
}

export const DEFAULT_SETTINGS: NotebookLMPluginSettings = {
	uiLanguage: 'auto',
	nlmPath: '',
	defaultLanguage: 'de',
	pollIntervalSeconds: 15,
	autoIncludeActiveNote: true,
	autoInsertLinkIntoNote: false,
	convertMindmapToMermaid: true,
	activeNotebookId: '',
	artifactJobs: [],
	chatHistories: {},
	uploadedFileMap: {},
	uploadedFileMtimes: {},
};
