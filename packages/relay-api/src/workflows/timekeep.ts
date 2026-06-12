import type { WorkflowContext } from '../types/relay';
import { logger } from '../lib/logger';

export async function handleTimekeepClockeventRecorded(
  context: WorkflowContext,
): Promise<Record<string, unknown>> {
  const { employee_id, business_id, event_type, timestamp, shift_id } = context.payload as {
    employee_id: string;
    business_id: string;
    event_type: string;
    timestamp: string;
    shift_id?: string;
  };

  logger.info('TimeKeep clock event recorded', {
    event_id: context.eventId,
    attempt: context.attempt,
    employee_id,
    business_id,
    clock_event_type: event_type,
    shift_id,
  });

  // Stub: would update shift records and trigger payroll accrual
  return {
    employee_id,
    business_id,
    clock_event_type: event_type,
    timestamp,
    shift_id,
    processed: true,
  };
}

export async function handleTimekeepPayrollExportRequested(
  context: WorkflowContext,
): Promise<Record<string, unknown>> {
  const { business_id, period_start, period_end, format, employee_ids } = context.payload as {
    business_id: string;
    period_start: string;
    period_end: string;
    format: string;
    employee_ids?: string[];
  };

  logger.info('TimeKeep payroll export requested', {
    event_id: context.eventId,
    attempt: context.attempt,
    business_id,
    period_start,
    period_end,
    format,
    employee_count: employee_ids?.length ?? 0,
  });

  // Stub: would compile payroll data and upload CSV/JSON to S3
  return {
    business_id,
    period_start,
    period_end,
    format,
    employee_count: employee_ids?.length ?? 0,
    export_key: `payroll/${business_id}/${period_start}_${period_end}.${format}`,
    status: 'stub — payroll export integration pending',
  };
}

export async function handleTimekeepNotificationDispatchRequested(
  context: WorkflowContext,
): Promise<Record<string, unknown>> {
  const { recipient_id, channel, template, variables } = context.payload as {
    recipient_id: string;
    channel: string;
    template: string;
    variables?: Record<string, string>;
  };

  logger.info('TimeKeep notification dispatch requested', {
    event_id: context.eventId,
    attempt: context.attempt,
    recipient_id,
    channel,
    template,
  });

  // Stub: would send via Twilio (SMS) or Resend (email)
  return {
    recipient_id,
    channel,
    template,
    variables: variables ?? {},
    delivered: false,
    status: 'stub — Twilio/Resend integration pending',
  };
}
