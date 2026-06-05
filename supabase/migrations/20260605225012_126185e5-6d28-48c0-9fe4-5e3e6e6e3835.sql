
-- Fix 1: Restrict bids SELECT to bid's provider, job's poster, or admin
DROP POLICY IF EXISTS bids_select_auth ON public.bids;
CREATE POLICY bids_select_involved ON public.bids
FOR SELECT TO authenticated
USING (
  auth.uid() = provider_id
  OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = bids.job_id AND j.poster_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Fix 2: Restrict jobs SELECT — open jobs visible to all authenticated (marketplace),
-- non-open jobs only visible to poster, assigned provider, or admin
DROP POLICY IF EXISTS jobs_select_auth ON public.jobs;
CREATE POLICY jobs_select_scoped ON public.jobs
FOR SELECT TO authenticated
USING (
  status = 'open'::public.job_status
  OR auth.uid() = poster_id
  OR auth.uid() = assigned_provider_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Fix 3: Lock down user_roles INSERT/UPDATE/DELETE — replace ALL admin policy with
-- explicit per-command policies so authenticated users cannot self-assign roles.
-- Role assignment for new users is handled by handle_new_user() SECURITY DEFINER trigger.
DROP POLICY IF EXISTS user_roles_admin_all ON public.user_roles;
CREATE POLICY user_roles_admin_insert ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY user_roles_admin_update ON public.user_roles
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY user_roles_admin_delete ON public.user_roles
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Fix 4: Revoke EXECUTE on has_role from authenticated/anon. RLS policies still
-- evaluate it because policy execution context bypasses grant checks for referenced
-- functions, but signed-in users cannot call it directly via the API.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
