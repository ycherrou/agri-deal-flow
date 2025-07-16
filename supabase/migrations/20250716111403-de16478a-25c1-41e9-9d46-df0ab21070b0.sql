-- Add parent_navire_id field to navires table for traceability
ALTER TABLE public.navires 
ADD COLUMN parent_navire_id UUID;

-- Add foreign key constraint
ALTER TABLE public.navires 
ADD CONSTRAINT navires_parent_navire_id_fkey 
FOREIGN KEY (parent_navire_id) REFERENCES public.navires(id) ON DELETE SET NULL;