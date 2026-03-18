/* ═══════════════════════════════════════════════════════════════
   _exportUtils — Shared helpers for pluggable exporters
   ═══════════════════════════════════════════════════════════════
   Internal module — not part of the public SDK.
   ═══════════════════════════════════════════════════════════════ */

/**
 * Trigger a browser file download from a Blob.
 * @param {Blob}   blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoke after a short delay to let the browser open the download
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Ensure a filename ends with the given extension.
 * @param {string} name
 * @param {string} ext  — without leading dot
 * @returns {string}
 */
export function ensureExtension(name, ext) {
  const dot = `.${ext.toLowerCase()}`;
  return name.toLowerCase().endsWith(dot) ? name : name + dot;
}

/**
 * Sanitize a name for use as a filename (strip illegal chars).
 * @param {string} name
 * @returns {string}
 */
export function safeName(name) {
  return (name ?? 'object').replace(/[^a-zA-Z0-9._\-]/g, '_').replace(/_{2,}/g, '_');
}
