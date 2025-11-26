-- Make passport-photos bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'passport-photos';