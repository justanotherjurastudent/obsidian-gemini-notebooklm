import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
	isSupportedArtifactType,
	normalizeArtifactType,
} from './artifactParser';

void test('normalizeArtifactType and isSupportedArtifactType classify CLI and remote types accurately', () => {
	assert.equal(normalizeArtifactType('audio'), 'audio');
	assert.equal(normalizeArtifactType('audio_overview'), 'audio');
	assert.equal(normalizeArtifactType('podcast'), 'audio');
	assert.equal(normalizeArtifactType('quiz'), 'quiz');
	assert.equal(normalizeArtifactType('flashcards'), 'flashcards');
	assert.equal(normalizeArtifactType('flashcard_deck'), 'flashcards');
	assert.equal(normalizeArtifactType('mind_map'), 'mind_map');
	assert.equal(normalizeArtifactType('mindmap'), 'mind_map');
	assert.equal(normalizeArtifactType('slide_deck'), 'slide_deck');
	assert.equal(normalizeArtifactType('presentation'), 'slide_deck');
	assert.equal(normalizeArtifactType('infographic'), 'infographic');
	assert.equal(normalizeArtifactType('report'), 'report');
	assert.equal(normalizeArtifactType('study_guide'), 'report');

	assert.equal(isSupportedArtifactType('audio_overview'), true);
	assert.equal(isSupportedArtifactType('mind_map'), true);
	assert.equal(isSupportedArtifactType('report'), true);
	assert.equal(isSupportedArtifactType('study_guide'), true);
	assert.equal(isSupportedArtifactType('video'), false);
	assert.equal(isSupportedArtifactType('data_table'), false);
	assert.equal(isSupportedArtifactType('file'), false);
	assert.equal(isSupportedArtifactType(''), false);
});
