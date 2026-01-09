-- 1. Create content_blocks table for CMS
CREATE TABLE public.content_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'rich_text', 'markdown', 'html', 'json')),
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.content_blocks ENABLE ROW LEVEL SECURITY;

-- Everyone can read content blocks (for frontend rendering)
CREATE POLICY "Anyone can view content blocks"
ON public.content_blocks FOR SELECT
USING (true);

-- Only Super Admin can manage content blocks
CREATE POLICY "Super Admin can insert content blocks"
ON public.content_blocks FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super Admin can update content blocks"
ON public.content_blocks FOR UPDATE
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super Admin can delete content blocks"
ON public.content_blocks FOR DELETE
USING (public.has_role(auth.uid(), 'super_admin'));

-- 2. Create available_skills table for dynamic skill management
CREATE TABLE public.available_skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.available_skills ENABLE ROW LEVEL SECURITY;

-- Everyone can read active skills
CREATE POLICY "Anyone can view active skills"
ON public.available_skills FOR SELECT
USING (is_active = true OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Only Super Admin can manage skills
CREATE POLICY "Super Admin can insert skills"
ON public.available_skills FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super Admin can update skills"
ON public.available_skills FOR UPDATE
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super Admin can delete skills"
ON public.available_skills FOR DELETE
USING (public.has_role(auth.uid(), 'super_admin'));

-- 3. Add account_locked and banned columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS account_locked BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS banned BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS banned_reason TEXT,
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS locked_by UUID;

-- 4. Insert default system feature toggles into app_settings
INSERT INTO public.app_settings (key, value, description) VALUES
  ('registration_open', 'true', 'Controls whether new student registration is allowed'),
  ('payment_enabled', 'true', 'Controls whether payment processing is enabled'),
  ('id_generation_enabled', 'true', 'Controls whether students can generate ID cards'),
  ('edit_requests_enabled', 'true', 'Controls whether students can request form edits'),
  ('maintenance_mode', 'false', 'When true, system is in read-only mode'),
  ('system_frozen', 'false', 'Emergency freeze - disables all operations')
ON CONFLICT (key) DO NOTHING;

-- 5. Insert default content blocks
INSERT INTO public.content_blocks (key, value, type, description) VALUES
  ('home_hero_title', 'Welcome to ATAPOLY Skills Registration', 'text', 'Main hero title on home page'),
  ('home_hero_subtitle', 'Register for skills acquisition program', 'text', 'Hero subtitle on home page'),
  ('home_about_title', 'About the Program', 'text', 'About section title'),
  ('home_about_content', 'Our skills acquisition program helps students develop practical skills for the modern workforce.', 'rich_text', 'About section content'),
  ('home_cta_text', 'Start Registration', 'text', 'Call to action button text'),
  ('announcement_banner', '', 'text', 'Global announcement banner (empty = hidden)'),
  ('contact_email', 'support@atapoly.edu.ng', 'text', 'Contact email address'),
  ('contact_phone', '+234 123 456 7890', 'text', 'Contact phone number'),
  ('footer_text', '© 2025 ATAPOLY Skills Registration. All rights reserved.', 'text', 'Footer copyright text'),
  ('maintenance_message', 'System is under maintenance. Please try again later.', 'text', 'Message shown during maintenance mode')
ON CONFLICT (key) DO NOTHING;

-- 6. Insert default skills
INSERT INTO public.available_skills (name, description, display_order) VALUES
  ('Web Development', 'Learn to build modern web applications', 1),
  ('Mobile App Development', 'Create iOS and Android applications', 2),
  ('Data Science', 'Analyze data and build machine learning models', 3),
  ('Digital Marketing', 'Master online marketing strategies', 4),
  ('Graphic Design', 'Create stunning visual designs', 5),
  ('Cybersecurity', 'Protect systems and data from threats', 6),
  ('Cloud Computing', 'Work with cloud platforms and services', 7),
  ('UI/UX Design', 'Design user-friendly interfaces', 8)
ON CONFLICT (name) DO NOTHING;

-- 7. Create trigger for updated_at on new tables
CREATE TRIGGER update_content_blocks_updated_at
BEFORE UPDATE ON public.content_blocks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_available_skills_updated_at
BEFORE UPDATE ON public.available_skills
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();