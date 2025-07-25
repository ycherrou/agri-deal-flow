import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { useToast } from './ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, RefreshCw, TrendingUp } from 'lucide-react';

interface CBOTUpdateResult {
  success: boolean;
  timestamp: string;
  results: Array<{
    echeance: string;
    symbol: string;
    price: number;
    updated: boolean;
  }>;
  errors: Array<{
    echeance: string;
    symbol: string;
    error: string;
  }>;
  summary: {
    total_echeances: number;
    successful_updates: number;
    failed_updates: number;
  };
}

export const CBOTPriceUpdater = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<CBOTUpdateResult | null>(null);
  const { toast } = useToast();

  const handleUpdatePrices = async () => {
    setIsUpdating(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-cbot-prices');
      
      if (error) {
        throw error;
      }

      const result = data as CBOTUpdateResult;
      setLastUpdate(result);

      if (result.success) {
        toast({
          title: "Prix CBOT mis à jour",
          description: `${result.summary.successful_updates} prix mis à jour avec succès`,
        });
      } else {
        toast({
          title: "Erreur lors de la mise à jour",
          description: "Certains prix n'ont pas pu être mis à jour",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error updating CBOT prices:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour les prix CBOT",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Mise à jour des prix CBOT
        </CardTitle>
        <CardDescription>
          Récupère automatiquement les derniers prix des futures depuis Yahoo Finance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleUpdatePrices} 
          disabled={isUpdating}
          className="w-full"
        >
          {isUpdating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Mise à jour en cours...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Mettre à jour les prix
            </>
          )}
        </Button>

        {lastUpdate && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Dernière mise à jour : {new Date(lastUpdate.timestamp).toLocaleString('fr-FR')}
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="font-semibold text-blue-600">{lastUpdate.summary.total_echeances}</div>
                <div className="text-muted-foreground">Total échéances</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-green-600">{lastUpdate.summary.successful_updates}</div>
                <div className="text-muted-foreground">Succès</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-red-600">{lastUpdate.summary.failed_updates}</div>
                <div className="text-muted-foreground">Échecs</div>
              </div>
            </div>

            {lastUpdate.results.length > 0 && (
              <div className="space-y-2">
                <div className="font-semibold text-sm">Prix mis à jour :</div>
                {lastUpdate.results.map((result, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span>{result.echeance}</span>
                    <span className="font-mono">{result.price.toFixed(2)} cts/bu</span>
                  </div>
                ))}
              </div>
            )}

            {lastUpdate.errors.length > 0 && (
              <div className="space-y-2">
                <div className="font-semibold text-sm text-red-600">Erreurs :</div>
                {lastUpdate.errors.map((error, index) => (
                  <div key={index} className="text-sm text-red-600">
                    {error.echeance}: {error.error}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};