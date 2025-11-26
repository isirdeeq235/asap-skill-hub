-- Strengthen RLS policies to explicitly require authentication
-- This prevents any potential anonymous access

-- Drop existing policies and recreate with explicit authenticated checks

-- PROFILES TABLE
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

CREATE POLICY "Authenticated users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- PAYMENTS TABLE
DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can insert their own payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can view all payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can update all payments" ON public.payments;

CREATE POLICY "Authenticated users can view their own payments"
ON public.payments
FOR SELECT
TO authenticated
USING (student_id = auth.uid());

CREATE POLICY "Authenticated users can insert their own payments"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Admins can view all payments"
ON public.payments
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all payments"
ON public.payments
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- SKILL FORMS TABLE
DROP POLICY IF EXISTS "Users can view their own forms" ON public.skill_forms;
DROP POLICY IF EXISTS "Users can insert their own forms" ON public.skill_forms;
DROP POLICY IF EXISTS "Admins can view all forms" ON public.skill_forms;

CREATE POLICY "Authenticated users can view their own forms"
ON public.skill_forms
FOR SELECT
TO authenticated
USING (student_id = auth.uid());

CREATE POLICY "Authenticated users can insert their own forms"
ON public.skill_forms
FOR INSERT
TO authenticated
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Admins can view all forms"
ON public.skill_forms
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- USER ROLES TABLE
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Authenticated users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- APP SETTINGS TABLE - Restrict to authenticated users only
DROP POLICY IF EXISTS "Anyone can view settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can insert settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON public.app_settings;

CREATE POLICY "Authenticated users can view settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert settings"
ON public.app_settings
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update settings"
ON public.app_settings
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));