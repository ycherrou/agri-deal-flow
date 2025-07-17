import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatPnL } from '@/lib/pnlUtils';
import { NavirePnLByClient } from '@/lib/pnlUtils';

interface PnLPieChartsProps {
  navires: NavirePnLByClient[];
}

const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const getProductBadge = (produit: string) => {
  const colors = {
    mais: 'bg-yellow-100 text-yellow-800',
    tourteau_soja: 'bg-green-100 text-green-800',
    ble: 'bg-orange-100 text-orange-800',
    orge: 'bg-purple-100 text-purple-800'
  };
  
  const labels = {
    mais: 'Maïs',
    tourteau_soja: 'Tourteau Soja',
    ble: 'Blé',
    orge: 'Orge'
  };

  return (
    <Badge className={colors[produit as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
      {labels[produit as keyof typeof labels] || produit}
    </Badge>
  );
};

const PnLLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percentage, pnl_total }: any) => {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 30; // Position en dehors du camembert
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text 
      x={x} 
      y={y} 
      fill="black" 
      textAnchor={x > cx ? 'start' : 'end'} 
      dominantBaseline="central"
      fontSize={12}
      fontWeight="bold"
    >
      <tspan x={x} dy="0">{percentage.toFixed(1)}%</tspan>
      <tspan x={x} dy="15">{formatPnL(pnl_total)}</tspan>
    </text>
  );
};

const VolumeLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percentage, volume_total }: any) => {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 30; // Position en dehors du camembert
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text 
      x={x} 
      y={y} 
      fill="black" 
      textAnchor={x > cx ? 'start' : 'end'} 
      dominantBaseline="central"
      fontSize={12}
      fontWeight="bold"
    >
      <tspan x={x} dy="0">{percentage.toFixed(1)}%</tspan>
      <tspan x={x} dy="15">{volume_total.toLocaleString('fr-FR')}t</tspan>
    </text>
  );
};

const PnLTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-medium">{data.client_nom}</p>
        <p className="text-sm text-gray-600">
          P&L: <span className="font-bold">{formatPnL(data.pnl_total)}</span>
        </p>
        <p className="text-sm text-gray-600">
          Part: <span className="font-bold">{data.percentage.toFixed(1)}%</span>
        </p>
      </div>
    );
  }
  return null;
};

const VolumeTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-medium">{data.client_nom}</p>
        <p className="text-sm text-gray-600">
          Volume: <span className="font-bold">{data.volume_total.toLocaleString('fr-FR')} tonnes</span>
        </p>
        <p className="text-sm text-gray-600">
          Part: <span className="font-bold">{data.percentage.toFixed(1)}%</span>
        </p>
      </div>
    );
  }
  return null;
};

const PnLPieCharts: React.FC<PnLPieChartsProps> = ({ navires }) => {
  if (!navires || navires.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Aucune donnée disponible pour les graphiques</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">Répartition par client et navire</h2>
      
      {navires.map((navire) => {
        // Données pour le camembert P&L
        const pnlData = navire.clients
          .filter(client => client.pnl_total !== 0)
          .map((client, index) => ({
            ...client,
            percentage: navire.total_pnl !== 0 ? (client.pnl_total / navire.total_pnl) * 100 : 0,
            fill: COLORS[index % COLORS.length]
          }));

        // Données pour le camembert Volume
        const volumeData = navire.clients
          .filter(client => client.volume_total > 0)
          .map((client, index) => ({
            ...client,
            percentage: navire.total_volume !== 0 ? (client.volume_total / navire.total_volume) * 100 : 0,
            fill: COLORS[index % COLORS.length]
          }));

        return (
          <div key={navire.navire_id} className="border rounded-lg p-4 bg-card">
            <div className="flex items-center gap-3 mb-6">
              <h3 className="text-lg font-semibold">{navire.navire_nom}</h3>
              {getProductBadge(navire.produit)}
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Camembert P&L */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Répartition P&L par client</CardTitle>
                  <CardDescription>
                    Total: {formatPnL(navire.total_pnl)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {pnlData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={pnlData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={PnLLabel}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="pnl_total"
                        >
                          {pnlData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip content={<PnLTooltip />} />
                        <Legend 
                          formatter={(value, entry: any) => entry.payload.client_nom}
                          wrapperStyle={{ fontSize: '12px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      Aucune donnée P&L disponible
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Camembert Volume */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Répartition volume par client</CardTitle>
                  <CardDescription>
                    Total: {navire.total_volume.toLocaleString('fr-FR')} tonnes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {volumeData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={volumeData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={VolumeLabel}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="volume_total"
                        >
                          {volumeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip content={<VolumeTooltip />} />
                        <Legend 
                          formatter={(value, entry: any) => entry.payload.client_nom}
                          wrapperStyle={{ fontSize: '12px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      Aucune donnée de volume disponible
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PnLPieCharts;