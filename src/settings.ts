import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import NotebookLMPlugin from './main';

export class NotebookLMSettingTab extends PluginSettingTab {
	plugin: NotebookLMPlugin;

	constructor(app: App, plugin: NotebookLMPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Verbindung & Verhalten')
			.setHeading();

		new Setting(containerEl)
			.setName('Pfad zur nlm CLI (nlm.exe)')
			.setDesc(
				'Absoluter Pfad zur ausführbaren nlm-Datei (von notebooklm-mcp-cli).'
			)
			.addText((text) =>
				text
					.setPlaceholder('C:\\Users\\lukas\\.local\\bin\\nlm.exe')
					.setValue(this.plugin.settings.nlmPath)
					.onChange(async (value) => {
						this.plugin.settings.nlmPath = value.trim();
						this.plugin.bridge.setNlmPath(this.plugin.settings.nlmPath);
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Standard-Sprache für Artefakte')
			.setDesc('BCP-47 Sprachcode (z. B. de für Deutsch, en für Englisch)')
			.addText((text) =>
				text
					.setPlaceholder('de')
					.setValue(this.plugin.settings.defaultLanguage)
					.onChange(async (value) => {
						this.plugin.settings.defaultLanguage = value.trim() || 'de';
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Aktive Notiz standardmäßig einbeziehen')
			.setDesc(
				'Wenn aktiviert, ist die gerade geöffnete Notiz in der Sidebar automatisch als Kontextquelle ausgewählt.'
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoIncludeActiveNote)
					.onChange(async (value) => {
						this.plugin.settings.autoIncludeActiveNote = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Fertige Artefakte automatisch in der Notiz verlinken')
			.setDesc(
				'Fügt nach dem automatischen Download eines Artefakts einen ![[Link]] am Ende der ursprünglichen Notiz ein.'
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoInsertLinkIntoNote)
					.onChange(async (value) => {
						this.plugin.settings.autoInsertLinkIntoNote = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Hintergrund-Prüfintervall (Sekunden)')
			.setDesc(
				'Wie oft das Plugin prüft, ob laufende Artefakte in NotebookLM fertiggestellt wurden.'
			)
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
			.setName('Ausstehende Artefakt-Downloads jetzt prüfen')
			.setDesc(
				'Prüft sofort alle noch offenen Artefakt-Jobs und lädt fertiggestellte Dateien herunter.'
			)
			.addButton((btn) =>
				btn
					.setButtonText('Jetzt prüfen & herunterladen')
					.setCta()
					.onClick(async () => {
						new Notice('Prüfe ausstehende Artefakte in NotebookLM...');
						await this.plugin.tracker.checkPendingJobs();
					})
			);
	}
}
