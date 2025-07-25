import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Ship, TrendingUp, Users, LogOut, BarChart3, Settings, Shield, User as UserIcon, DollarSign, ShoppingCart, Activity, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
interface LayoutProps {
  children: React.ReactNode;
}
interface ClientData {
  id: string;
  nom: string;
  role: 'admin' | 'client';
  email: string;
}
export default function Layout({
  children
}: LayoutProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingReventes, setPendingReventes] = useState(0);
  const [availableReventes, setAvailableReventes] = useState(0);
  const [pendingOffers, setPendingOffers] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    toast
  } = useToast();
  useEffect(() => {
    // Set up auth state listener
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Fetch client data
        setTimeout(() => {
          fetchClientData(session.user.id);
        }, 0);
      } else {
        setClient(null);
      }
      setLoading(false);
    });

    // Check for existing session
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchClientData(session.user.id);
      } else {
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  const fetchClientData = async (userId: string) => {
    try {
      const {
        data,
        error
      } = await supabase.from('clients').select('id, nom, role, email').eq('user_id', userId).single();
      if (error) {
        console.error('Error fetching client data:', error);
        return;
      }
      setClient(data);

      // Récupérer le nombre de reventes en attente si admin
      if (data.role === 'admin') {
        fetchPendingReventes();
      }

      // Récupérer le nombre de positions disponibles sur le marché secondaire
      fetchAvailableReventes();

      // Récupérer le nombre d'offres reçues pour les clients
      if (data.role === 'client') {
        fetchPendingOffers(data.id);
      }

      // Rediriger les clients vers leur portfolio si ils sont sur la page d'accueil
      if (data.role === 'client' && location.pathname === '/') {
        navigate('/portfolio');
      }
    } catch (error) {
      console.error('Error fetching client data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingReventes = async () => {
    try {
      const { count, error } = await supabase
        .from('reventes_clients')
        .select('*', { count: 'exact', head: true })
        .eq('etat', 'en_attente')
        .eq('validated_by_admin', false);

      if (error) {
        console.error('Error fetching pending reventes count:', error);
        return;
      }

      setPendingReventes(count || 0);
    } catch (error) {
      console.error('Error fetching pending reventes count:', error);
    }
  };

  const fetchAvailableReventes = async () => {
    try {
      // Récupérer l'utilisateur connecté
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Récupérer les données du client connecté
      const { data: currentClient } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!currentClient) return;

      const { count, error } = await supabase
        .from('reventes_clients')
        .select(`
          id,
          ventes!inner(client_id)
        `, { count: 'exact', head: true })
        .eq('etat', 'en_attente')
        .eq('validated_by_admin', true)
        .neq('ventes.client_id', currentClient.id);

      if (error) {
        console.error('Error fetching available reventes count:', error);
        return;
      }

      setAvailableReventes(count || 0);
    } catch (error) {
      console.error('Error fetching available reventes count:', error);
    }
  };

  const fetchPendingOffers = async (clientId: string) => {
    try {
      // Requête en deux étapes pour éviter l'erreur de relation
      const { data: ventes, error: ventesError } = await supabase
        .from('ventes')
        .select('id')
        .eq('client_id', clientId);

      if (ventesError) {
        console.error('Error fetching client ventes:', ventesError);
        return;
      }

      if (!ventes || ventes.length === 0) {
        setPendingOffers(0);
        return;
      }

      const venteIds = ventes.map(v => v.id);

      const { data: reventes, error: reventesError } = await supabase
        .from('reventes_clients')
        .select(`
          id,
          bids_marche_secondaire(id)
        `)
        .in('vente_id', venteIds)
        .eq('etat', 'en_attente')
        .eq('validated_by_admin', true);

      if (reventesError) {
        console.error('Error fetching reventes with bids:', reventesError);
        return;
      }

      // Compter le nombre total d'offres
      const totalOffers = reventes?.reduce((sum, revente) => sum + (revente.bids_marche_secondaire?.length || 0), 0) || 0;
      setPendingOffers(totalOffers);
    } catch (error) {
      console.error('Error fetching pending offers:', error);
    }
  };

  // Configuration des mises à jour temps réel pour les reventes
  useEffect(() => {
    if (!client) return;

    const channel = supabase
      .channel('reventes-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reventes_clients'
        },
        () => {
          // Refetch les counts quand il y a un changement
          if (client.role === 'admin') {
            fetchPendingReventes();
          }
          fetchAvailableReventes();
          if (client.role === 'client') {
            fetchPendingOffers(client.id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bids_marche_secondaire'
        },
        () => {
          // Refetch aussi lors des changements d'offres
          if (client.role === 'client') {
            fetchPendingOffers(client.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [client]);
  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/auth');
      toast({
        title: 'Déconnexion réussie',
        description: 'Vous avez été déconnecté avec succès.'
      });
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: 'Erreur de déconnexion',
        description: 'Une erreur est survenue lors de la déconnexion.',
        variant: 'destructive'
      });
    }
  };
  const navigationItems = [{
    id: 'dashboard',
    label: 'Tableau de bord',
    icon: BarChart3,
    path: '/',
    roles: ['admin']
  }, {
    id: 'portfolio',
    label: 'Mon Portfolio',
    icon: UserIcon,
    path: '/portfolio',
    roles: ['client']
  }, {
    id: 'pnl',
    label: 'P&L',
    icon: DollarSign,
    path: '/pnl',
    roles: ['admin']
  }, {
    id: 'navires',
    label: 'Navires',
    icon: Ship,
    path: '/navires',
    roles: ['admin']
  }, {
    id: 'deals',
    label: 'Deals',
    icon: TrendingUp,
    path: '/deals',
    roles: ['admin']
  }, {
    id: 'settings',
    label: 'Paramètres',
    icon: Settings,
    path: '/settings',
    roles: ['admin'],
    submenu: [
      {
        id: 'whatsapp-notifications',
        label: 'Notifications WhatsApp',
        icon: MessageSquare,
        path: '/whatsapp-notifications',
        roles: ['admin']
      },
      {
        id: 'clients',
        label: 'Clients',
        icon: Users,
        path: '/clients',
        roles: ['admin']
      },
      {
        id: 'prix-marche',
        label: 'Prix marché',
        icon: TrendingUp,
        path: '/prix-marche',
        roles: ['admin']
      }
    ]
  }, {
    id: 'admin-reventes',
    label: 'Validation Reventes',
    icon: Shield,
    path: '/admin-reventes',
    roles: ['admin']
  }, {
    id: 'marche-secondaire',
    label: 'Marché secondaire',
    icon: ShoppingCart,
    path: '/marche-secondaire',
    roles: ['client', 'admin']
  }, {
    id: 'mes-ventes',
    label: 'Mes ventes',
    icon: DollarSign,
    path: '/mes-ventes',
    roles: ['client']
  }, {
    id: 'transactions-secondaires',
    label: 'Offres reçues',
    icon: TrendingUp,
    path: '/transactions-secondaires',
    roles: ['admin', 'client']
  }, {
    id: 'futures-admin',
    label: 'Administration Futures',
    icon: Activity,
    path: '/futures-admin',
    roles: ['admin']
  }];
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>;
  }
  if (!user || !client) {
    return <div className="min-h-screen flex items-center justify-center bg-muted">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-2xl font-bold mb-4">Accès restreint</h2>
            <p className="text-muted-foreground mb-6">
              Vous devez être connecté pour accéder à cette application.
            </p>
            <Button onClick={() => navigate('/auth')} className="w-full">
              Se connecter
            </Button>
          </CardContent>
        </Card>
      </div>;
  }
  const filteredNavItems = navigationItems.filter(item => item.roles.includes(client.role));
  return <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Ship className="h-8 w-8 text-primary" />
                <h1 className="text-xl font-bold text-foreground">Yellowrock</h1>
              </div>
              <Badge variant={client.role === 'admin' ? 'default' : 'secondary'}>
                {client.role === 'admin' ? 'Administrateur' : 'Client'}
              </Badge>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                {client.nom}
              </span>
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground">
                <LogOut className="h-4 w-4 mr-2" />
                Déconnexion
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex space-x-8">
          {/* Sidebar Navigation */}
          <nav className="w-64 flex-shrink-0">
            <div className="space-y-1">
              {filteredNavItems.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              const isSubmenuActive = item.submenu?.some(subItem => location.pathname === subItem.path);
              const showAdminBadge = item.id === 'admin-reventes' && client.role === 'admin' && pendingReventes > 0;
              const showMarketBadge = item.id === 'marche-secondaire' && availableReventes > 0;
              const showOffersBadge = item.id === 'transactions-secondaires' && client.role === 'client' && pendingOffers > 0;
              
              return (
                <div key={item.id}>
                  <Button 
                    variant={isActive || isSubmenuActive ? 'default' : 'ghost'} 
                    className={`w-full justify-start ${isActive || isSubmenuActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`} 
                    onClick={() => navigate(item.path)}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {showAdminBadge && (
                      <Badge variant="destructive" className="ml-2 px-1.5 py-0.5 text-xs font-bold">
                        {pendingReventes}
                      </Badge>
                    )}
                    {showMarketBadge && (
                      <Badge variant="secondary" className="ml-2 px-1.5 py-0.5 text-xs font-bold">
                        {availableReventes}
                      </Badge>
                    )}
                    {showOffersBadge && (
                      <Badge variant="destructive" className="ml-2 px-1.5 py-0.5 text-xs font-bold">
                        {pendingOffers}
                      </Badge>
                    )}
                  </Button>
                  
                  {/* Submenu */}
                  {item.submenu && (isActive || isSubmenuActive) && (
                    <div className="ml-6 mt-1 space-y-1">
                      {item.submenu.filter(subItem => subItem.roles.includes(client.role)).map(subItem => {
                        const SubIcon = subItem.icon;
                        const isSubActive = location.pathname === subItem.path;
                        
                        return (
                          <Button
                            key={subItem.id}
                            variant={isSubActive ? 'secondary' : 'ghost'}
                            size="sm"
                            className={`w-full justify-start ${isSubActive ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            onClick={() => navigate(subItem.path)}
                          >
                            <SubIcon className="h-3 w-3 mr-2" />
                            <span className="text-sm">{subItem.label}</span>
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </div>;
}