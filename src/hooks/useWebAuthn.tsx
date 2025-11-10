import { useState, useEffect } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useWebAuthn = () => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [hasCredential, setHasCredential] = useState(false);

  useEffect(() => {
    checkAvailability();
    checkCredentials();
  }, []);

  const checkAvailability = () => {
    const available = window.PublicKeyCredential !== undefined &&
                     typeof window.PublicKeyCredential === 'function';
    setIsAvailable(available);
  };

  const checkCredentials = async () => {
    const storedEmail = localStorage.getItem('webauthn_email');
    const storedCredId = localStorage.getItem('webauthn_credential_id');
    setHasCredential(!!(storedEmail && storedCredId));
  };

  const register = async (email: string) => {
    if (!isAvailable) {
      toast.error('Tu navegador no soporta autenticación biométrica');
      return false;
    }

    try {
      const publicKeyOptions = {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: {
          name: 'TradePro',
          id: window.location.hostname,
        },
        user: {
          id: crypto.getRandomValues(new Uint8Array(32)),
          name: email,
          displayName: email,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' as const },
          { alg: -257, type: 'public-key' as const },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform' as const,
          userVerification: 'required' as const,
        },
        timeout: 60000,
        attestation: 'none' as const,
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyOptions,
      });

      if (!credential) {
        throw new Error('No se pudo crear la credencial');
      }

      // Guardar en backend
      const { error } = await supabase.functions.invoke('webauthn-register', {
        body: { credential },
      });

      if (error) throw error;

      // Guardar localmente
      localStorage.setItem('webauthn_email', email);
      localStorage.setItem('webauthn_credential_id', (credential as any).id);
      
      setHasCredential(true);
      toast.success('Autenticación biométrica configurada');
      return true;
    } catch (error: any) {
      console.error('Registration error:', error);
      if (error.name === 'NotAllowedError') {
        toast.error('Operación cancelada');
      } else {
        toast.error('Error al configurar autenticación biométrica');
      }
      return false;
    }
  };

  const authenticate = async () => {
    if (!isAvailable || !hasCredential) {
      return false;
    }

    try {
      const email = localStorage.getItem('webauthn_email');
      const credentialId = localStorage.getItem('webauthn_credential_id');

      if (!email || !credentialId) {
        throw new Error('No hay credenciales guardadas');
      }

      const publicKeyOptions = {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{
          id: Uint8Array.from(atob(credentialId), c => c.charCodeAt(0)),
          type: 'public-key' as const,
        }],
        userVerification: 'required' as const,
        timeout: 60000,
      };

      const assertion = await navigator.credentials.get({
        publicKey: publicKeyOptions,
      });

      if (!assertion) {
        throw new Error('Autenticación fallida');
      }

      // Autenticar con backend
      const { data, error } = await supabase.functions.invoke('webauthn-authenticate', {
        body: { 
          email,
          credentialId: (assertion as any).id,
        },
      });

      if (error) throw error;

      // Establecer sesión
      if (data?.access_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.access_token,
        });

        if (sessionError) throw sessionError;
        
        toast.success('Sesión iniciada con biometría');
        return true;
      }

      return false;
    } catch (error: any) {
      console.error('Authentication error:', error);
      if (error.name === 'NotAllowedError') {
        toast.error('Operación cancelada');
      } else {
        toast.error('Error en autenticación biométrica');
      }
      return false;
    }
  };

  return {
    isAvailable,
    hasCredential,
    register,
    authenticate,
  };
};
