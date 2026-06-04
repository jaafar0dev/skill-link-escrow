
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('poster', 'provider', 'admin');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- has_role helper
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Allow admins to read/manage all roles
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile + default poster role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'poster'::public.app_role)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Jobs
CREATE TYPE public.job_status AS ENUM ('open', 'in_escrow', 'delivered', 'completed', 'cancelled');

CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  budget_naira INTEGER NOT NULL CHECK (budget_naira >= 0),
  status public.job_status NOT NULL DEFAULT 'open',
  assigned_provider_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  final_price_naira INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jobs_select_auth" ON public.jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "jobs_insert_poster" ON public.jobs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = poster_id AND public.has_role(auth.uid(), 'poster'));
CREATE POLICY "jobs_update_own_or_admin" ON public.jobs FOR UPDATE TO authenticated
  USING (auth.uid() = poster_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = poster_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "jobs_delete_own" ON public.jobs FOR DELETE TO authenticated
  USING (auth.uid() = poster_id AND status = 'open');

-- Bids
CREATE TYPE public.bid_status AS ENUM ('pending', 'accepted', 'rejected');

CREATE TABLE public.bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_naira INTEGER NOT NULL CHECK (amount_naira >= 0),
  message TEXT NOT NULL DEFAULT '',
  status public.bid_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bids TO authenticated;
GRANT ALL ON public.bids TO service_role;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bids_select_auth" ON public.bids FOR SELECT TO authenticated USING (true);
CREATE POLICY "bids_insert_provider" ON public.bids FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = provider_id AND public.has_role(auth.uid(), 'provider'));
CREATE POLICY "bids_update_own_or_poster" ON public.bids FOR UPDATE TO authenticated
  USING (
    auth.uid() = provider_id
    OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.poster_id = auth.uid())
  );
CREATE POLICY "bids_delete_own" ON public.bids FOR DELETE TO authenticated
  USING (auth.uid() = provider_id AND status = 'pending');

-- Escrow
CREATE TYPE public.escrow_status AS ENUM ('funded', 'released', 'refunded');

CREATE TABLE public.escrow_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL UNIQUE REFERENCES public.jobs(id) ON DELETE CASCADE,
  amount_naira INTEGER NOT NULL CHECK (amount_naira >= 0),
  status public.escrow_status NOT NULL DEFAULT 'funded',
  released_at TIMESTAMPTZ,
  released_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.escrow_transactions TO authenticated;
GRANT ALL ON public.escrow_transactions TO service_role;
ALTER TABLE public.escrow_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "escrow_select_involved_or_admin" ON public.escrow_transactions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_id
        AND (j.poster_id = auth.uid() OR j.assigned_provider_id = auth.uid())
    )
  );
CREATE POLICY "escrow_insert_poster" ON public.escrow_transactions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.poster_id = auth.uid())
  );
CREATE POLICY "escrow_update_admin" ON public.escrow_transactions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
