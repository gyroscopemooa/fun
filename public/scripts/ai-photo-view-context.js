(() => {
  const DEFAULT_CONTEXT = Object.freeze({
    status: 'all',
    tool: 'all',
    provider: 'all',
    limit: '12',
    sinceHours: '24',
    flaggedOnly: false,
    fallbackOnly: false,
    miniTrend: 'risk',
    previewKey: null
  });

  const parseOpsViewUrl = (viewUrl = '') => {
    if (!viewUrl) return null;
    const parsedOpsUrl = new URL(viewUrl, window.location.origin);
    const opsParams = parsedOpsUrl.searchParams;
    return {
      status: opsParams.get('status') ?? DEFAULT_CONTEXT.status,
      tool: opsParams.get('toolType') ?? DEFAULT_CONTEXT.tool,
      provider: opsParams.get('provider') ?? DEFAULT_CONTEXT.provider,
      limit: opsParams.get('limit') ?? DEFAULT_CONTEXT.limit,
      sinceHours: opsParams.get('sinceHours') ?? DEFAULT_CONTEXT.sinceHours,
      flaggedOnly: opsParams.get('flaggedOnly') === 'true',
      fallbackOnly: opsParams.get('fallbackOnly') === 'true',
      miniTrend: opsParams.get('miniTrend') ?? DEFAULT_CONTEXT.miniTrend,
      previewKey: opsParams.get('previewKey') ?? DEFAULT_CONTEXT.previewKey
    };
  };

  const withDefaultContext = (summary = null) => ({
    ...DEFAULT_CONTEXT,
    ...(summary ?? {})
  });

  const formatViewContextSummary = (summary = null) => {
    const normalized = withDefaultContext(summary);
    return `status=${normalized.status}, tool=${normalized.tool}, provider=${normalized.provider}, limit=${normalized.limit}, sinceHours=${normalized.sinceHours}, flaggedOnly=${normalized.flaggedOnly}, fallbackOnly=${normalized.fallbackOnly}, miniTrend=${normalized.miniTrend}, previewKey=${normalized.previewKey ?? 'none'}`;
  };

  const createViewContext = (url, summary = null) => ({
    url: url || null,
    summary: withDefaultContext(summary)
  });

  const createExportMeta = (source, exportedAt = new Date().toISOString()) => ({
    source,
    exportedAt
  });

  const createExportEnvelope = (surface, payload = {}, exportedAt = new Date().toISOString()) => ({
    schemaVersion: 'ai-photo-view-context.v1',
    surface,
    ...payload,
    exportMeta: payload.exportMeta ?? createExportMeta(surface, exportedAt)
  });

  const createLegacyFields = (fields = {}) => {
    const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  };

  const downloadTextFile = (name, text, type = 'text/plain;charset=utf-8') => {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const copyText = async (text) => {
    await navigator.clipboard.writeText(text);
  };

  window.AIPhotoViewContext = {
    copyText,
    createExportEnvelope,
    createLegacyFields,
    createExportMeta,
    createViewContext,
    downloadTextFile,
    formatViewContextSummary,
    parseOpsViewUrl,
    withDefaultContext
  };
})();
