import { useState, useEffect } from 'react';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';
import { toast } from 'sonner';

export const useBiometric = () => {
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    checkAvailability();
  }, []);

  const checkAvailability = async () => {
    try {
      const result = await BiometricAuth.checkBiometry();
      setIsAvailable(result.isAvailable);
    } catch (error) {
      console.log('Biometric not available:', error);
      setIsAvailable(false);
    }
  };

  const authenticate = async (): Promise<boolean> => {
    if (!isAvailable) {
      toast.error('Autenticación biométrica no disponible');
      return false;
    }

    try {
      await BiometricAuth.authenticate({
        reason: 'Inicia sesión con tu huella digital',
        cancelTitle: 'Cancelar',
        allowDeviceCredential: true,
        iosFallbackTitle: 'Usar contraseña',
        androidTitle: 'Verificación biométrica',
        androidSubtitle: 'Autenticación requerida',
        androidConfirmationRequired: false,
      });
      
      toast.success('Autenticación exitosa');
      return true;
    } catch (error: any) {
      if (error.code === 'USER_CANCELED') {
        toast.info('Autenticación cancelada');
      } else {
        toast.error('Error en autenticación biométrica');
      }
      return false;
    }
  };

  return {
    isAvailable,
    authenticate,
  };
};
