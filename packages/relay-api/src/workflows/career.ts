import type { WorkflowContext } from '../types/relay';
import { logger } from '../lib/logger';

export async function handleCareerJobIngested(
  context: WorkflowContext,
): Promise<Record<string, unknown>> {
  const { job_id, source, title, company } = context.payload as {
    job_id: string;
    source: string;
    title: string;
    company: string;
  };

  logger.info('Career job ingested', {
    event_id: context.eventId,
    attempt: context.attempt,
    job_id,
    source,
    title,
    company,
  });

  // Stub: would trigger downstream scoring and indexing
  return { job_id, indexed: true, scoring_enqueued: true };
}

export async function handleCareerJobScoringRequested(
  context: WorkflowContext,
): Promise<Record<string, unknown>> {
  const { job_id, resume_id, candidate_id, scoring_model } = context.payload as {
    job_id: string;
    resume_id: string;
    candidate_id: string;
    scoring_model?: string;
  };

  logger.info('Career job scoring requested', {
    event_id: context.eventId,
    attempt: context.attempt,
    job_id,
    resume_id,
    candidate_id,
    scoring_model: scoring_model ?? 'claude-sonnet',
  });

  // Stub: would call Claude API to score the job against the candidate resume
  return {
    job_id,
    candidate_id,
    score: 0.82,
    match_level: 'strong',
    reasoning: 'stub — Claude API integration pending',
    scored_at: new Date().toISOString(),
  };
}

export async function handleCareerDocumentGenerationRequested(
  context: WorkflowContext,
): Promise<Record<string, unknown>> {
  const { job_id, candidate_id, document_type } = context.payload as {
    job_id: string;
    candidate_id: string;
    document_type: string;
  };

  logger.info('Career document generation requested', {
    event_id: context.eventId,
    attempt: context.attempt,
    job_id,
    candidate_id,
    document_type,
  });

  // Stub: would call Claude API to generate tailored resume or cover letter
  return {
    job_id,
    candidate_id,
    document_type,
    document_id: `doc_${context.eventId.slice(-8)}`,
    generated_at: new Date().toISOString(),
    status: 'stub — Claude API integration pending',
  };
}

export async function handleCareerDigestDispatchScheduled(
  context: WorkflowContext,
): Promise<Record<string, unknown>> {
  const { candidate_id, period, new_jobs_count, digest_type } = context.payload as {
    candidate_id: string;
    period: string;
    new_jobs_count: number;
    digest_type: string;
  };

  logger.info('Career digest dispatch scheduled', {
    event_id: context.eventId,
    attempt: context.attempt,
    candidate_id,
    period,
    new_jobs_count,
    digest_type,
  });

  // Stub: would compile digest and send via Resend
  return {
    candidate_id,
    period,
    digest_type,
    jobs_included: new_jobs_count,
    delivered: false,
    status: 'stub — Resend integration pending',
  };
}
