import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import NotebookLMPlugin from './main';
import { UILanguage, t } from './i18n';

const GITHUB_REPO_LABEL = 'GitHub: jacob-bd/notebooklm-mcp-cli';
const DEFAULT_LANG_PLACEHOLDER = 'de';

export class NotebookLMSettingTab extends PluginSettingTab {
	plugin: NotebookLMPlugin;

	constructor(app: App, plugin: NotebookLMPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const i18n = t(this.plugin.settings.uiLanguage);

		new Setting(containerEl)
			.setName(i18n.settingsHeadingSetup)
			.setHeading();

		const guideCard = containerEl.createDiv({ cls: 'nlm-settings-guide-card' });
		const introP = guideCard.createEl('p', {
			cls: 'nlm-settings-guide-intro',
			text: `${i18n.settingsSetupIntro} `,
		});
		introP.createEl('a', {
			text: GITHUB_REPO_LABEL,
			href: 'https://github.com/jacob-bd/notebooklm-mcp-cli',
		});

		const stepsList = guideCard.createDiv({ cls: 'nlm-settings-steps' });

		const s1 = stepsList.createDiv({ cls: 'nlm-settings-step' });
		s1.createEl('strong', { text: i18n.settingsStep1Title });
		s1.createEl('code', {
			cls: 'nlm-settings-code',
			text: i18n.settingsStep1Desc,
		});

		const s2 = stepsList.createDiv({ cls: 'nlm-settings-step' });
		s2.createEl('strong', { text: i18n.settingsStep2Title });
		s2.createSpan({ text: i18n.settingsStep2Desc });

		const s3 = stepsList.createDiv({ cls: 'nlm-settings-step' });
		s3.createEl('strong', { text: i18n.settingsStep3Title });
		s3.createSpan({ text: i18n.settingsStep3Desc });

		guideCard.createEl('p', {
			cls: 'nlm-settings-privacy-note',
			text: i18n.settingsPrivacyNote,
		});

		const statusBox = guideCard.createDiv({
			cls: 'nlm-settings-status-box is-checking',
			text: i18n.settingsStatusChecking,
		});

		const updateStatusBox = async (): Promise<void> => {
			statusBox.removeClass('is-ok', 'is-warn', 'is-error');
			statusBox.addClass('is-checking');
			statusBox.setText(i18n.settingsStatusChecking);
			const health = await this.plugin.bridge.checkHealth();
			statusBox.removeClass('is-checking');
			if (!health.installed) {
				statusBox.addClass('is-error');
				statusBox.setText(i18n.settingsStatusMissing);
			} else if (!health.authenticated) {
				statusBox.addClass('is-warn');
				statusBox.setText(i18n.settingsStatusNoAuth(health.version));
			} else {
				statusBox.addClass('is-ok');
				statusBox.setText(
					i18n.settingsStatusOk(health.version, health.account)
				);
			}
		};

		void updateStatusBox();

		const actionsRow = guideCard.createDiv({ cls: 'nlm-settings-actions-row' });

		const checkBtn = actionsRow.createEl('button', {
			text: i18n.btnCheckConnection,
		});
		checkBtn.addEventListener('click', () => {
			void updateStatusBox();
		});

		let pathInputEl: HTMLInputElement | null = null;
		const detectBtn = actionsRow.createEl('button', {
			text: i18n.btnAutoDetectPath,
		});
		detectBtn.addEventListener('click', () => {
			void (async () => {
				const detected = this.plugin.bridge.detectNlmPath();
				if (detected) {
					this.plugin.settings.nlmPath = detected;
					this.plugin.bridge.setNlmPath(detected);
					await this.plugin.saveSettings();
					if (pathInputEl) {
						pathInputEl.value = detected;
					}
					new Notice(i18n.noticePathDetected(detected));
					await updateStatusBox();
				} else {
					new Notice(i18n.noticePathNotFound);
				}
			})();
		});

		const loginBtn = actionsRow.createEl('button', {
			text: i18n.btnLoginBrowser,
			cls: 'mod-cta',
		});
		loginBtn.addEventListener('click', () => {
			let loginFailed = false;
			this.plugin.bridge.launchBrowserLogin((err) => {
				loginFailed = true;
				new Notice(i18n.noticeConnectionError(err.message));
			});
			if (!loginFailed) {
				new Notice(i18n.noticeLoginStarted, 8000);
			}
		});

		new Setting(containerEl)
			.setName(i18n.settingsHeadingGeneral)
			.setHeading();

		new Setting(containerEl)
			.setName(i18n.settingsUILangName)
			.setDesc(i18n.settingsUILangDesc)
			.addDropdown((dd) =>
				dd
					.addOption('auto', i18n.optLangAuto)
					.addOption('de', i18n.optLangDe)
					.addOption('en', i18n.optLangEn)
					.setValue(this.plugin.settings.uiLanguage)
					.onChange(async (value) => {
						this.plugin.settings.uiLanguage = value as UILanguage;
						await this.plugin.saveSettings();
						this.plugin.refreshOpenViews();
						this.display();
					})
			);

		new Setting(containerEl)
			.setName(i18n.settingsNlmPathName)
			.setDesc(i18n.settingsNlmPathDesc)
			.addText((text) => {
				pathInputEl = text.inputEl;
				text.setPlaceholder(i18n.settingsNlmPathPlaceholder)
					.setValue(this.plugin.settings.nlmPath)
					.onChange(async (value) => {
						this.plugin.settings.nlmPath = value.trim();
						this.plugin.bridge.setNlmPath(this.plugin.settings.nlmPath);
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName(i18n.settingsDefaultLangName)
			.setDesc(i18n.settingsDefaultLangDesc)
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_LANG_PLACEHOLDER)
					.setValue(this.plugin.settings.defaultLanguage)
					.onChange(async (value) => {
						this.plugin.settings.defaultLanguage = value.trim() || 'de';
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(i18n.settingsAutoIncludeName)
			.setDesc(i18n.settingsAutoIncludeDesc)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoIncludeActiveNote)
					.onChange(async (value) => {
						this.plugin.settings.autoIncludeActiveNote = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(i18n.settingsAutoLinkName)
			.setDesc(i18n.settingsAutoLinkDesc)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoInsertLinkIntoNote)
					.onChange(async (value) => {
						this.plugin.settings.autoInsertLinkIntoNote = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(i18n.settingsMindmapMermaidName)
			.setDesc(i18n.settingsMindmapMermaidDesc)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.convertMindmapToMermaid)
					.onChange(async (value) => {
						this.plugin.settings.convertMindmapToMermaid = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(i18n.settingsPollIntervalName)
			.setDesc(i18n.settingsPollIntervalDesc)
			.addSlider((slider) =>
				slider
					.setLimits(10, 120, 5)
					.setValue(this.plugin.settings.pollIntervalSeconds)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.pollIntervalSeconds = value;
						await this.plugin.saveSettings();
						this.plugin.tracker.startPolling(value);
					})
			);

		new Setting(containerEl)
			.setName(i18n.settingsCheckNowName)
			.setDesc(i18n.settingsCheckNowDesc)
			.addButton((btn) =>
				btn
					.setButtonText(i18n.btnCheckNow)
					.setCta()
					.onClick(async () => {
						new Notice(i18n.noticeCheckingArtifacts);
						await this.plugin.tracker.checkPendingJobs();
					})
			);
	}
}
