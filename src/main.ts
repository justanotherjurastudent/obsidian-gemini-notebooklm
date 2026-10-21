import { Notice, Plugin, WorkspaceLeaf } from 'obsidian';
import { DEFAULT_SETTINGS, NotebookLMPluginSettings } from './types';
import { NlmBridge } from './bridge/nlmBridge';
import { ArtifactTracker } from './tracker/artifactTracker';
import {
	NotebookLMSidebarView,
	VIEW_TYPE_NOTEBOOKLM,
} from './view/notebookView';
import { NotebookLMSettingTab } from './settings';
import {
	NOTEBOOKLM_ICON_ID,
	registerNotebookLMIcon,
} from './icons/notebooklmLogo';
import { t } from './i18n';

export default class NotebookLMPlugin extends Plugin {
	settings!: NotebookLMPluginSettings;
	bridge!: NlmBridge;
	tracker!: ArtifactTracker;
	private startupTimeoutId: number | null = null;
	private ribbonIconEl: HTMLElement | null = null;

	async onload(): Promise<void> {
		registerNotebookLMIcon();
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
			() => this.settings.autoInsertLinkIntoNote,
			() => this.settings.convertMindmapToMermaid,
			() => this.settings.uiLanguage
		);

		this.registerView(
			VIEW_TYPE_NOTEBOOKLM,
			(leaf) => new NotebookLMSidebarView(leaf, this)
		);

		const i18n = t(this.settings.uiLanguage);

		this.ribbonIconEl = this.addRibbonIcon(
			NOTEBOOKLM_ICON_ID,
			i18n.ribbonTooltip,
			() => {
				void this.activateView();
			}
		);

		this.addCommand({
			id: 'open-notebooklm-sidebar',
			name: i18n.cmdOpenSidebar,
			callback: () => {
				void this.activateView();
			},
		});

		this.addCommand({
			id: 'upload-active-note-to-notebooklm',
			name: i18n.cmdUploadActiveNote,
			callback: async () => {
				const curI18n = t(this.settings.uiLanguage);
				const file = this.app.workspace.getActiveFile();
				if (!file) {
					new Notice(curI18n.noticeNoActiveFile);
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
			name: i18n.cmdCheckPendingArtifacts,
			callback: async () => {
				const curI18n = t(this.settings.uiLanguage);
				new Notice(curI18n.noticeCheckingArtifacts);
				await this.tracker.checkPendingJobs();
			},
		});

		this.addSettingTab(new NotebookLMSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			this.startupTimeoutId = window.setTimeout(() => {
				this.startupTimeoutId = null;
				void this.tracker.checkPendingJobs();
			}, 2500);
			this.tracker.startPolling(this.settings.pollIntervalSeconds);
		});
	}

	onunload(): void {
		if (this.startupTimeoutId !== null) {
			window.clearTimeout(this.startupTimeoutId);
			this.startupTimeoutId = null;
		}
		this.tracker.stopPolling();
	}

	public refreshOpenViews(): void {
		if (this.ribbonIconEl) {
			this.ribbonIconEl.setAttr(
				'aria-label',
				t(this.settings.uiLanguage).ribbonTooltip
			);
		}
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_NOTEBOOKLM);
		for (const leaf of leaves) {
			if (leaf.view instanceof NotebookLMSidebarView) {
				leaf.view.rebuildUI();
			}
		}
	}

	public openPluginSettings(): void {
		const appWithSetting = this.app as unknown as {
			setting?: {
				open?: () => void;
				openTabById?: (id: string) => void;
			};
		};
		appWithSetting.setting?.open?.();
		appWithSetting.setting?.openTabById?.(this.manifest.id);
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
