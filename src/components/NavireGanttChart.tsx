import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format, differenceInDays, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';

interface NavireGanttData {
  navire_id: string;
  navire_nom: string;
  produit: string;
  date_arrivee: string;
  volume_total: number;
  fournisseur: string;
}

interface NavireGanttChartProps {
  navires: NavireGanttData[];
  onNavireClick?: (navireId: string) => void;
}

interface GanttItem {
  name: string;
  start: number;
  duration: number;
  volume: number;
  produit: string;
  navire_id: string;
  date_arrivee: string;
  fournisseur: string;
}

export default function NavireGanttChart({ navires, onNavireClick }: NavireGanttChartProps) {
  const { ganttData, dateRange, tickCount } = useMemo(() => {
    console.log('NavireGanttChart - Input navires:', navires);
    
    if (navires.length === 0) return { ganttData: [], dateRange: { start: new Date(), end: new Date() }, tickCount: 0 };

    // Filtre les navires avec des dates valides
    const validNavires = navires.filter(n => {
      const date = new Date(n.date_arrivee);
      const isValid = !isNaN(date.getTime()) && n.date_arrivee;
      if (!isValid) {
        console.log('Invalid navire date:', n);
      }
      return isValid;
    });

    console.log('Valid navires after filtering:', validNavires);

    if (validNavires.length === 0) return { ganttData: [], dateRange: { start: new Date(), end: new Date() }, tickCount: 0 };

    // Trouve les dates min et max
    const dates = validNavires.map(n => new Date(n.date_arrivee));
    const validDates = dates.filter(d => !isNaN(d.getTime()));
    
    console.log('Valid dates:', validDates);
    
    if (validDates.length === 0) return { ganttData: [], dateRange: { start: new Date(), end: new Date() }, tickCount: 0 };
    
    const minDate = new Date(Math.min(...validDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...validDates.map(d => d.getTime())));
    
    console.log('Min date:', minDate, 'Max date:', maxDate);
    
    // Ajoute une marge de 30 jours avant et après
    const startDate = addDays(minDate, -30);
    const endDate = addDays(maxDate, 30);
    
    console.log('Start date:', startDate, 'End date:', endDate);
    
    // Calcule le nombre de jours total pour déterminer l'échelle
    const totalDays = differenceInDays(endDate, startDate);
    console.log('Total days:', totalDays);
    
    const ganttItems: GanttItem[] = validNavires.map(navire => {
      const arrivalDate = new Date(navire.date_arrivee);
      const daysSinceStart = differenceInDays(arrivalDate, startDate);
      
      console.log(`Processing navire ${navire.navire_nom}: arrival=${arrivalDate}, daysSinceStart=${daysSinceStart}`);
      
      return {
        name: navire.navire_nom || 'Navire sans nom',
        start: Math.max(0, daysSinceStart), // Assure que start n'est pas négatif
        duration: 7, // 7 jours de fenêtre d'arrivée
        volume: navire.volume_total || 0,
        produit: navire.produit || 'inconnu',
        navire_id: navire.navire_id,
        date_arrivee: navire.date_arrivee,
        fournisseur: navire.fournisseur || 'Inconnu',
      };
    }).filter(item => {
      const isValid = !isNaN(item.start) && item.start >= 0;
      if (!isValid) {
        console.log('Invalid gantt item:', item);
      }
      return isValid;
    });

    console.log('Final gantt data:', ganttItems);
    console.log('Final date range:', { start: startDate, end: endDate });
    console.log('Final tick count:', Math.min(10, Math.max(1, Math.ceil(totalDays / 30))));

    return {
      ganttData: ganttItems,
      dateRange: { start: startDate, end: endDate },
      tickCount: Math.min(10, Math.max(1, Math.ceil(totalDays / 30))),
    };
  }, [navires]);

  const getProductColor = (produit: string) => {
    const colors = {
      mais: 'hsl(var(--warning))',
      tourteau_soja: 'hsl(var(--success))',
      ble: 'hsl(var(--secondary))',
      orge: 'hsl(142 76% 56%)',
      ddgs: 'hsl(var(--primary))',
      ferrailles: 'hsl(var(--muted-foreground))',
    };
    return colors[produit as keyof typeof colors] || 'hsl(var(--muted-foreground))';
  };

  const formatTick = (tickItem: number) => {
    const date = addDays(dateRange.start, tickItem);
    return format(date, 'MMM yy', { locale: fr });
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-card-foreground">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            Produit: <span className="font-medium">{data.produit}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Volume: <span className="font-medium">{data.volume.toLocaleString()} tonnes</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Arrivée: <span className="font-medium">{format(new Date(data.date_arrivee), 'dd MMM yyyy', { locale: fr })}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Fournisseur: <span className="font-medium">{data.fournisseur}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  if (ganttData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        Aucun navire à afficher
      </div>
    );
  }

  // Calcule le domain de l'axe X de manière sécurisée
  const xAxisDomain = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return [0, 100];
    const totalDays = differenceInDays(dateRange.end, dateRange.start);
    const safeDomain = isNaN(totalDays) || totalDays <= 0 ? 100 : totalDays;
    console.log('XAxis domain calculation - totalDays:', totalDays, 'safeDomain:', safeDomain);
    return [0, safeDomain];
  }, [dateRange]);

  return (
    <div className="space-y-4">
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={ganttData}
            layout="horizontal"
            margin={{ top: 20, right: 30, left: 80, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              type="number"
              domain={xAxisDomain}
              tickFormatter={formatTick}
              tickCount={tickCount}
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis 
              type="category"
              dataKey="name"
              width={70}
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="duration"
              fill="hsl(var(--primary))"
              radius={[0, 4, 4, 0]}
              onClick={(data) => onNavireClick?.(data.navire_id)}
              style={{ cursor: onNavireClick ? 'pointer' : 'default' }}
            >
              {ganttData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getProductColor(entry.produit)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Légende */}
      <div className="flex flex-wrap gap-4 justify-center">
        {Array.from(new Set(navires.map(n => n.produit))).map(produit => (
          <div key={produit} className="flex items-center gap-2">
            <div 
              className="w-4 h-4 rounded"
              style={{ backgroundColor: getProductColor(produit) }}
            />
            <span className="text-sm text-muted-foreground capitalize">
              {produit.replace('_', ' ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}