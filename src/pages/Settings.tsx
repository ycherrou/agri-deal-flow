import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Users, TrendingUp } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();

  const settingsItems = [
    {
      id: 'whatsapp-notifications',
      title: 'Notifications WhatsApp',
      description: 'Gérer les modèles de notifications et les paramètres WhatsApp',
      icon: MessageSquare,
      path: '/whatsapp-notifications'
    },
    {
      id: 'clients',
      title: 'Clients',
      description: 'Gestion des comptes clients et utilisateurs',
      icon: Users,
      path: '/clients'
    },
    {
      id: 'prix-marche',
      title: 'Prix marché',
      description: 'Configuration des prix de marché et échéances',
      icon: TrendingUp,
      path: '/prix-marche'
    }
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Paramètres</h1>
      <p className="text-muted-foreground mb-8">
        Configuration et paramètres de l'application.
      </p>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {settingsItems.map((item) => {
          const Icon = item.icon;
          
          return (
            <Card key={item.id} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Icon className="h-5 w-5 text-primary" />
                  <span>{item.title}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm mb-4">
                  {item.description}
                </p>
                <Button 
                  onClick={() => navigate(item.path)}
                  className="w-full"
                  variant="outline"
                >
                  Accéder
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}