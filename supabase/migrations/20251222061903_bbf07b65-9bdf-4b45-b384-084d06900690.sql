-- Add access_blocked column to skill_forms table
ALTER TABLE public.skill_forms 
ADD COLUMN access_blocked boolean NOT NULL DEFAULT false;

-- Add RLS policy for admins to update skill forms directly
CREATE POLICY "Admins can update all forms"
ON public.skill_forms
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update the students can update policy to check if access is not blocked
DROP POLICY IF EXISTS "Students can update their forms with approved edit request" ON public.skill_forms;

CREATE POLICY "Students can update their forms with approved edit request"
ON public.skill_forms
FOR UPDATE
USING (
  student_id = auth.uid() 
  AND access_blocked = false
  AND EXISTS (
    SELECT 1 FROM edit_requests 
    WHERE edit_requests.student_id = auth.uid() 
    AND edit_requests.status = 'approved'
  )
);

-- Update the student select policy to check if access is not blocked
DROP POLICY IF EXISTS "Authenticated users can view their own forms" ON public.skill_forms;

CREATE POLICY "Authenticated users can view their own forms"
ON public.skill_forms
FOR SELECT
USING (student_id = auth.uid() AND access_blocked = false);

-- Students can update their own edit_requests (to mark as used)
CREATE POLICY "Students can update their own edit requests"
ON public.edit_requests
FOR UPDATE
USING (student_id = auth.uid());