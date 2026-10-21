import { App, FuzzySuggestModal, Modal, Notice, Setting, TFile } from 'obsidian';
import { ArtifactCreateOptions, ArtifactType } from '../types';

const SUPPORTED_EXTENSIONS = new Set([
	'md',
	'pdf',
	'txt',
	'docx',
	'csv',
	'pptx',
	'epub',
	'png',
	'jpg',
	'jpeg',
	'webp',
	'm4a',
	'mp3',
	'wav',
	'mp4',
]);

export class VaultFileSuggestModal extends FuzzySuggestModal<TFile> {
	private onChoose: (file: TFile) => void;
	private placeholderText: string;

	constructor(
		app: App,
		onChoose: (file: TFile) => void,
		placeholder = 'Datei auswählen (@-Kontext oder Notebook-Upload)...'
	) {
		super(app);
		this.onChoose = onChoose;
		this.placeholderText = placeholder;
		this.setPlaceholder(this.placeholderText);
	}

	getItems(): TFile[] {
		return this.app.vault
			.getFiles()
			.filter((f) => SUPPORTED_EXTENSIONS.has(f.extension.toLowerCase()))
			.sort((a, b) => b.stat.mtime - a.stat.mtime);
	}

	getItemText(item: TFile): string {
		return item.path;
	}

	onChooseItem(item: TFile): void {
		this.onChoose(item);
	}
}

export class CreateNotebookModal extends Modal {
	private titleValue = '';
	private onSubmit: (title: string) => void;

	constructor(app: App, defaultTitle: string, onSubmit: (title: string) => void) {
		super(app);
		this.titleValue = defaultTitle;
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('nlm-modal');

		contentEl.createEl('h3', { text: 'Neues NotebookLM Notebook erstellen' });

		new Setting(contentEl)
			.setName('Notebook-Titel')
			.setDesc('Name des neuen Notebooks in Google NotebookLM')
			.addText((text) => {
				text.setPlaceholder('z. B. Wirtschaftsinformatik - Vorlesung 2')
					.setValue(this.titleValue)
					.onChange((val) => {
						this.titleValue = val;
					});
				text.inputEl.addEventListener('keydown', (e) => {
					if (e.key === 'Enter' && this.titleValue.trim()) {
						e.preventDefault();
						this.close();
						this.onSubmit(this.titleValue.trim());
					}
				});
				window.setTimeout(() => text.inputEl.focus(), 50);
			});

		const footer = contentEl.createDiv({ cls: 'nlm-modal-footer' });
		const cancelBtn = footer.createEl('button', { text: 'Abbrechen' });
		cancelBtn.addEventListener('click', () => this.close());

		const createBtn = footer.createEl('button', {
			text: 'Notebook erstellen',
			cls: 'mod-cta',
		});
		createBtn.addEventListener('click', () => {
			if (!this.titleValue.trim()) {
				new Notice('Bitte gib einen Titel ein.');
				return;
			}
			this.close();
			this.onSubmit(this.titleValue.trim());
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export class ArtifactConfigModal extends Modal {
	private options: ArtifactCreateOptions;
	private onSubmit: (options: ArtifactCreateOptions) => void;
	private targetFolderDisplay: string;

	constructor(
		app: App,
		initialType: ArtifactType,
		defaultLanguage: string,
		targetFolderDisplay: string,
		onSubmit: (options: ArtifactCreateOptions) => void
	) {
		super(app);
		this.targetFolderDisplay = targetFolderDisplay;
		this.options = {
			type: initialType,
			language: defaultLanguage || 'de',
			audioFormat: 'deep_dive',
			audioLength: 'long',
			reportFormat: 'Study Guide',
			quizCount: 5,
			quizDifficulty: 3,
			flashcardsDifficulty: 'medium',
			focus: '',
		};
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('nlm-modal');

		contentEl.createEl('h3', { text: '✨ NotebookLM Studio Artefakt erstellen' });

		const infoBanner = contentEl.createDiv({ cls: 'nlm-modal-target-banner' });
		infoBanner.createSpan({
			text: `📂 Zielordner für Auto-Download: `,
			cls: 'nlm-modal-target-label',
		});
		infoBanner.createEl('code', {
			text: this.targetFolderDisplay || '/ (Vault-Wurzelverzeichnis)',
		});

		new Setting(contentEl)
			.setName('Artefakt-Typ')
			.setDesc('Welche Art von Ausarbeitung soll NotebookLM generieren?')
			.addDropdown((dd) => {
				dd.addOption('audio', '🎧 Audio Overview (Podcast)')
					.addOption('report', '📄 Report / Zusammenfassung (Markdown)')
					.addOption('quiz', '❓ Quiz (Markdown)')
					.addOption('flashcards', '🗂️ Karteikarten / Flashcards (Markdown)')
					.addOption('mind_map', '🧠 Mind Map (JSON)')
					.addOption('slide_deck', '📊 Präsentation / Slide Deck (PDF)')
					.addOption('infographic', '🖼️ Infografik (PNG)')
					.setValue(this.options.type)
					.onChange((val) => {
						this.options.type = val as ArtifactType;
						this.render();
					});
			});

		if (this.options.type === 'audio') {
			new Setting(contentEl)
				.setName('Podcast-Format')
				.setDesc('Stil der Audiozusammenfassung')
				.addDropdown((dd) => {
					dd.addOption('deep_dive', 'Deep Dive (Ausführliches Gespräch)')
						.addOption('brief', 'Brief (Kompakter Überblick)')
						.addOption('critique', 'Critique (Kritische Analyse)')
						.addOption('debate', 'Debate (Pro & Contra Debatte)')
						.setValue(this.options.audioFormat || 'deep_dive')
						.onChange((val) => {
							this.options.audioFormat = val as ArtifactCreateOptions['audioFormat'];
						});
				});

			new Setting(contentEl)
				.setName('Länge')
				.setDesc('Angestrebte Dauer (Long ≈ 12–18 Min.)')
				.addDropdown((dd) => {
					dd.addOption('short', 'Kurz (~5 Min.)')
						.addOption('default', 'Standard (~10 Min.)')
						.addOption('long', 'Lang (~15+ Min.)')
						.setValue(this.options.audioLength || 'long')
						.onChange((val) => {
							this.options.audioLength = val as ArtifactCreateOptions['audioLength'];
						});
				});
		}

		if (this.options.type === 'report') {
			new Setting(contentEl)
				.setName('Report-Format')
				.addDropdown((dd) => {
					dd.addOption('Study Guide', 'Study Guide (Lernleitfaden)')
						.addOption('Briefing Doc', 'Briefing Doc (Kompaktbericht)')
						.addOption('Blog Post', 'Blog Post (Artikelform)')
						.addOption('Create Your Own', 'Eigener Prompt (Create Your Own)')
						.setValue(this.options.reportFormat || 'Study Guide')
						.onChange((val) => {
							this.options.reportFormat = val as ArtifactCreateOptions['reportFormat'];
						});
				});
		}

		if (this.options.type === 'quiz') {
			new Setting(contentEl)
				.setName('Anzahl Fragen')
				.addSlider((slider) => {
					slider
						.setLimits(2, 15, 1)
						.setValue(this.options.quizCount || 5)
						.setDynamicTooltip()
						.onChange((val) => {
							this.options.quizCount = val;
						});
				});

			new Setting(contentEl)
				.setName('Schwierigkeitsgrad (1–5)')
				.addSlider((slider) => {
					slider
						.setLimits(1, 5, 1)
						.setValue(this.options.quizDifficulty || 3)
						.setDynamicTooltip()
						.onChange((val) => {
							this.options.quizDifficulty = val;
						});
				});
		}

		if (this.options.type === 'flashcards') {
			new Setting(contentEl)
				.setName('Schwierigkeitsgrad')
				.addDropdown((dd) => {
					dd.addOption('easy', 'Leicht')
						.addOption('medium', 'Mittel')
						.addOption('hard', 'Schwer')
						.setValue(this.options.flashcardsDifficulty || 'medium')
						.onChange((val) => {
							this.options.flashcardsDifficulty =
								val as ArtifactCreateOptions['flashcardsDifficulty'];
						});
				});
		}

		if (this.options.type === 'audio' || this.options.type === 'report') {
			new Setting(contentEl)
				.setName('Sprache')
				.setDesc('BCP-47 Sprachcode (z. B. de, en)')
				.addText((text) => {
					text.setPlaceholder('de')
						.setValue(this.options.language || 'de')
						.onChange((val) => {
							this.options.language = val.trim();
						});
				});
		}

		const focusSetting = new Setting(contentEl)
			.setName('Fokus / Spezielle Anweisungen (optional)')
			.setDesc(
				'Worauf soll besonders eingegangen werden? (z. B. Beispiele, Modelle, Prüfungsfokus)'
			);
		focusSetting.settingEl.addClass('nlm-focus-setting-block');
		focusSetting.addTextArea((ta) => {
			ta.setPlaceholder(
				'z. B. Erläutere insbesondere Informationssysteme, sozio-technische Systeme und das Schalenmodell anhand von Beispielen...'
			)
				.setValue(this.options.focus || '')
				.onChange((val) => {
					this.options.focus = val;
				});
			ta.inputEl.rows = 6;
			ta.inputEl.addClass('nlm-full-width-textarea');
		});

		const footer = contentEl.createDiv({ cls: 'nlm-modal-footer' });
		const cancelBtn = footer.createEl('button', { text: 'Abbrechen' });
		cancelBtn.addEventListener('click', () => this.close());

		const startBtn = footer.createEl('button', {
			text: '🚀 Generierung starten',
			cls: 'mod-cta',
		});
		startBtn.addEventListener('click', () => {
			this.close();
			this.onSubmit(this.options);
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
