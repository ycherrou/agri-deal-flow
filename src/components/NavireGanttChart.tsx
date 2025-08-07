import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
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
  id: string;
  name: string;
  produit: string;
  volume: number;
  fournisseur: string;
  dateDebut: string;
  dateFin: string;
  dateDebutFormatted: string;
  dateFinFormatted: string;
}

export default function NavireGanttChart({ navires, onNavireClick }: NavireGanttChartProps) {
  const ganttData = useMemo(() => {
    if (navires.length === 0) {
      return [];
    }

    return navires
      .filter(n => n.date_debut_planche && n.date_fin_planche)
      .map((navire) => ({
        id: navire.navire_id,
        name: navire.navire_nom || 'Navire sans nom',
        produit: navire.produit || 'inconnu',
        volume: navire.volume_total || 0,
        fournisseur: navire.fournisseur || 'Inconnu',
        dateDebut: navire.date_debut_planche,
        dateFin: navire.date_fin_planche,
        dateDebutFormatted: format(parseISO(navire.date_debut_planche), 'dd MMM yyyy', { locale: fr }),
        dateFinFormatted: format(parseISO(navire.date_fin_planche), 'dd MMM yyyy', { locale: fr }),
      }));
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

  if (ganttData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        Aucun navire à afficher
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Simple timeline view */}
      <div className="space-y-3">
        {ganttData.map((item) => (
          <div 
            key={item.id}
            className="group p-4 bg-card border border-border rounded-lg hover:shadow-md transition-all cursor-pointer"
            onClick={() => onNavireClick?.(item.id)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div 
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: getProductColor(item.produit) }}
                />
                <h3 className="font-semibold text-card-foreground">{item.name}</h3>
                <span className="text-sm text-muted-foreground capitalize">
                  {item.produit.replace('_', ' ')}
                </span>
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                {item.volume.toLocaleString()} tonnes
              </span>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Début: <span className="font-medium">{item.dateDebutFormatted}</span></span>
              <span>Fin: <span className="font-medium">{item.dateFinFormatted}</span></span>
              <span>Fournisseur: <span className="font-medium">{item.fournisseur}</span></span>
            </div>
            
            {/* Visual timeline bar */}
            <div className="mt-3 relative">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-300 group-hover:opacity-80"
                  style={{ 
                    backgroundColor: getProductColor(item.produit),
                    width: '100%'
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Légende */}
      <div className="flex flex-wrap gap-4 justify-center pt-4 border-t border-border">
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