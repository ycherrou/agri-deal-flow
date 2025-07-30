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
      {/* Bank Lines Usage Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Utilisation par Ligne Bancaire</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={bankLinesChartData} 
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  domain={[0, 'dataMax']}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="utilise" stackId="a" fill="var(--color-utilise)" />
                <Bar dataKey="disponible" stackId="a" fill="var(--color-disponible)" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Utilization Distribution Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Répartition de l'Utilisation</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={utilizationData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {utilizationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <ChartTooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col">
                              <span className="text-[0.70rem] uppercase text-muted-foreground">
                                Ligne
                              </span>
                              <span className="font-bold text-muted-foreground">
                                {data.name}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[0.70rem] uppercase text-muted-foreground">
                                Montant
                              </span>
                              <span className="font-bold">
                                {data.value.toLocaleString()} USD
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Utilization Rate Horizontal Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Taux d'Utilisation par Ligne</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={bankLinesChartData.sort((a, b) => b.tauxUtilisation - a.tauxUtilisation)}
                layout="horizontal"
                margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
              >
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  tick={{ fontSize: 12 }}
                  width={80}
                />
                <ChartTooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                          <div className="grid grid-cols-1 gap-2">
                            <span className="font-bold">{label}</span>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <span>Taux: {data.tauxUtilisation.toFixed(1)}%</span>
                              <span>Utilisé: {data.utilise.toLocaleString()} USD</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="tauxUtilisation" 
                  fill="hsl(var(--chart-1))"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Timeline of Allocations and Liberations */}
      <Card>
        <CardHeader>
          <CardTitle>Évolution des Mouvements</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="allocations"
                  stackId="1"
                  stroke="var(--color-allocations)"
                  fill="var(--color-allocations)"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="liberations"
                  stackId="2"
                  stroke="var(--color-liberations)"
                  fill="var(--color-liberations)"
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}