export function WorkspaceLoading({ compact = false }: { compact?: boolean }) {
  return <div className={`workspace-loading${compact ? " is-compact" : " workspace-page"}`} role="status" aria-label="Загрузка раздела">
    <span className="sr-only">Загрузка раздела…</span>
    <div aria-hidden="true" className="workspace-loading-title" />
    <div aria-hidden="true" className="workspace-loading-subtitle" />
    <div aria-hidden="true" className="workspace-loading-row" />
    <div aria-hidden="true" className="workspace-loading-row" />
    <div aria-hidden="true" className="workspace-loading-row" />
  </div>;
}
