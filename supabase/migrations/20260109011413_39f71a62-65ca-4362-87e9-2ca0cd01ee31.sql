-- 1. Create application_status enum
CREATE TYPE public.application_status AS ENUM (
  'unpaid',
  'paid', 
  'form_submitted',
  'form_verified',
  'form_rejected',
  'id_generated'
);

-- 2. Add application_status to profiles
ALTER TABLE public.profiles 
ADD COLUMN application_status public.application_status NOT NULL DEFAULT 'unpaid';

-- 3. Add verification_notes to payments
ALTER TABLE public.payments 
ADD COLUMN verification_notes text;

-- 4. Add verification_notes and verified_by to skill_forms
ALTER TABLE public.skill_forms 
ADD COLUMN verification_notes text,
ADD COLUMN verified_by uuid,
ADD COLUMN verified_at timestamptz;

-- 5. Create id_cards table (one-to-one with user)
CREATE TABLE public.id_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL,
  card_url text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by text NOT NULL DEFAULT 'student'
);

ALTER TABLE public.id_cards ENABLE ROW LEVEL SECURITY;

-- Students can view their own ID card
CREATE POLICY "Students can view own ID card"
ON public.id_cards FOR SELECT
USING (auth.uid() = user_id);

-- Students can insert their own ID card (one-time)
CREATE POLICY "Students can generate own ID card"
ON public.id_cards FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all ID cards
CREATE POLICY "Admins can view all ID cards"
ON public.id_cards FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- 6. Create action_logs table for admin audit trail
CREATE TABLE public.action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  action_type text NOT NULL,
  target_table text NOT NULL,
  target_id uuid NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;

-- Super Admin can view all logs (immutable - no update/delete)
CREATE POLICY "Super Admin can view action logs"
ON public.action_logs FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Admins can insert logs (their actions)
CREATE POLICY "Admins can insert action logs"
ON public.action_logs FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- 7. Migrate existing data to set application_status based on current state
UPDATE public.profiles p
SET application_status = 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.skill_forms sf 
      WHERE sf.student_id = p.user_id
    ) THEN 'form_submitted'::application_status
    WHEN EXISTS (
      SELECT 1 FROM public.payments pay 
      WHERE pay.student_id = p.user_id AND pay.status = 'success'
    ) THEN 'paid'::application_status
    ELSE 'unpaid'::application_status
  END;