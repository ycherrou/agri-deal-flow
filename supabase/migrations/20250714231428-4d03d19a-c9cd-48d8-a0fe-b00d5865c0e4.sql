-- Create a table for purchase hedging (couvertures d'achat)
CREATE TABLE public.couvertures_achat (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  navire_id UUID NOT NULL,
  date_couverture DATE NOT NULL DEFAULT CURRENT_DATE,
  prix_futures NUMERIC NOT NULL,
  volume_couvert NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.couvertures_achat ENABLE ROW LEVEL SECURITY;

-- Create policies for couvertures_achat
CREATE POLICY "Admins can manage all couvertures_achat" 
ON public.couvertures_achat 
FOR ALL 
USING (get_current_user_role() = 'admin'::user_role);

CREATE POLICY "Authenticated users can view couvertures_achat for navires they can access" 
ON public.couvertures_achat 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Add foreign key constraint
ALTER TABLE public.couvertures_achat 
ADD CONSTRAINT couvertures_achat_navire_id_fkey 
FOREIGN KEY (navire_id) REFERENCES public.navires(id) ON DELETE CASCADE;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_couvertures_achat_updated_at
BEFORE UPDATE ON public.couvertures_achat
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();