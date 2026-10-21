import * as path from 'path';
import * as fs from 'fs';
import { App, Notice, TFile } from 'obsidian';
import { ArtifactJob, ArtifactType } from '../types';
import { NlmBridge } from '../bridge/nlmBridge';
import { UILanguage, resolveUILanguage, t } from '../i18n';
import { convertMindmapJsonToMarkdown } from '../utils/mindmapConverter';

const MAX_STORED_JOBS = 30;

export class ArtifactTracker {
	private app: App;
	private bridge: NlmBridge;
	private getJobs: () => ArtifactJob[];
	private saveJobs: (jobs: ArtifactJob[]) => Promise<void>;
	private onUpdateCallbacks: Set<() => void> = new Set();
	private intervalId: number | null = null;
	private isPolling = false;
	private autoInsertLink: () => boolean;
	private convertMindmap: () => boolean;
	private getLang: () => UILanguage;

	constructor(
		app: App,
		bridge: NlmBridge,
		getJobs: () => ArtifactJob[],
		saveJobs: (jobs: ArtifactJob[]) => Promise<void>,
		autoInsertLink: () => boolean,
		convertMindmap: () => boolean,
		getLang: () => UILanguage
	) {
		this.app = app;
		this.bridge = bridge;
		this.getJobs = getJobs;
		this.saveJobs = saveJobs;
		this.autoInsertLink = autoInsertLink;
		this.convertMindmap = convertMindmap;
		this.getLang = getLang;
	}

	public onUpdate(cb: () => void): () => void {
		this.onUpdateCallbacks.add(cb);
		return () => this.onUpdateCallbacks.delete(cb);
	}

	private notifyUpdate(): void {
		for (const cb of this.onUpdateCallbacks) {
			try {
				cb();
			} catch (e) {
				console.error('ArtifactTracker listener error:', e);
			}
		}
	}

	public startPolling(intervalSeconds = 15): void {
		this.stopPolling();
		const ms = Math.max(8, intervalSeconds) * 1000;
		this.intervalId = window.setInterval(() => {
			void this.checkPendingJobs();
		}, ms);
	}

	public stopPolling(): void {
		if (this.intervalId !== null) {
			window.clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	public async addJob(job: ArtifactJob): Promise<void> {
		const jobs = this.getJobs();
		jobs.unshift(job);
		if (jobs.length > MAX_STORED_JOBS) {
			const active = jobs.filter((j) => !j.downloaded && j.status !== 'failed');
			const done = jobs
				.filter((j) => j.downloaded || j.status === 'failed')
				.slice(0, Math.max(5, MAX_STORED_JOBS - active.length));
			const keepIds = new Set([...active, ...done].map((j) => j.id));
			const pruned = jobs.filter((j) => keepIds.has(j.id));
			await this.saveJobs(pruned);
		} else {
			await this.saveJobs(jobs);
		}
		this.notifyUpdate();
	}

	public async removeJob(jobId: string): Promise<void> {
		const jobs = this.getJobs().filter((j) => j.id !== jobId);
		await this.saveJobs(jobs);
		this.notifyUpdate();
	}

	public async clearCompletedJobs(): Promise<void> {
		const jobs = this.getJobs().filter((j) => !j.downloaded && j.status !== 'failed');
		await this.saveJobs(jobs);
		this.notifyUpdate();
	}

	public getExtensionForType(type: ArtifactType): string {
		switch (type) {
			case 'audio':
				return '.m4a';
			case 'report':
			case 'quiz':
			case 'flashcards':
				return '.md';
			case 'mind_map':
				return this.convertMindmap() ? '.md' : '.json';
			case 'slide_deck':
				return '.pdf';
			case 'infographic':
				return '.png';
		}
	}

	public getTypeLabel(type: ArtifactType): string {
		switch (type) {
			case 'audio':
				return 'Audio Overview';
			case 'report':
				return 'Report';
			case 'quiz':
				return 'Quiz';
			case 'flashcards':
				return 'Flashcards';
			case 'mind_map':
				return 'Mind Map';
			case 'slide_deck':
				return 'Slides';
			case 'infographic':
				return 'Infographic';
		}
	}

	private sanitizeFileName(name: string): string {
		return name.replace(/[\\/:*?"<>|]/g, '-').trim();
	}

	private formatLocalTimestamp(ms: number): string {
		const d = new Date(ms);
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(
			d.getHours()
		)}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
	}

	public async checkPendingJobs(): Promise<void> {
		if (this.isPolling) return;
		const initialPending = this.getJobs().filter(
			(j) => !j.downloaded && j.status !== 'failed'
		);
		if (initialPending.length === 0) return;

		this.isPolling = true;
		const i18n = t(this.getLang());
		try {
			const byNotebook = new Map<string, ArtifactJob[]>();
			for (const job of initialPending) {
				const list = byNotebook.get(job.notebookId) || [];
				list.push(job);
				byNotebook.set(job.notebookId, list);
			}

			let changed = false;

			for (const [notebookId, notebookJobs] of byNotebook.entries()) {
				try {
					const statuses = await this.bridge.getStudioStatus(notebookId);
					for (const snapshotJob of notebookJobs) {
						const liveJob = this.getJobs().find((j) => j.id === snapshotJob.id);
						if (!liveJob || liveJob.downloaded || liveJob.status === 'failed') {
							continue;
						}

						const remote = statuses.find(
							(s) => s.id === liveJob.id || s.artifact_id === liveJob.id
						);
						if (!remote) continue;

						const normalizedStatus =
							remote.status === 'in_progress' ? 'processing' : remote.status;

						if (
							normalizedStatus === 'processing' &&
							liveJob.status !== 'processing'
						) {
							liveJob.status = 'processing';
							changed = true;
						} else if (normalizedStatus === 'failed') {
							liveJob.status = 'failed';
							liveJob.error = i18n.artifactFailed;
							changed = true;
							new Notice(i18n.noticeArtifactFailedRemote(liveJob.label));
						} else if (normalizedStatus === 'completed' && !liveJob.downloaded) {
							const ok = await this.downloadCompletedJob(liveJob);
							if (ok) {
								changed = true;
							} else {
								liveJob.status = 'processing';
								changed = true;
							}
						}
					}
				} catch (err) {
					console.warn(`Status check failed for notebook ${notebookId}:`, err);
				}
			}

			if (changed) {
				await this.saveJobs(this.getJobs());
				this.notifyUpdate();
			}
		} finally {
			this.isPolling = false;
		}
	}

	public async downloadCompletedJob(job: ArtifactJob): Promise<boolean> {
		const i18n = t(this.getLang());
		try {
			const shouldConvertMindmap =
				job.type === 'mind_map' && this.convertMindmap();
			const ext = this.getExtensionForType(job.type);
			const typeLabel = this.getTypeLabel(job.type);
			const baseNote = this.sanitizeFileName(job.sourceNoteName || 'NotebookLM');
			const dateSuffix = this.formatLocalTimestamp(job.createdAt);

			if (!fs.existsSync(job.targetFolderAbs)) {
				fs.mkdirSync(job.targetFolderAbs, { recursive: true });
			}

			let fileName = `${baseNote} - ${typeLabel} (${dateSuffix})${ext}`;
			let outputAbsPath = path.join(job.targetFolderAbs, fileName);
			let counter = 2;
			while (fs.existsSync(outputAbsPath)) {
				fileName = `${baseNote} - ${typeLabel} (${dateSuffix}_${counter})${ext}`;
				outputAbsPath = path.join(job.targetFolderAbs, fileName);
				counter++;
			}

			new Notice(i18n.noticeDownloadingArtifact(fileName));

			if (shouldConvertMindmap) {
				const tempJsonPath = `${outputAbsPath}.tmp.json`;
				try {
					await this.bridge.downloadArtifact(
						job.notebookId,
						job.id,
						job.type,
						tempJsonPath
					);
				} catch (dlErr) {
					if (fs.existsSync(tempJsonPath)) {
						try {
							fs.unlinkSync(tempJsonPath);
						} catch {
							// Ignore cleanup error
						}
					}
					throw dlErr;
				}
				try {
					const rawJson = fs.readFileSync(tempJsonPath, 'utf-8');
					const markdownContent = convertMindmapJsonToMarkdown(
						rawJson,
						`${baseNote} - ${typeLabel}`,
						resolveUILanguage(this.getLang())
					);
					fs.writeFileSync(outputAbsPath, markdownContent, 'utf-8');
					fs.unlinkSync(tempJsonPath);
				} catch (convErr) {
					console.warn(
						'Mindmap JSON to Mermaid conversion failed, keeping JSON file:',
						convErr
					);
					let jsonFileName = fileName.replace(/\.md$/, '.json');
					let jsonAbsPath = path.join(job.targetFolderAbs, jsonFileName);
					let fallbackCounter = 2;
					while (fs.existsSync(jsonAbsPath)) {
						jsonFileName = `${baseNote} - ${typeLabel} (${dateSuffix}_${fallbackCounter}).json`;
						jsonAbsPath = path.join(job.targetFolderAbs, jsonFileName);
						fallbackCounter++;
					}
					fileName = jsonFileName;
					outputAbsPath = jsonAbsPath;
					fs.renameSync(tempJsonPath, outputAbsPath);
				}
			} else {
				await this.bridge.downloadArtifact(
					job.notebookId,
					job.id,
					job.type,
					outputAbsPath
				);
			}

			job.downloaded = true;
			job.status = 'completed';
			job.error = undefined;
			job.downloadedFilePath = job.targetFolderRel
				? `${job.targetFolderRel}/${fileName}`
				: fileName;

			new Notice(
				i18n.noticeArtifactSaved(typeLabel, job.downloadedFilePath),
				8000
			);

			if (this.autoInsertLink() && job.sourceNotePath) {
				const abstractFile = this.app.vault.getAbstractFileByPath(job.sourceNotePath);
				if (abstractFile instanceof TFile) {
					await this.app.vault.append(
						abstractFile,
						`\n\n![[${fileName}]]\n`
					);
				}
			}
			return true;
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			job.error = msg;
			new Notice(i18n.noticeDownloadRetry(job.label, msg));
			return false;
		}
	}
}
