import { NotebookViewHost } from './notebookState';

export function stopAudioPlayback(host: NotebookViewHost): void {
	const state = host.state;
	state.playingArtifactId = null;
	if (state.activeAudioEl) {
		state.activeAudioEl.pause();
		state.activeAudioEl.removeAttribute('src');
		state.activeAudioEl = null;
	}
	state.activeAudioArtifactId = null;
}
