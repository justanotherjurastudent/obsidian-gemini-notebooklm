import { App, FuzzySuggestModal, Modal, Notice, Setting, TFile, normalizePath } from 'obsidian';
import { ArtifactCreateOptions, ArtifactType } from '../types';
import { UILanguage, t } from '../i18n';
import { FolderSuggest } from './folderSuggest';

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
		placeholder: string
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
	private uiLang: UILanguage;
	private onSubmit: (title: string) => void;

	constructor(
		app: App,
		defaultTitle: string,
		uiLang: UILanguage,
		onSubmit: (title: string) => void
	) {
		super(app);
		this.titleValue = defaultTitle;
		this.uiLang = uiLang;
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		const i18n = t(this.uiLang);
		contentEl.empty();
		contentEl.addClass('nlm-modal');

		new Setting(contentEl)
			.setName(i18n.modalCreateNotebookTitle)
			.setHeading();

		new Setting(contentEl)
			.setName(i18n.modalCreateNotebookName)
			.setDesc(i18n.modalCreateNotebookDesc)
			.addText((text) => {
				text.setPlaceholder(i18n.modalCreateNotebookPlaceholder)
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
		const cancelBtn = footer.createEl('button', { text: i18n.btnCancel });
		cancelBtn.addEventListener('click', () => this.close());

		const createBtn = footer.createEl('button', {
			text: i18n.btnCreateNotebook,
			cls: 'mod-cta',
		});
		createBtn.addEventListener('click', () => {
			if (!this.titleValue.trim()) {
				new Notice(i18n.noticeEnterTitle);
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
	private defaultFolderRel: string;
	private uiLang: UILanguage;
	private onSubmit: (options: ArtifactCreateOptions) => void;
	private folderSuggest: FolderSuggest | null = null;

	constructor(
		app: App,
		initialType: ArtifactType,
		defaultLanguage: string,
		defaultFolderRel: string,
		uiLang: UILanguage,
		onSubmit: (options: ArtifactCreateOptions) => void
	) {
		super(app);
		this.defaultFolderRel = defaultFolderRel;
		this.uiLang = uiLang;
		this.options = {
			type: initialType,
			language: defaultLanguage || 'de',
			targetFolderRel: defaultFolderRel,
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
		this.folderSuggest?.close();
		this.folderSuggest = null;
		const { contentEl } = this;
		const i18n = t(this.uiLang);
		contentEl.empty();
		contentEl.addClass('nlm-modal');

		new Setting(contentEl)
			.setName(i18n.modalArtifactTitle)
			.setHeading();

		let folderInputEl: HTMLInputElement | null = null;
		new Setting(contentEl)
			.setName(i18n.modalTargetFolderName)
			.setDesc(i18n.modalTargetFolderDesc)
			.addText((text) => {
				folderInputEl = text.inputEl;
				text.setPlaceholder(i18n.modalTargetFolderPlaceholder)
					.setValue(this.options.targetFolderRel ?? '')
					.onChange((val) => {
						const trimmed = val.trim().replace(/^\/+|\/+$/g, '');
						this.options.targetFolderRel = trimmed ? normalizePath(trimmed) : '';
					});
				this.folderSuggest = new FolderSuggest(this.app, text.inputEl);
			})
			.addExtraButton((btn) => {
				btn.setIcon('rotate-ccw')
					.setTooltip(i18n.btnResetToNoteFolder)
					.onClick(() => {
						this.options.targetFolderRel = this.defaultFolderRel;
						if (folderInputEl) {
							folderInputEl.value = this.defaultFolderRel;
						}
					});
			});

		new Setting(contentEl)
			.setName(i18n.modalArtifactTypeName)
			.setDesc(i18n.modalArtifactTypeDesc)
			.addDropdown((dd) => {
				dd.addOption('audio', i18n.optTypeAudio)
					.addOption('report', i18n.optTypeReport)
					.addOption('quiz', i18n.optTypeQuiz)
					.addOption('flashcards', i18n.optTypeFlashcards)
					.addOption('mind_map', i18n.optTypeMindmap)
					.addOption('slide_deck', i18n.optTypeSlides)
					.addOption('infographic', i18n.optTypeInfographic)
					.setValue(this.options.type)
					.onChange((val) => {
						this.options.type = val as ArtifactType;
						this.render();
					});
			});

		if (this.options.type === 'audio') {
			new Setting(contentEl)
				.setName(i18n.modalAudioFormatName)
				.setDesc(i18n.modalAudioFormatDesc)
				.addDropdown((dd) => {
					dd.addOption('deep_dive', i18n.optAudioDeepDive)
						.addOption('brief', i18n.optAudioBrief)
						.addOption('critique', i18n.optAudioCritique)
						.addOption('debate', i18n.optAudioDebate)
						.setValue(this.options.audioFormat || 'deep_dive')
						.onChange((val) => {
							this.options.audioFormat = val as ArtifactCreateOptions['audioFormat'];
						});
				});

			new Setting(contentEl)
				.setName(i18n.modalAudioLengthName)
				.setDesc(i18n.modalAudioLengthDesc)
				.addDropdown((dd) => {
					dd.addOption('short', i18n.optLengthShort)
						.addOption('default', i18n.optLengthDefault)
						.addOption('long', i18n.optLengthLong)
						.setValue(this.options.audioLength || 'long')
						.onChange((val) => {
							this.options.audioLength = val as ArtifactCreateOptions['audioLength'];
						});
				});
		}

		if (this.options.type === 'report') {
			new Setting(contentEl)
				.setName(i18n.modalReportFormatName)
				.addDropdown((dd) => {
					dd.addOption('Study Guide', i18n.optReportStudyGuide)
						.addOption('Briefing Doc', i18n.optReportBriefing)
						.addOption('Blog Post', i18n.optReportBlog)
						.addOption('Create Your Own', i18n.optReportCustom)
						.setValue(this.options.reportFormat || 'Study Guide')
						.onChange((val) => {
							this.options.reportFormat = val as ArtifactCreateOptions['reportFormat'];
						});
				});
		}

		if (this.options.type === 'quiz') {
			new Setting(contentEl)
				.setName(i18n.modalQuizCountName)
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
				.setName(i18n.modalQuizDiffName)
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
				.setName(i18n.modalFlashcardsDiffName)
				.addDropdown((dd) => {
					dd.addOption('easy', i18n.optDiffEasy)
						.addOption('medium', i18n.optDiffMedium)
						.addOption('hard', i18n.optDiffHard)
						.setValue(this.options.flashcardsDifficulty || 'medium')
						.onChange((val) => {
							this.options.flashcardsDifficulty =
								val as ArtifactCreateOptions['flashcardsDifficulty'];
						});
				});
		}

		if (
			this.options.type === 'audio' ||
			this.options.type === 'report' ||
			this.options.type === 'slide_deck' ||
			this.options.type === 'infographic'
		) {
			const defaultLangCode = this.options.language || 'de';
			new Setting(contentEl)
				.setName(i18n.modalLanguageName)
				.setDesc(i18n.modalLanguageDesc)
				.addText((text) => {
					text.setPlaceholder(defaultLangCode)
						.setValue(defaultLangCode)
						.onChange((val) => {
							this.options.language = val.trim();
						});
				});
		}

		const focusSetting = new Setting(contentEl)
			.setName(i18n.modalFocusName)
			.setDesc(i18n.modalFocusDesc);
		focusSetting.settingEl.addClass('nlm-focus-setting-block');
		focusSetting.addTextArea((ta) => {
			ta.setPlaceholder(i18n.modalFocusPlaceholder)
				.setValue(this.options.focus || '')
				.onChange((val) => {
					this.options.focus = val;
				});
			ta.inputEl.rows = 6;
			ta.inputEl.addClass('nlm-full-width-textarea');
		});

		const footer = contentEl.createDiv({ cls: 'nlm-modal-footer' });
		const cancelBtn = footer.createEl('button', { text: i18n.btnCancel });
		cancelBtn.addEventListener('click', () => this.close());

		const startBtn = footer.createEl('button', {
			text: i18n.btnStartGeneration,
			cls: 'mod-cta',
		});
		startBtn.addEventListener('click', () => {
			this.close();
			this.onSubmit(this.options);
		});
	}

	onClose(): void {
		this.folderSuggest?.close();
		this.folderSuggest = null;
		this.contentEl.empty();
	}
}
