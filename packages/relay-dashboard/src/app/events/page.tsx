import { PageWrapper } from '../../components/layout/PageWrapper';
import { EventsTable } from '../../components/events/EventsTable';

export default function EventsPage() {
  return (
    <PageWrapper>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-sans font-semibold text-ink-primary tracking-tight">Event Stream</h1>
          <p className="text-xs font-mono text-ink-muted mt-1">
            proj_careeeros · refreshes every 30s
          </p>
        </div>
        <EventsTable />
      </div>
    </PageWrapper>
  );
}
