import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format, differenceInDays, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';

interface NavireGanttData {
  navire_id: string;
  navire_nom: string;
  produit: string;
  date_debut_planche: string;
  date_fin_planche: string;
  volume_total: number;
  fournisseur: string;
}

interface NavireGanttChartProps {
  navires: NavireGanttData[];
  onNavireClick?: (navireId: string) => void;
}

interface TimelineItem {
  name: string;
  duration: number;
  position: number;
  volume: number;
  produit: string;
  navire_id: string;
  date_debut_planche: string;
  date_fin_planche: string;
  fournisseur: string;
}

export default function NavireGanttChart({ navires, onNavireClick }: NavireGanttChartProps) {
  const { timelineData, minPosition, maxPosition } = useMemo(() => {
    console.log('=== GANTT CHART DEBUGGING ===');
    console.log('Input navires:', navires);
    
    if (navires.length === 0) {
      console.log('No navires provided, returning empty data');
      return { timelineData: [], minPosition: 0, maxPosition: 100 };
    }

    // Filter valid navires
    const validNavires = navires.filter(n => {
      const dateDebut = new Date(n.date_debut_planche);
      const dateFin = new Date(n.date_fin_planche);
      const isValid = !isNaN(dateDebut.getTime()) && !isNaN(dateFin.getTime()) && 
                      n.date_debut_planche && n.date_fin_planche;
      
      if (!isValid) {
        console.log('Invalid navire found:', n);
      }
      return isValid;
    });

    console.log('Valid navires after filtering:', validNavires.length);

    if (validNavires.length === 0) {
      return { timelineData: [], minPosition: 0, maxPosition: 100 };
    }

    // Find the overall date range
    const allDates = validNavires.flatMap(n => [
      new Date(n.date_debut_planche),
      new Date(n.date_fin_planche)
    ]);
    
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    
    console.log('Date range:', { minDate, maxDate });
    
    // Create timeline items with relative positioning
    const items: TimelineItem[] = validNavires.map((navire, index) => {
      const dateDebut = new Date(navire.date_debut_planche);
      const dateFin = new Date(navire.date_fin_planche);
      
      // Calculate position as days from minDate
      const position = differenceInDays(dateDebut, minDate);
      const duration = differenceInDays(dateFin, dateDebut) + 1;
      
      console.log(`Processing ${navire.navire_nom}: position=${position}, duration=${duration}`);
      
      return {
        name: navire.navire_nom || 'Navire sans nom',
        duration: Math.max(1, duration),
        position: Math.max(0, position),
        volume: Math.max(0, navire.volume_total || 0),
        produit: navire.produit || 'inconnu',
        navire_id: navire.navire_id,
        date_debut_planche: navire.date_debut_planche,
        date_fin_planche: navire.date_fin_planche,
        fournisseur: navire.fournisseur || 'Inconnu',
      };
    }).filter(item => {
      const isValid = typeof item.position === 'number' && 
                      typeof item.duration === 'number' && 
                      !isNaN(item.position) && !isNaN(item.duration) && 
                      isFinite(item.position) && isFinite(item.duration);
      
      if (!isValid) {
        console.error('Invalid timeline item:', item);
      }
      return isValid;
    });

    const totalRange = differenceInDays(maxDate, minDate) + 30; // Add margin
    
    console.log('Final timeline data:', items);
    console.log('Timeline range:', { min: 0, max: totalRange });

    return {
      timelineData: items,
      minPosition: 0,
      maxPosition: Math.max(100, totalRange)
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
            Début: <span className="font-medium">{format(new Date(data.date_debut_planche), 'dd MMM yyyy', { locale: fr })}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Fin: <span className="font-medium">{format(new Date(data.date_fin_planche), 'dd MMM yyyy', { locale: fr })}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Fournisseur: <span className="font-medium">{data.fournisseur}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  if (timelineData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        Aucun navire à afficher
      </div>
    );
  }

  console.log('=== RENDERING SIMPLE TIMELINE ===');
  console.log('Timeline data to render:', timelineData);
  console.log('Domain:', [minPosition, maxPosition]);

  return (
    <div className="space-y-4">
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={timelineData}
            layout="horizontal"
            margin={{ top: 20, right: 30, left: 80, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              type="number"
              domain={[minPosition, maxPosition]}
              tickFormatter={(value) => {
                // Simple tick formatting without date conversion for now
                return `${Math.round(value)}j`;
              }}
              stroke="hsl(var(--muted-foreground))"
              allowDecimals={false}
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
              {timelineData.map((entry, index) => (
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