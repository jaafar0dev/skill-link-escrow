
-- Keep only the most recent bid per provider per job, delete older duplicates
DELETE FROM public.bids b
USING public.bids b2
WHERE b.provider_id = b2.provider_id
  AND b.job_id = b2.job_id
  AND b.created_at < b2.created_at;

-- Enforce single bid per provider per job
ALTER TABLE public.bids
  ADD CONSTRAINT bids_unique_provider_job UNIQUE (job_id, provider_id);
