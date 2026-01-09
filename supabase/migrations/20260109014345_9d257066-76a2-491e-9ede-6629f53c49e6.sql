-- 1. Create pending_actions table for delayed execution of dangerous actions
CREATE TABLE public.pending_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  action_type TEXT NOT NULL,
  action_tier TEXT NOT NULL DEFAULT 'tier3' CHECK (action_tier IN ('tier1', 'tier2', 'tier3')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  target_table TEXT,
  target_id TEXT,
  justification TEXT NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'cancelled', 'expired')),
  executed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancelled_reason TEXT,
  affected_users_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pending_actions ENABLE ROW LEVEL SECURITY;

-- Only Super Admin can manage pending actions
CREATE POLICY "Super Admin can view pending actions"
ON public.pending_actions FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super Admin can insert pending actions"
ON public.pending_actions FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'super_admin') AND actor_id = auth.uid());

CREATE POLICY "Super Admin can update own pending actions"
ON public.pending_actions FOR UPDATE
USING (public.has_role(auth.uid(), 'super_admin') AND actor_id = auth.uid() AND status = 'pending');

-- 2. Create content_block_versions table for versioning
CREATE TABLE public.content_block_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_block_id UUID NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  change_reason TEXT
);

-- Enable RLS
ALTER TABLE public.content_block_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view content versions"
ON public.content_block_versions FOR SELECT
USING (true);

CREATE POLICY "Super Admin can insert content versions"
ON public.content_block_versions FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super Admin can update content versions"
ON public.content_block_versions FOR UPDATE
USING (public.has_role(auth.uid(), 'super_admin'));

-- 3. Create app_settings_history table for settings versioning
CREATE TABLE public.app_settings_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  change_reason TEXT,
  is_rollback BOOLEAN NOT NULL DEFAULT false,
  rolled_back_from UUID REFERENCES public.app_settings_history(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super Admin can view settings history"
ON public.app_settings_history FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super Admin can insert settings history"
ON public.app_settings_history FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 4. Add soft delete and version tracking to content_blocks
ALTER TABLE public.content_blocks
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS current_version INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by UUID;

-- 5. Add soft delete to available_skills
ALTER TABLE public.available_skills
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by UUID;

-- 6. Create index for pending actions scheduled execution
CREATE INDEX idx_pending_actions_scheduled ON public.pending_actions(scheduled_for, status)
WHERE status = 'pending';

-- 7. Create index for settings history lookup
CREATE INDEX idx_settings_history_key ON public.app_settings_history(setting_key, created_at DESC);