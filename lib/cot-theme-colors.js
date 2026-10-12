const SYSTEM_COLOR_ROLES = Object.freeze({
  selection: Object.freeze({ color: 'Highlight', fallback: 'var(--accent)' }),
  insertionPoint: Object.freeze({ color: 'CanvasText', fallback: 'var(--accent)' }),
  highlight: Object.freeze({ color: 'AccentColor', fallback: 'var(--accent)' })
});

export function resolveCotEditorThemeStyles(theme, supportsCssColor = () => true) {
  const styles = { ...(theme?.styles || {}) };
  const systemSettings = new Set(Array.isArray(theme?.systemSettings) ? theme.systemSettings : []);
  for (const [key, role] of Object.entries(SYSTEM_COLOR_ROLES)) {
    if (systemSettings.has(key)) styles[key] = supportsCssColor(role.color) ? role.color : role.fallback;
  }
  return styles;
}

export { SYSTEM_COLOR_ROLES };
