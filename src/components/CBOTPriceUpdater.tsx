import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, RefreshCw, TrendingUp, Play, Pause, Clock } from 'lucide-react';

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
  const [isAutoUpdating, setIsAutoUpdating] = useState(false);
  const [updateInterval, setUpdateInterval] = useState<number>(30); // minutes
  const [timeRemaining, setTimeRemaining] = useState<number>(0); // seconds
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Restaurer l'état depuis localStorage au montage
    const savedAutoUpdate = localStorage.getItem('cbot-auto-update');
    const savedInterval = localStorage.getItem('cbot-update-interval');
    const savedLastUpdate = localStorage.getItem('cbot-last-update-time');
    
    if (savedAutoUpdate === 'true' && savedInterval) {
      const interval = parseInt(savedInterval);
      setUpdateInterval(interval);
      setIsAutoUpdating(true);
      
      // Calculer le temps écoulé depuis la dernière mise à jour
      if (savedLastUpdate) {
        const lastUpdateTime = parseInt(savedLastUpdate);
        const now = Date.now();
        const elapsed = Math.floor((now - lastUpdateTime) / 1000); // en secondes
        const intervalInSeconds = interval * 60;
        
        if (elapsed >= intervalInSeconds) {
          // Il est temps de faire une mise à jour
          handleUpdatePrices();
          startTimer();
        } else {
          // Démarrer le timer avec le temps restant
          const remaining = intervalInSeconds - elapsed;
          setTimeRemaining(remaining);
          startTimerWithRemaining(remaining);
        }
        
        // Démarrer l'intervalle normal
        intervalRef.current = setInterval(() => {
          handleUpdatePrices();
          startTimer();
        }, interval * 60 * 1000);
      } else {
        // Pas de dernière mise à jour enregistrée, démarrer normalement
        startTimer();
        intervalRef.current = setInterval(() => {
          handleUpdatePrices();
          startTimer();
        }, interval * 60 * 1000);
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const handleUpdatePrices = async () => {
    setIsUpdating(true);
    
    // Enregistrer le timestamp de la mise à jour
    localStorage.setItem('cbot-last-update-time', Date.now().toString());
    
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

  const startTimer = () => {
    setTimeRemaining(updateInterval * 60); // Convert minutes to seconds
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          return updateInterval * 60; // Reset timer
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startTimerWithRemaining = (remaining: number) => {
    setTimeRemaining(remaining);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          return updateInterval * 60; // Reset timer
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimeRemaining(0);
  };

  const startAutoUpdate = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    setIsAutoUpdating(true);
    startTimer(); // Start the countdown timer
    
    // Sauvegarder l'état dans localStorage
    localStorage.setItem('cbot-auto-update', 'true');
    localStorage.setItem('cbot-update-interval', updateInterval.toString());
    localStorage.setItem('cbot-last-update-time', Date.now().toString());
    
    intervalRef.current = setInterval(() => {
      handleUpdatePrices();
      startTimer(); // Restart timer after each update
    }, updateInterval * 60 * 1000); // Convert minutes to milliseconds
    
    toast({
      title: "Mise à jour automatique activée",
      description: `Les prix seront mis à jour toutes les ${updateInterval} minutes`,
    });
  };

  const stopAutoUpdate = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsAutoUpdating(false);
    stopTimer(); // Stop the countdown timer
    
    // Supprimer l'état de localStorage
    localStorage.removeItem('cbot-auto-update');
    localStorage.removeItem('cbot-update-interval');
    localStorage.removeItem('cbot-last-update-time');
    
    toast({
      title: "Mise à jour automatique désactivée",
      description: "Les prix ne seront plus mis à jour automatiquement",
    });
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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

        <div className="space-y-3 border-t pt-4">
          <div className="font-semibold text-sm">Mise à jour automatique</div>
          
          <div className="flex items-center gap-3">
            <Select value={updateInterval.toString()} onValueChange={(value) => setUpdateInterval(Number(value))}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 minutes</SelectItem>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 heure</SelectItem>
                <SelectItem value="120">2 heures</SelectItem>
                <SelectItem value="360">6 heures</SelectItem>
              </SelectContent>
            </Select>
            
            {!isAutoUpdating ? (
              <Button onClick={startAutoUpdate} variant="outline" size="sm">
                <Play className="mr-2 h-4 w-4" />
                Démarrer
              </Button>
            ) : (
              <Button onClick={stopAutoUpdate} variant="outline" size="sm">
                <Pause className="mr-2 h-4 w-4" />
                Arrêter
              </Button>
            )}
          </div>
          
          {isAutoUpdating && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                ✅ Mise à jour automatique active - Intervalle: {updateInterval} minutes
              </div>
              <div className="flex items-center gap-2 text-sm font-mono bg-muted p-2 rounded">
                <Clock className="h-4 w-4" />
                Prochaine mise à jour dans: {formatTime(timeRemaining)}
              </div>
            </div>
          )}
        </div>

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