-- Add nombre_contrats column to couvertures table
ALTER TABLE public.couvertures 
ADD COLUMN nombre_contrats INTEGER NOT NULL DEFAULT 0;

-- Add nombre_contrats column to couvertures_achat table  
ALTER TABLE public.couvertures_achat
ADD COLUMN nombre_contrats INTEGER NOT NULL DEFAULT 0;

-- Create function to get contract size by product
CREATE OR REPLACE FUNCTION public.get_contract_size(produit_type text)
RETURNS numeric AS $$
BEGIN
    CASE produit_type
        WHEN 'mais' THEN RETURN 127;
        WHEN 'tourteau_soja' THEN RETURN 90.10;
        ELSE RETURN 0;
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to update volume_couvert based on nombre_contrats
CREATE OR REPLACE FUNCTION public.update_volume_from_contracts()
RETURNS TRIGGER AS $$
DECLARE
    contract_size numeric;
    navire_produit text;
BEGIN
    -- Get the product type from the related navire
    IF TG_TABLE_NAME = 'couvertures' THEN
        SELECT n.produit INTO navire_produit
        FROM navires n
        JOIN ventes v ON v.navire_id = n.id
        WHERE v.id = NEW.vente_id;
    ELSIF TG_TABLE_NAME = 'couvertures_achat' THEN
        SELECT n.produit INTO navire_produit
        FROM navires n
        WHERE n.id = NEW.navire_id;
    END IF;
    
    -- Calculate volume from contracts
    contract_size := get_contract_size(navire_produit);
    IF contract_size > 0 THEN
        NEW.volume_couvert := NEW.nombre_contrats * contract_size;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update volume_couvert
CREATE TRIGGER update_couvertures_volume_from_contracts
    BEFORE INSERT OR UPDATE ON public.couvertures
    FOR EACH ROW
    EXECUTE FUNCTION public.update_volume_from_contracts();

CREATE TRIGGER update_couvertures_achat_volume_from_contracts
    BEFORE INSERT OR UPDATE ON public.couvertures_achat
    FOR EACH ROW
    EXECUTE FUNCTION public.update_volume_from_contracts();