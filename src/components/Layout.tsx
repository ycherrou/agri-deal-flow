import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Ship, TrendingUp, Users, LogOut, BarChart3, Settings } from 'lucide-react';
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

export default function Layout({ children }: LayoutProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
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
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
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
      const { data, error } = await supabase
        .from('clients')
        .select('id, nom, role, email')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching client data:', error);
        return;
      }

      setClient(data);
    } catch (error) {
      console.error('Error fetching client data:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const navigationItems = [
    { 
      id: 'dashboard', 
      label: 'Tableau de bord', 
      icon: BarChart3,
      path: '/',
      roles: ['admin', 'client']
    },
    { 
      id: 'navires', 
      label: 'Navires', 
      icon: Ship,
      path: '/navires',
      roles: ['admin']
    },
    { 
      id: 'deals', 
      label: 'Deals', 
      icon: TrendingUp,
      path: '/deals',
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
      id: 'settings', 
      label: 'Paramètres', 
      icon: Settings,
      path: '/settings',
      roles: ['admin']
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
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
      </div>
    );
  }

  const filteredNavItems = navigationItems.filter(item => 
    item.roles.includes(client.role)
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Ship className="h-8 w-8 text-primary" />
                <h1 className="text-xl font-bold text-foreground">
                  AgriTrade
                </h1>
              </div>
              <Badge variant={client.role === 'admin' ? 'default' : 'secondary'}>
                {client.role === 'admin' ? 'Administrateur' : 'Client'}
              </Badge>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                {client.nom}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-muted-foreground hover:text-foreground"
              >
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
              {filteredNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                
                return (
                  <Button
                    key={item.id}
                    variant={isActive ? 'default' : 'ghost'}
                    className={`w-full justify-start ${
                      isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => navigate(item.path)}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </Button>
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
    </div>
  );
}