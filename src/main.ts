import { Notice, Plugin, WorkspaceLeaf } from 'obsidian';
import { DEFAULT_SETTINGS, NotebookLMPluginSettings } from './types';
import { NlmBridge } from './bridge/nlmBridge';
import { ArtifactTracker } from './tracker/artifactTracker';
import {
	NotebookLMSidebarView,
	VIEW_TYPE_NOTEBOOKLM,
} from './view/notebookView';
import { NotebookLMSettingTab } from './settings';

export default class NotebookLMPlugin extends Plugin {
	settings!: NotebookLMPluginSettings;
	bridge!: NlmBridge;
	tracker!: ArtifactTracker;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.bridge = new NlmBridge(this.settings.nlmPath);
		this.tracker = new ArtifactTracker(
			this.app,
			this.bridge,
			() => this.settings.artifactJobs,
			async (jobs) => {
				this.settings.artifactJobs = jobs;
				await this.saveSettings();
			},
			() => this.settings.autoInsertLinkIntoNote
		);

		this.registerView(
			VIEW_TYPE_NOTEBOOKLM,
			(leaf) => new NotebookLMSidebarView(leaf, this)
		);

		this.addRibbonIcon('headphones', 'Gemini NotebookLM Studio öffnen', () => {
			void this.activateView();
		});

		this.addCommand({
			id: 'open-notebooklm-sidebar',
			name: 'NotebookLM Studio in rechter Seitenleiste öffnen',
			callback: () => {
				void this.activateView();
			},
		});

		this.addCommand({
			id: 'upload-active-note-to-notebooklm',
			name: 'Aktive Notiz direkt ins gewählte NotebookLM-Notebook hochladen',
			callback: async () => {
				const file = this.app.workspace.getActiveFile();
				if (!file) {
					new Notice('Keine aktive Datei geöffnet.');
					return;
				}
				await this.activateView();
				const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_NOTEBOOKLM);
				const firstLeaf = leaves[0];
				if (firstLeaf && firstLeaf.view instanceof NotebookLMSidebarView) {
					await firstLeaf.view.uploadVaultFileToNotebook(file, true);
				}
			},
		});

		this.addCommand({
			id: 'check-pending-notebooklm-artifacts',
			name: 'Ausstehende NotebookLM-Artefakte prüfen & herunterladen',
			callback: async () => {
				new Notice('Prüfe ausstehende NotebookLM-Artefakte...');
				await this.tracker.checkPendingJobs();
			},
		});

		this.addSettingTab(new NotebookLMSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			// Immediately check if any pending artifacts finished while Obsidian was closed
			window.setTimeout(() => {
				void this.tracker.checkPendingJobs();
			}, 2500);
			this.tracker.startPolling(this.settings.pollIntervalSeconds);
		});
	}

	onunload(): void {
		this.tracker.stopPolling();
	}

	async activateView(): Promise<void> {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_NOTEBOOKLM);

		if (leaves.length > 0 && leaves[0]) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({
					type: VIEW_TYPE_NOTEBOOKLM,
					active: true,
				});
			}
		}

		if (leaf) {
			await workspace.revealLeaf(leaf);
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<NotebookLMPluginSettings>
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
