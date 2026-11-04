// nlm has no per-source enable flag; only --source-ids scopes a query.
// The UI toggles are the source of truth: every enabled source is queried,
// context files only force-include a source on top.
// undefined = let nlm use all sources; [] = every source is disabled.
export function resolveSourceScope(
	allSourceIds: string[],
	disabledIds: string[],
	contextIds: string[]
): string[] | undefined {
	if (allSourceIds.length === 0) return undefined;

	const enabledIds = allSourceIds.filter((id) => !disabledIds.includes(id));
	// Nothing switched off -> default behaviour, query everything
	if (enabledIds.length === allSourceIds.length) return undefined;

	const scope = new Set(enabledIds);
	for (const id of contextIds) {
		if (!disabledIds.includes(id)) scope.add(id);
	}
	return [...scope];
}
