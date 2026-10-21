import { getLanguage, moment } from 'obsidian';
import { DE_STRINGS } from './de';
import { EN_STRINGS } from './en';
import { ResolvedLanguage, TranslationStrings, UILanguage } from './types';

export type { ResolvedLanguage, TranslationStrings, UILanguage };

export function resolveUILanguage(pref: UILanguage): ResolvedLanguage {
	if (pref === 'de' || pref === 'en') {
		return pref;
	}
	const obsLang = typeof getLanguage === 'function' ? getLanguage() : '';
	const loc = (obsLang || moment.locale() || 'en').toLowerCase();
	return loc.startsWith('de') ? 'de' : 'en';
}

export function t(pref: UILanguage): TranslationStrings {
	return resolveUILanguage(pref) === 'de' ? DE_STRINGS : EN_STRINGS;
}
