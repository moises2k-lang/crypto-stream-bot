import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, CreditCard, Loader2, Calendar, Crown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const PLANS = [
  {
    id: "7days",
    name: "Plan 7 Días",
    priceId: "price_1SRinVAn8V0sVnA7PtWgc5GW",
    productId: "prod_TOVpuiX0D5QuhR",
    price: 15,
    duration: "7 días",
    features: [
      "Acceso al grupo de Telegram",
      "Señales de trading en tiempo real",
      "Soporte básico",
      "7 días de acceso completo"
    ]
  },
  {
    id: "15days",
    name: "Plan 15 Días",
    priceId: "price_1SRinoAn8V0sVnA7Dc24tn6L",
    productId: "prod_TOVpzKS5bQnKtI",
    price: 25,
    duration: "15 días",
    features: [
      "Acceso al grupo de Telegram",
      "Señales de trading en tiempo real",
      "Soporte prioritario",
      "15 días de acceso completo",
      "Análisis de mercado semanal"
    ]
  },
  {
    id: "30days",
    name: "Plan 30 Días",
    priceId: "price_1SRinsAn8V0sVnA7yfpCCTLn",
    productId: "prod_TOVplu7gT6u9cz",
    price: 50,
    duration: "30 días",
    popular: true,
    features: [
      "Acceso al grupo de Telegram",
      "Señales de trading en tiempo real",
      "Soporte prioritario 24/7",
      "30 días de acceso completo",
      "Análisis de mercado semanal",
      "Consultas personalizadas",
      "Mejor precio por día"
    ]
  }
];

const Subscriptions = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkAuth();
    
    // Check for success or cancel params
    if (searchParams.get('success')) {
      toast.success("¡Suscripción activada! Tu acceso al grupo está activo.");
      // Clear the URL params
      window.history.replaceState({}, '', '/subscriptions');
    } else if (searchParams.get('canceled')) {
      toast.error("Pago cancelado. Puedes intentarlo nuevamente cuando quieras.");
      window.history.replaceState({}, '', '/subscriptions');
    }
  }, [searchParams]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/');
      return;
    }
    setUser(user);
    await checkSubscription();
  };

  const checkSubscription = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;
      setSubscription(data);
    } catch (error: any) {
      console.error('Error checking subscription:', error);
      toast.error("Error al verificar suscripción");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (priceId: string, planId: string) => {
    setCheckoutLoading(planId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Debes iniciar sesión primero");
        navigate('/');
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      console.error('Error creating checkout:', error);
      toast.error("Error al crear checkout: " + error.message);
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      console.error('Error opening customer portal:', error);
      toast.error("Error al abrir portal de cliente");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Planes de Suscripción</h1>
          <p className="text-muted-foreground">
            Elige el plan que mejor se adapte a tus necesidades de trading
          </p>
        </div>

        {subscription?.subscribed && (
          <Card className="mb-8 border-primary/50 bg-primary/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" />
                  <CardTitle>Suscripción Activa</CardTitle>
                </div>
                <Badge variant="default">Activo</Badge>
              </div>
              <CardDescription>
                Plan actual: <strong>{subscription.plan_name}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <Calendar className="h-4 w-4" />
                <span>
                  Renovación: {format(new Date(subscription.subscription_end), "d 'de' MMMM, yyyy", { locale: es })}
                </span>
              </div>
              <Button onClick={handleManageSubscription} variant="outline">
                <CreditCard className="h-4 w-4 mr-2" />
                Administrar Suscripción
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const isCurrentPlan = subscription?.product_id === plan.productId;
            
            return (
              <Card 
                key={plan.id}
                className={`relative ${plan.popular ? 'border-primary shadow-lg' : ''} ${isCurrentPlan ? 'border-primary/50 bg-primary/5' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">
                      Más Popular
                    </Badge>
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="absolute -top-3 right-4">
                    <Badge variant="default">
                      Tu Plan
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground"> / {plan.duration}</span>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Button
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    disabled={isCurrentPlan || checkoutLoading === plan.id}
                    onClick={() => handleCheckout(plan.priceId, plan.id)}
                  >
                    {checkoutLoading === plan.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Procesando...
                      </>
                    ) : isCurrentPlan ? (
                      "Plan Actual"
                    ) : (
                      "Suscribirse"
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Preguntas Frecuentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-1">¿Cómo funciona la suscripción?</h3>
              <p className="text-sm text-muted-foreground">
                Al suscribirte, obtienes acceso inmediato al grupo de Telegram y todas las señales de trading durante el período seleccionado.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">¿Puedo cancelar en cualquier momento?</h3>
              <p className="text-sm text-muted-foreground">
                Sí, puedes cancelar tu suscripción en cualquier momento desde el portal de administración. Tendrás acceso hasta el final del período pagado.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">¿Qué incluye el acceso al grupo?</h3>
              <p className="text-sm text-muted-foreground">
                Recibirás señales de trading en tiempo real, análisis de mercado, y soporte directo de nuestro equipo de expertos.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Subscriptions;
