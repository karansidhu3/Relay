import { PageWrapper } from '../../components/layout/PageWrapper';
import { EventsTable } from '../../components/events/EventsTable';

export default function EventsPage() {
  return (
    <PageWrapper>
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-mono font-medium text-ink-primary">Event Stream</h1>
          <p className="text-xs font-mono text-ink-secondary mt-0.5">
            proj_careeeros — refreshes every 30s
          </p>
        </div>
        <EventsTable />
      </div>
    </PageWrapper>
  );
}
