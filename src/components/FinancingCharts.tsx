import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart } from "recharts";
import { LigneBancaire } from "@/types";

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

// Helper function to ensure valid numbers
const safeNumber = (value: any, fallback: number = 0): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

export default function FinancingCharts() {
  // Fetch bank lines with detailed usage
  const { data: bankLinesData = [] } = useQuery({
    queryKey: ['bank-lines-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lignes_bancaires')
        .select('*')
        .eq('active', true)
        .order('nom');
      
      if (error) throw error;
      return data as LigneBancaire[];
    }
  });

  // Fetch financing movements over time
  const { data: movementsData = [] } = useQuery({
    queryKey: ['movements-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mouvements_bancaires')
        .select(`
          *,
          ligne_bancaire:lignes_bancaires(nom, banque)
        `)
        .order('date_mouvement', { ascending: true })
        .limit(50);
      
      if (error) throw error;
      return data;
    }
  });

  // Prepare data for charts with comprehensive validation
  const bankLinesChartData = bankLinesData
    .filter(ligne => ligne && ligne.nom) // Filter out invalid entries
    .map(ligne => {
      const total = safeNumber(ligne.montant_total);
      const utilise = safeNumber(ligne.montant_utilise);
      const disponible = safeNumber(ligne.montant_disponible);
      const tauxUtilisation = total > 0 ? (utilise / total) * 100 : 0;
      
      // Debug logging
      console.log('Bank line data:', {
        nom: ligne.nom,
        total,
        utilise,
        disponible,
        tauxUtilisation
      });
      
      return {
        name: ligne.nom || 'N/A',
        banque: ligne.banque || 'N/A',
        total,
        utilise,
        disponible,
        tauxUtilisation: safeNumber(tauxUtilisation)
      };
    })
    .filter(item => safeNumber(item.total) > 0); // Only include lines with valid totals

  const utilizationData = bankLinesChartData
    .filter(item => safeNumber(item.utilise) > 0) // Only include lines with actual usage
    .map((item, index) => ({
      name: item.name,
      value: safeNumber(item.utilise),
      color: COLORS[index % COLORS.length]
    }));

  const timelineData = movementsData
    .filter(movement => movement && movement.date_mouvement && movement.type_mouvement) // Filter out invalid movements
    .filter(movement => safeNumber(movement.montant) > 0) // Filter out invalid amounts
    .reduce((acc: any[], movement: any) => {
      const date = new Date(movement.date_mouvement).toLocaleDateString();
      const existing = acc.find(item => item.date === date);
      const montant = safeNumber(movement.montant);
      
      if (existing) {
        if (movement.type_mouvement === 'allocation') {
          existing.allocations = safeNumber(existing.allocations) + montant;
        } else if (movement.type_mouvement === 'liberation') {
          existing.liberations = safeNumber(existing.liberations) + montant;
        }
      } else {
        acc.push({
          date,
          allocations: movement.type_mouvement === 'allocation' ? montant : 0,
          liberations: movement.type_mouvement === 'liberation' ? montant : 0
        });
      }
      
      return acc;
    }, [])
    .slice(-30) // Last 30 data points
    .map(item => ({
      ...item,
      allocations: safeNumber(item.allocations),
      liberations: safeNumber(item.liberations)
    })); // Ensure all values are safe numbers

  console.log('Chart data prepared:', {
    bankLinesCount: bankLinesChartData.length,
    utilizationCount: utilizationData.length,
    timelineCount: timelineData.length,
    bankLinesData: bankLinesChartData,
    utilizationData,
    timelineData
  });

  const chartConfig = {
    utilise: {
      label: "Utilisé",
      color: "hsl(var(--chart-1))",
    },
    disponible: {
      label: "Disponible", 
      color: "hsl(var(--chart-2))",
    },
    allocations: {
      label: "Allocations",
      color: "hsl(var(--chart-3))",
    },
    liberations: {
      label: "Libérations",
      color: "hsl(var(--chart-4))",
    }
  };

  // Add comprehensive safety checks for empty data
  if (!bankLinesData || bankLinesData.length === 0 || bankLinesChartData.length === 0) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardContent className="flex items-center justify-center h-80">
            <p className="text-muted-foreground">Aucune donnée disponible pour les graphiques</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-center h-80">
            <p className="text-muted-foreground">Aucune donnée disponible pour les graphiques</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Simple Bank Lines Overview - No Charts for Now */}
      <Card>
        <CardHeader>
          <CardTitle>Utilisation par Ligne Bancaire</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {bankLinesChartData.map((ligne, index) => (
              <div key={ligne.name} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{ligne.name}</p>
                  <p className="text-sm text-muted-foreground">{ligne.banque}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{ligne.tauxUtilisation.toFixed(1)}%</p>
                  <p className="text-sm text-muted-foreground">
                    {ligne.utilise.toLocaleString()} / {ligne.total.toLocaleString()} USD
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Simple Distribution Display */}
      <Card>
        <CardHeader>
          <CardTitle>Répartition de l'Utilisation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {utilizationData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-medium">{item.name}</span>
                </div>
                <span className="font-bold">{item.value.toLocaleString()} USD</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Utilization Rates */}
      <Card>
        <CardHeader>
          <CardTitle>Taux d'Utilisation par Ligne</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {bankLinesChartData
              .sort((a, b) => b.tauxUtilisation - a.tauxUtilisation)
              .map((ligne) => (
                <div key={ligne.name} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{ligne.name}</span>
                    <span className="font-medium">{ligne.tauxUtilisation.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(ligne.tauxUtilisation, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Timeline Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Résumé des Mouvements</CardTitle>
        </CardHeader>
        <CardContent>
          {timelineData.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {timelineData.reduce((sum, d) => sum + d.allocations, 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-green-600">Total Allocations (USD)</p>
                </div>
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {timelineData.reduce((sum, d) => sum + d.liberations, 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-blue-600">Total Libérations (USD)</p>
                </div>
              </div>
              <div className="text-center text-sm text-muted-foreground">
                Données basées sur les {timelineData.length} derniers mouvements
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground">Aucun mouvement récent</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}