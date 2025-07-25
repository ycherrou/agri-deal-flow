-- Ajouter DDGS et Ferrailles au type product_type
ALTER TYPE product_type ADD VALUE 'ddgs';
ALTER TYPE product_type ADD VALUE 'ferrailles';

-- Mettre à jour la fonction get_contract_size pour inclure les nouveaux produits
CREATE OR REPLACE FUNCTION public.get_contract_size(produit_type text)
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
    CASE produit_type::product_type
        WHEN 'mais' THEN RETURN 127;
        WHEN 'tourteau_soja' THEN RETURN 90.10;
        WHEN 'ble' THEN RETURN 50;
        WHEN 'orge' THEN RETURN 50;
        WHEN 'ddgs' THEN RETURN 100;  -- Taille de contrat pour DDGS
        WHEN 'ferrailles' THEN RETURN 50;  -- Taille de contrat pour Ferrailles
        ELSE RETURN 0;
    END CASE;
END;
$function$