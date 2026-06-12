export const dynamic = 'force-dynamic';

import { PageWrapper } from '../../components/layout/PageWrapper';
import { getProjects } from '../../lib/api/index';
import { formatRelativeTime } from '../../lib/utils/format';
import type { RelayProjectSafe } from '../../types/relay';

function ProjectCard({ project }: { project: RelayProjectSafe }) {
  return (
    <div className="bg-bg-surface border border-border-base rounded-lg p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-sans font-semibold text-ink-primary">{project.name}</h2>
          <p className="text-2xs font-mono text-ink-muted mt-0.5">{project.project_id}</p>
        </div>
        <span
          className={`flex-shrink-0 text-2xs font-mono px-2 py-0.5 rounded ${
            project.is_active
              ? 'bg-success/10 text-success'
              : 'bg-ink-faint text-ink-muted'
          }`}
        >
          {project.is_active ? 'active' : 'inactive'}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 py-3 border-t border-border-base">
        <div>
          <div className="text-2xs font-mono text-ink-muted uppercase tracking-wider mb-1">Rate limit</div>
          <div className="text-xs font-mono text-ink-primary">{project.rate_limit_per_minute}<span className="text-ink-muted">/min</span></div>
        </div>
        <div>
          <div className="text-2xs font-mono text-ink-muted uppercase tracking-wider mb-1">Registered</div>
          <div className="text-xs font-mono text-ink-secondary">{formatRelativeTime(project.created_at)}</div>
        </div>
      </div>

      {/* Event types */}
      <div>
        <div className="text-2xs font-mono text-ink-muted uppercase tracking-wider mb-2">Allowed event types</div>
        <div className="flex flex-wrap gap-1.5">
          {project.event_types_allowed.map((et) => (
            <span
              key={et}
              className="text-2xs font-mono text-ink-secondary bg-bg-elevated border border-border-base rounded px-2 py-0.5"
            >
              {et}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function ProjectsPage() {
  let projects: RelayProjectSafe[] = [];
  let loadError = false;

  try {
    const data = await getProjects();
    projects = data.projects;
  } catch {
    loadError = true;
  }

  return (
    <PageWrapper>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-sans font-semibold text-ink-primary tracking-tight">Projects</h1>
          {!loadError && (
            <p className="text-xs font-mono text-ink-muted mt-0.5">
              {projects.length} registered project{projects.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {loadError && (
          <div className="border border-danger/20 bg-danger-dim rounded-lg px-4 py-3 text-xs font-mono text-danger">
            Failed to load — check API connectivity
          </div>
        )}

        {!loadError && projects.length === 0 && (
          <div className="bg-bg-surface border border-border-base rounded-lg px-5 py-3">
            <span className="font-mono text-xs text-ink-muted">No projects registered.</span>
          </div>
        )}

        {!loadError && projects.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            {projects.map((p) => (
              <ProjectCard key={p.project_id} project={p} />
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
