import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Fingerprint } from "lucide-react";

interface WebAuthnLoginProps {
  onSuccess?: () => void;
}

export const WebAuthnLogin = ({ onSuccess }: WebAuthnLoginProps) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleBiometricLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error("Ingresa tu email");
      return;
    }

    // Verificar soporte de WebAuthn
    if (!window.PublicKeyCredential) {
      toast.error("Tu navegador no soporta autenticación biométrica");
      return;
    }

    setLoading(true);

    try {
      // Obtener opciones de autenticación
      const { data: beginData, error: beginError } = await supabase.functions.invoke(
        'webauthn-authenticate-begin',
        { body: { email: email.trim() } }
      );

      if (beginError || !beginData?.options) {
        throw new Error(beginData?.error || "Error al iniciar autenticación");
      }

      // Convertir el challenge de base64 a ArrayBuffer
      const challengeArray = Uint8Array.from(
        atob(beginData.options.challenge),
        c => c.charCodeAt(0)
      );

      // Convertir los credential IDs
      const allowCredentials = beginData.options.allowCredentials.map((cred: any) => ({
        ...cred,
        id: Uint8Array.from(atob(cred.id), c => c.charCodeAt(0))
      }));

      // Solicitar autenticación biométrica
      const credential = await navigator.credentials.get({
        publicKey: {
          ...beginData.options,
          challenge: challengeArray,
          allowCredentials,
        }
      }) as PublicKeyCredential | null;

      if (!credential) {
        throw new Error("Autenticación cancelada");
      }

      // Completar la autenticación
      const { data: completeData, error: completeError } = await supabase.functions.invoke(
        'webauthn-authenticate-complete',
        {
          body: {
            credential: {
              id: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
              response: credential.response
            },
            userId: beginData.userId
          }
        }
      );

      if (completeError || !completeData?.success) {
        throw new Error(completeData?.error || "Error al completar autenticación");
      }

      toast.success("Inicio de sesión exitoso con huella digital");
      onSuccess?.();
      
    } catch (error: any) {
      console.error('WebAuthn error:', error);
      if (error.message.includes("No hay credenciales registradas")) {
        toast.error("No tienes una huella digital registrada. Configúrala desde la página de Seguridad después de iniciar sesión.");
      } else {
        toast.error(error.message || "Error al autenticar con huella digital");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full border-border bg-card/50">
      <CardHeader className="text-center pb-3">
        <div className="flex justify-center mb-2">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Fingerprint className="h-6 w-6 text-primary" />
          </div>
        </div>
        <CardTitle className="text-lg text-foreground">Login con Huella Digital</CardTitle>
        <CardDescription className="text-muted-foreground text-sm">
          Autenticación rápida y segura
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleBiometricLogin} className="space-y-3">
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
          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={loading}
          >
            <Fingerprint className="mr-2 h-4 w-4" />
            {loading ? "Autenticando..." : "Usar Huella Digital"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
