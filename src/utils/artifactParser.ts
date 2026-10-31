import { ArtifactType } from '../types';

/**
 * Normalizes a raw studio artifact type string from `nlm studio status`
 * into the canonical `ArtifactType` used by the plugin.
 */
export function normalizeArtifactType(rawType: string): ArtifactType {
	const lower = (rawType || '').toLowerCase().trim();
	if (lower.includes('audio') || lower.includes('podcast')) return 'audio';
	if (lower.includes('quiz')) return 'quiz';
	if (lower.includes('flashcard')) return 'flashcards';
	if (lower.includes('mind') || lower.includes('map')) return 'mind_map';
	if (lower.includes('slide') || lower.includes('deck') || lower.includes('presentation')) {
		return 'slide_deck';
	}
	if (lower.includes('infographic')) return 'infographic';
	return 'report';
}

/**
 * Returns true if the raw studio artifact type from `nlm studio status`
 * corresponds to one of the 7 artifact types supported for vault download.
 */
export function isSupportedArtifactType(rawType: string): boolean {
	const lower = (rawType || '').toLowerCase().trim();
	if (!lower) return false;
	return (
		lower.includes('audio') ||
		lower.includes('podcast') ||
		lower.includes('quiz') ||
		lower.includes('flashcard') ||
		lower.includes('mind') ||
		lower.includes('map') ||
		lower.includes('slide') ||
		lower.includes('deck') ||
		lower.includes('presentation') ||
		lower.includes('infographic') ||
		lower.includes('report') ||
		lower.includes('study_guide') ||
		lower.includes('briefing') ||
		lower.includes('blog') ||
		lower.includes('summary')
	);
}
