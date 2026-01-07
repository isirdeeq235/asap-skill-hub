-- Create a function to check role hierarchy (super_admin > admin > moderator > student)
CREATE OR REPLACE FUNCTION public.get_role_level(_role app_role)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE _role
    WHEN 'super_admin' THEN 4
    WHEN 'admin' THEN 3
    WHEN 'moderator' THEN 2
    WHEN 'student' THEN 1
    ELSE 0
  END
$$;

-- Create a function to get highest role for a user
CREATE OR REPLACE FUNCTION public.get_user_highest_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles 
  WHERE user_id = _user_id 
  ORDER BY public.get_role_level(role) DESC 
  LIMIT 1
$$;

-- Create a function to check if user has role at or above a certain level
CREATE OR REPLACE FUNCTION public.has_role_or_higher(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND public.get_role_level(role) >= public.get_role_level(_role)
  )
$$;

-- Update profiles RLS: Super Admin can delete profiles
CREATE POLICY "Super Admin can delete profiles"
ON public.profiles
FOR DELETE
USING (public.has_role(auth.uid(), 'super_admin'));

-- Update skill_forms RLS: Super Admin can delete forms
CREATE POLICY "Super Admin can delete skill forms"
ON public.skill_forms
FOR DELETE
USING (public.has_role(auth.uid(), 'super_admin'));

-- Update user_roles RLS: Super Admin can manage all roles
CREATE POLICY "Super Admin can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super Admin can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super Admin can update roles"
ON public.user_roles
FOR UPDATE
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super Admin can delete roles"
ON public.user_roles
FOR DELETE
USING (public.has_role(auth.uid(), 'super_admin'));

-- Moderator policies: read access to most things
CREATE POLICY "Moderators can view all profiles"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Moderators can view all forms"
ON public.skill_forms
FOR SELECT
USING (public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Moderators can view all payments"
ON public.payments
FOR SELECT
USING (public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Moderators can view feedback"
ON public.feedback
FOR SELECT
USING (public.has_role(auth.uid(), 'moderator'));