import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useBiometric } from '@/hooks/useBiometric';
import { useWebAuthn } from '@/hooks/useWebAuthn';
import { supabase } from '@/integrations/supabase/client';
import { Fingerprint } from 'lucide-react';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';

export const BiometricLogin = () => {
  const isNative = Capacitor.isNativePlatform();
  const biometric = useBiometric();
  const webauthn = useWebAuthn();
  
  const [hasCredentials, setHasCredentials] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    checkStoredCredentials();
  }, []);

  const checkStoredCredentials = () => {
    if (isNative) {
      const stored = localStorage.getItem('biometric_enabled');
      setHasCredentials(stored === 'true');
    } else {
      setHasCredentials(webauthn.hasCredential);
      const email = localStorage.getItem('webauthn_email');
      if (email) setUserEmail(email);
    }
  };

  const handleBiometricLogin = async () => {
    if (isNative) {
      const success = await biometric.authenticate();
      if (success) {
        const session = await supabase.auth.getSession();
        if (session.data.session) {
          toast.success('Sesión iniciada con huella digital');
          window.location.href = '/';
        }
      }
    } else {
      const success = await webauthn.authenticate();
      if (success) {
        window.location.href = '/';
      }
    }
  };

  const enableBiometric = async () => {
    if (isNative) {
      const success = await biometric.authenticate();
      if (success) {
        localStorage.setItem('biometric_enabled', 'true');
        setHasCredentials(true);
        toast.success('Huella digital configurada');
      }
    } else {
      // Para WebAuthn, necesitamos el email del usuario
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const success = await webauthn.register(user.email);
        if (success) {
          setHasCredentials(true);
          setUserEmail(user.email);
        }
      } else {
        toast.error('Inicia sesión primero para configurar biometría');
      }
    }
  };

  const isAvailable = isNative ? biometric.isAvailable : webauthn.isAvailable;

  if (!isAvailable) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fingerprint className="h-5 w-5" />
          {isNative ? 'Inicio con Huella Digital' : 'Inicio Biométrico'}
        </CardTitle>
        <CardDescription>
          {isNative 
            ? 'Accede rápidamente con tu huella digital'
            : 'Usa Windows Hello, Face ID, Touch ID o huella'
          }
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
            {isNative ? 'Iniciar con Huella' : 'Iniciar con Biometría'}
          </Button>
        ) : (
          <Button 
            onClick={enableBiometric}
            className="w-full"
            variant="outline"
          >
            <Fingerprint className="mr-2 h-4 w-4" />
            {isNative ? 'Activar Huella Digital' : 'Activar Autenticación Biométrica'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
