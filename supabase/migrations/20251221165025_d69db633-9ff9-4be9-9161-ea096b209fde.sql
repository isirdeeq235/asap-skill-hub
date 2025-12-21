-- Create edit_requests table to track student requests for form edits
CREATE TABLE public.edit_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key constraint to profiles
ALTER TABLE public.edit_requests
ADD CONSTRAINT edit_requests_student_id_fkey
FOREIGN KEY (student_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Enable Row Level Security
ALTER TABLE public.edit_requests ENABLE ROW LEVEL SECURITY;

-- Students can view their own edit requests
CREATE POLICY "Students can view their own edit requests"
ON public.edit_requests
FOR SELECT
USING (student_id = auth.uid());

-- Students can create their own edit requests
CREATE POLICY "Students can insert their own edit requests"
ON public.edit_requests
FOR INSERT
WITH CHECK (student_id = auth.uid());

-- Admins can view all edit requests
CREATE POLICY "Admins can view all edit requests"
ON public.edit_requests
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update edit requests (approve/reject)
CREATE POLICY "Admins can update edit requests"
ON public.edit_requests
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete edit requests
CREATE POLICY "Admins can delete edit requests"
ON public.edit_requests
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_edit_requests_updated_at
BEFORE UPDATE ON public.edit_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add policy to allow students to update their skill_forms when they have an approved edit request
CREATE POLICY "Students can update their forms with approved edit request"
ON public.skill_forms
FOR UPDATE
USING (
  student_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM public.edit_requests 
    WHERE edit_requests.student_id = auth.uid() 
    AND edit_requests.status = 'approved'
  )
);