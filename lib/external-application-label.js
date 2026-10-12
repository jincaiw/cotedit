function normalizedApplicationName(value) {
  return typeof value === 'string' ? value.normalize('NFC').trim() : '';
}

/** Disambiguate duplicate external-application names and mark the default choice. */
export function formatExternalApplicationLabel(application, applications = [], { isDefault = false } = {}) {
  const name = normalizedApplicationName(application?.displayName);
  if (!name) return '';

  const foldedName = name.toLowerCase();
  const duplicate = Array.isArray(applications) && applications.filter(candidate =>
    normalizedApplicationName(candidate?.displayName).toLowerCase() === foldedName
  ).length > 1;
  const version = typeof application?.version === 'string' ? application.version.trim() : '';
  const versionSuffix = duplicate && version ? ` (${version})` : '';
  const defaultSuffix = isDefault ? '（默认）' : '';

  return `${name}${versionSuffix}${defaultSuffix}`;
}
