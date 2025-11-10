import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useBiometric } from '@/hooks/useBiometric';
import { supabase } from '@/integrations/supabase/client';
import { Fingerprint } from 'lucide-react';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';

export const BiometricLogin = () => {
  const isNative = Capacitor.isNativePlatform();
  const { isAvailable, authenticate } = useBiometric();
  const [hasCredentials, setHasCredentials] = useState(false);

  useEffect(() => {
    checkStoredCredentials();
  }, []);

  const checkStoredCredentials = () => {
    const stored = localStorage.getItem('biometric_enabled');
    setHasCredentials(stored === 'true');
  };

  const handleBiometricLogin = async () => {
    const success = await authenticate();
    if (success) {
      const session = await supabase.auth.getSession();
      if (session.data.session) {
        toast.success('Sesión iniciada con huella digital');
        window.location.href = '/';
      }
    }
  };

  const enableBiometric = async () => {
    const success = await authenticate();
    if (success) {
      localStorage.setItem('biometric_enabled', 'true');
      setHasCredentials(true);
      toast.success('Huella digital configurada');
    }
  };

  // Solo mostrar en app nativa
  if (!isNative || !isAvailable) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fingerprint className="h-5 w-5" />
          Inicio con Huella Digital
        </CardTitle>
        <CardDescription>
          Accede rápidamente con tu huella digital
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasCredentials ? (
          <Button 
            onClick={handleBiometricLogin}
            className="w-full"
            variant="default"
          >
            <Fingerprint className="mr-2 h-4 w-4" />
            Iniciar con Huella
          </Button>
        ) : (
          <Button 
            onClick={enableBiometric}
            className="w-full"
            variant="outline"
          >
            <Fingerprint className="mr-2 h-4 w-4" />
            Activar Huella Digital
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
