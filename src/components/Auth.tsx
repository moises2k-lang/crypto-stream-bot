import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { TrendingUp } from "lucide-react";
import { z } from "zod";

const authSchema = z.object({
  email: z.string()
    .trim()
    .min(1, "El email es requerido")
    .email("Ingresa un email válido")
    .max(255, "El email es demasiado largo"),
  password: z.string()
    .min(6, "La contraseña debe tener al menos 6 caracteres")
    .max(100, "La contraseña es demasiado larga")
});

const RECAPTCHA_SITE_KEY = "6LfzfwcsAAAAAPzLJA1w-USCXdQjz-XEZ8VIC0ck";

declare global {
  interface Window {
    grecaptcha: any;
  }
}

export const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [recaptchaLoaded, setRecaptchaLoaded] = useState(false);
  const recaptchaRef = useRef<number | null>(null);

  useEffect(() => {
    // Load reCAPTCHA script
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js`;
    script.async = true;
    script.defer = true;
    script.onload = () => setRecaptchaLoaded(true);
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    // Render reCAPTCHA when loaded
    if (recaptchaLoaded && window.grecaptcha) {
      setTimeout(() => {
        const container = document.getElementById('recaptcha-container');
        if (container && container.children.length === 0) {
          try {
            recaptchaRef.current = window.grecaptcha.render('recaptcha-container', {
              sitekey: RECAPTCHA_SITE_KEY,
            });
          } catch (e) {
            console.error('Error rendering reCAPTCHA:', e);
          }
        }
      }, 100);
    }
  }, [recaptchaLoaded]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar los datos del formulario
    try {
      authSchema.parse({ email: email.trim(), password });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    // Verify reCAPTCHA for both login and signup
    if (!window.grecaptcha) {
      toast.error("reCAPTCHA no está cargado");
      return;
    }

    const recaptchaToken = window.grecaptcha.getResponse(recaptchaRef.current);
    if (!recaptchaToken) {
      toast.error("Por favor completa el reCAPTCHA");
      return;
    }

    setLoading(true);

    try {
      // Verify reCAPTCHA token with backend
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke(
        'verify-recaptcha',
        { body: { token: recaptchaToken } }
      );

      if (verifyError || !verifyData?.success) {
        toast.error("Verificación de reCAPTCHA fallida");
        window.grecaptcha.reset(recaptchaRef.current);
        setLoading(false);
        return;
      }
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        toast.success("Sesión iniciada correctamente");
        window.grecaptcha.reset(recaptchaRef.current);
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`
          }
        });
        if (error) throw error;
        
        // Create user profile and stats
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('profiles').insert({ user_id: user.id, email: email.trim() });
          await supabase.from('user_stats').insert({ 
            user_id: user.id,
            total_balance: 0,
            today_pnl: 0,
            win_rate: 0
          });
        }
        
        toast.success("Cuenta creada correctamente");
        window.grecaptcha.reset(recaptchaRef.current);
      }
    } catch (error: any) {
      // Manejo de errores más específico
      if (error.message?.includes("already registered")) {
        toast.error("Este email ya está registrado");
      } else if (error.message?.includes("Invalid login credentials")) {
        toast.error("Email o contraseña incorrectos");
      } else {
        toast.error(error.message || "Ocurrió un error");
      }
      
      // Reset reCAPTCHA on error
      if (window.grecaptcha && recaptchaRef.current !== null) {
        window.grecaptcha.reset(recaptchaRef.current);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary/10 p-3 rounded-lg">
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl text-foreground">TradePro</CardTitle>
          <CardDescription className="text-muted-foreground">
            {isLogin ? "Inicia sesión en tu cuenta" : "Crea tu cuenta"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Email</label>
              <Input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background border-border"
              />
            </div>
            
            <div id="recaptcha-container" className="flex justify-center my-4"></div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Contraseña</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-background border-border"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={loading}
            >
              {loading ? "Procesando..." : isLogin ? "Iniciar Sesión" : "Crear Cuenta"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-primary hover:underline"
            >
              {isLogin ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
