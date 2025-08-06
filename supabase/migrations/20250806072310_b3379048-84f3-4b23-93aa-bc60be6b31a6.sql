-- Create a function to get secondary market data bypassing RLS
CREATE OR REPLACE FUNCTION public.get_validated_secondary_market()
RETURNS TABLE (
  revente_id uuid,
  volume numeric,
  prix_flat_demande numeric,
  prime_demandee numeric,
  date_revente date,
  vente_id uuid,
  type_position text,
  navire_nom text,
  navire_produit text,
  navire_date_arrivee date,
  vendeur_nom text,
  vendeur_id uuid,
  vente_volume numeric,
  vente_prime_vente numeric,
  vente_prix_reference text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rc.id as revente_id,
    rc.volume,
    rc.prix_flat_demande,
    rc.prime_demandee,
    rc.date_revente,
    rc.vente_id,
    rc.type_position,
    n.nom as navire_nom,
    n.produit::text as navire_produit,
    n.date_arrivee as navire_date_arrivee,
    c.nom as vendeur_nom,
    c.id as vendeur_id,
    v.volume as vente_volume,
    v.prime_vente as vente_prime_vente,
    v.prix_reference as vente_prix_reference
  FROM public.reventes_clients rc
  JOIN public.ventes v ON rc.vente_id = v.id
  JOIN public.navires n ON v.navire_id = n.id
  JOIN public.clients c ON v.client_id = c.id
  WHERE rc.etat = 'en_attente'::revente_status
    AND rc.validated_by_admin = true
  ORDER BY rc.date_revente DESC;
END;
$$;