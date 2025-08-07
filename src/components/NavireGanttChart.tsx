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

interface GanttItem {
  name: string;
  startGap: number;
  duration: number;
  volume: number;
  produit: string;
  navire_id: string;
  date_debut_planche: string;
  date_fin_planche: string;
  fournisseur: string;
}

export default function NavireGanttChart({ navires, onNavireClick }: NavireGanttChartProps) {
  const { ganttData, dateRange, tickCount } = useMemo(() => {
    console.log('=== GANTT CHART DEBUGGING ===');
    console.log('Input navires:', navires);
    console.log('Navires length:', navires.length);
    
    if (navires.length === 0) {
      console.log('No navires provided, returning empty data');
      return { ganttData: [], dateRange: { start: new Date(), end: new Date() }, tickCount: 0 };
    }

    // Log each navire's date fields in detail
    navires.forEach((navire, index) => {
      console.log(`Navire ${index}:`, {
        id: navire.navire_id,
        nom: navire.navire_nom,
        date_debut_planche: navire.date_debut_planche,
        date_fin_planche: navire.date_fin_planche,
        volume_total: navire.volume_total,
        date_debut_valid: navire.date_debut_planche && !isNaN(new Date(navire.date_debut_planche).getTime()),
        date_fin_valid: navire.date_fin_planche && !isNaN(new Date(navire.date_fin_planche).getTime())
      });
    });

    // Filtre les navires avec des dates valides
    const validNavires = navires.filter(n => {
      const dateDebut = new Date(n.date_debut_planche);
      const dateFin = new Date(n.date_fin_planche);
      const isValidDebut = !isNaN(dateDebut.getTime()) && n.date_debut_planche;
      const isValidFin = !isNaN(dateFin.getTime()) && n.date_fin_planche;
      const isValid = isValidDebut && isValidFin;
      
      if (!isValid) {
        console.log('INVALID navire found:', {
          navire: n,
          dateDebut: dateDebut.toString(),
          dateFin: dateFin.toString(),
          isValidDebut,
          isValidFin
        });
      }
      return isValid;
    });

    console.log('Valid navires after filtering:', validNavires.length);

    if (validNavires.length === 0) {
      console.log('No valid navires after filtering, returning empty data');
      return { ganttData: [], dateRange: { start: new Date(), end: new Date() }, tickCount: 0 };
    }

    // Calcule la plage de dates en utilisant les dates de début et fin de planche
    const allDates = validNavires.flatMap(n => [
      new Date(n.date_debut_planche),
      new Date(n.date_fin_planche)
    ]);
    const validDates = allDates.filter(d => !isNaN(d.getTime()));
    
    console.log('All dates extracted:', allDates.map(d => d.toString()));
    console.log('Valid dates:', validDates.map(d => d.toString()));
    
    if (validDates.length === 0) {
      console.log('No valid dates found, returning empty data');
      return { ganttData: [], dateRange: { start: new Date(), end: new Date() }, tickCount: 0 };
    }
    
    const minDate = new Date(Math.min(...validDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...validDates.map(d => d.getTime())));
    
    console.log('Date range calculation:', {
      minDate: minDate.toString(),
      maxDate: maxDate.toString(),
      minTime: minDate.getTime(),
      maxTime: maxDate.getTime()
    });
    
    // Ajoute une marge de 30 jours avant et après
    const startDate = addDays(minDate, -30);
    const endDate = addDays(maxDate, 30);
    
    console.log('Final date range:', {
      startDate: startDate.toString(),
      endDate: endDate.toString()
    });
    
    // Calcule le nombre de jours total pour déterminer l'échelle
    const totalDays = differenceInDays(endDate, startDate);
    console.log('Total days calculation:', totalDays);
    
    if (isNaN(totalDays) || totalDays <= 0) {
      console.error('INVALID TOTAL DAYS:', totalDays);
      return { ganttData: [], dateRange: { start: new Date(), end: new Date() }, tickCount: 1 };
    }
    
    const ganttItems: GanttItem[] = validNavires.map((navire, index) => {
      const dateDebut = new Date(navire.date_debut_planche);
      const dateFin = new Date(navire.date_fin_planche);
      const daysSinceStart = differenceInDays(dateDebut, startDate);
      const duration = differenceInDays(dateFin, dateDebut) + 1; // +1 to include both start and end days
      
      console.log(`Processing navire ${index} (${navire.navire_nom}):`, {
        dateDebut: dateDebut.toString(),
        dateFin: dateFin.toString(),
        daysSinceStart,
        duration,
        volume_total: navire.volume_total,
        startDate: startDate.toString()
      });
      
      // Validate all calculations
      if (isNaN(daysSinceStart)) {
        console.error('NaN daysSinceStart for navire:', navire);
      }
      if (isNaN(duration)) {
        console.error('NaN duration for navire:', navire);
      }
      if (isNaN(navire.volume_total)) {
        console.error('NaN volume_total for navire:', navire);
      }
      
      const startPos = Math.max(0, Math.round(daysSinceStart || 0));
      const durationValue = Math.max(1, Math.round(duration || 1));
      
      return {
        name: navire.navire_nom || 'Navire sans nom',
        startGap: startPos, // Invisible bar to position the actual bar
        duration: durationValue, // Visible bar
        volume: Math.max(0, Math.round(navire.volume_total || 0)),
        produit: navire.produit || 'inconnu',
        navire_id: navire.navire_id,
        date_debut_planche: navire.date_debut_planche,
        date_fin_planche: navire.date_fin_planche,
        fournisseur: navire.fournisseur || 'Inconnu',
      };
    }).filter(item => {
      // More stringent validation
      const isValidStartGap = typeof item.startGap === 'number' && !isNaN(item.startGap) && isFinite(item.startGap) && item.startGap >= 0;
      const isValidDuration = typeof item.duration === 'number' && !isNaN(item.duration) && isFinite(item.duration) && item.duration > 0;
      const isValidVolume = typeof item.volume === 'number' && !isNaN(item.volume) && isFinite(item.volume) && item.volume >= 0;
      const isValid = isValidStartGap && isValidDuration && isValidVolume;
      
      if (!isValid) {
        console.error('INVALID gantt item detected:', {
          item,
          isValidStartGap,
          isValidDuration,
          isValidVolume
        });
      }
      return isValid;
    });

    console.log('Final gantt data:', ganttItems);
    console.log('Final date range:', { start: startDate, end: endDate });
    
    const finalTickCount = Math.min(10, Math.max(1, Math.ceil(totalDays / 30)));
    console.log('Final tick count:', finalTickCount);

    return {
      ganttData: ganttItems,
      dateRange: { start: startDate, end: endDate },
      tickCount: finalTickCount,
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

  if (ganttData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        Aucun navire à afficher
      </div>
    );
  }

  // Calcule le domain de l'axe X de manière sécurisée
  const xAxisDomain = useMemo(() => {
    console.log('=== X-AXIS DOMAIN CALCULATION ===');
    console.log('Date range:', dateRange);
    
    if (!dateRange.start || !dateRange.end) {
      console.log('Missing date range, using default domain [0, 100]');
      return [0, 100];
    }
    
    const totalDays = differenceInDays(dateRange.end, dateRange.start);
    console.log('Total days for X-axis:', totalDays);
    
    if (isNaN(totalDays) || totalDays <= 0 || !isFinite(totalDays)) {
      console.error('INVALID totalDays for X-axis:', totalDays);
      return [0, 100];
    }
    
    const safeDomain = [0, Math.round(totalDays)];
    console.log('Final X-axis domain:', safeDomain);
    return safeDomain;
  }, [dateRange]);

  // Additional safety check before rendering
  if (ganttData.length === 0) {
    console.log('No gantt data to render');
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        Aucun navire à afficher
      </div>
    );
  }

  // Validate all gantt data before rendering
  const hasInvalidData = ganttData.some(item => 
    isNaN(item.startGap) || isNaN(item.duration) || isNaN(item.volume) || 
    item.startGap < 0 || item.duration <= 0
  );

  if (hasInvalidData) {
    console.error('Invalid data detected in gantt items, preventing render');
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        Erreur dans les données du graphique
      </div>
    );
  }

  console.log('=== RENDERING GANTT CHART ===');
  console.log('Gantt data to render:', ganttData);
  console.log('X-axis domain:', xAxisDomain);
  console.log('Tick count:', tickCount);

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
              tickFormatter={(value) => {
                try {
                  const tickValue = Number(value);
                  if (!isFinite(tickValue) || isNaN(tickValue)) {
                    console.warn('Invalid tick value:', value);
                    return '';
                  }
                  return formatTick(tickValue);
                } catch (error) {
                  console.error('Error formatting tick:', error, value);
                  return '';
                }
              }}
              tickCount={Math.max(1, Math.min(10, tickCount))}
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
            {/* Invisible bar for positioning */}
            <Bar 
              dataKey="startGap"
              fill="transparent"
              stackId="gantt"
            />
            {/* Visible bar for duration */}
            <Bar 
              dataKey="duration"
              fill="hsl(var(--primary))"
              radius={[0, 4, 4, 0]}
              stackId="gantt"
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