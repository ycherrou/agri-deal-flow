-- Create function to update existing transactions with correct PRU calculations
CREATE OR REPLACE FUNCTION public.update_existing_transactions_pru()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  transaction_record record;
  correct_pru numeric;
  new_gain numeric;
BEGIN
  -- Loop through all existing transactions
  FOR transaction_record IN 
    SELECT t.*, r.vente_id 
    FROM transactions_marche_secondaire t
    JOIN reventes_clients r ON t.revente_id = r.id
  LOOP
    -- Calculate the correct PRU using the updated function
    correct_pru := calculate_pru_vente(transaction_record.vente_id);
    
    -- Calculate the new gain: (final_price - correct_original_price) * volume
    new_gain := (transaction_record.prix_vente_final - correct_pru) * transaction_record.volume_transige;
    
    -- Update the transaction with correct values
    UPDATE transactions_marche_secondaire 
    SET 
      prix_achat_original = correct_pru,
      gain_vendeur = new_gain,
      updated_at = now()
    WHERE id = transaction_record.id;
    
    -- Log the update for debugging
    RAISE NOTICE 'Updated transaction % - Old PRU: %, New PRU: %, New Gain: %', 
      transaction_record.id, transaction_record.prix_achat_original, correct_pru, new_gain;
  END LOOP;
END;
$$;

-- Execute the function to update all existing transactions
SELECT public.update_existing_transactions_pru();