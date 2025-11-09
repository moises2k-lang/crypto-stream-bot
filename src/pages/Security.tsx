import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, ShieldCheck, QrCode, Key } from "lucide-react";

const Security = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [showMFASetup, setShowMFASetup] = useState(false);
  const [mfaQRCode, setMfaQRCode] = useState("");
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);

  useEffect(() => {
    checkAuth();
    checkMFAStatus();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/');
      return;
    }
  };

  const checkMFAStatus = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;

      const hasTOTP = data?.totp?.length > 0;
      setMfaEnabled(hasTOTP);
    } catch (error: any) {
      console.error('Error checking MFA status:', error);
      toast.error("Error al verificar estado de 2FA");
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollMFA = async () => {
    setSetupLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
      });

      if (error) throw error;

      setMfaQRCode(data.totp.qr_code);
      setMfaSecret(data.totp.secret);
      setShowMFASetup(true);
      toast.success("Escanea el código QR con Google Authenticator");
    } catch (error: any) {
      console.error('Error enrolling MFA:', error);
      toast.error(error.message || "Error al configurar 2FA");
    } finally {
      setSetupLoading(false);
    }
  };

  const handleVerifyMFASetup = async () => {
    if (!mfaCode || mfaCode.length !== 6) {
      toast.error("Ingresa el código de 6 dígitos");
      return;
    }

    setSetupLoading(true);
    try {
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) throw factors.error;

      const totpFactor = factors.data?.totp?.[0];
      if (!totpFactor) throw new Error("Factor TOTP no encontrado");

      const challenge = await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
      if (challenge.error) throw challenge.error;

      const verify = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.data.id,
        code: mfaCode,
      });

      if (verify.error) throw verify.error;

      toast.success("2FA configurado exitosamente");
      setShowMFASetup(false);
      setMfaCode("");
      setMfaQRCode("");
      setMfaSecret("");
      checkMFAStatus();
    } catch (error: any) {
      console.error('Error verifying MFA:', error);
      toast.error(error.message || "Código incorrecto");
    } finally {
      setSetupLoading(false);
    }
  };

  const handleDisableMFA = async () => {
    if (!confirm("¿Estás seguro de que deseas desactivar 2FA? Esto reducirá la seguridad de tu cuenta.")) {
      return;
    }

    setSetupLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;

      const totpFactor = data?.totp?.[0];
      if (!totpFactor) throw new Error("No hay factor TOTP para desactivar");

      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId: totpFactor.id,
      });

      if (unenrollError) throw unenrollError;

      toast.success("2FA desactivado correctamente");
      checkMFAStatus();
    } catch (error: any) {
      console.error('Error disabling MFA:', error);
      toast.error(error.message || "Error al desactivar 2FA");
    } finally {
      setSetupLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <CardTitle>Configuración de Seguridad</CardTitle>
            </div>
            <CardDescription>
              Gestiona la autenticación de dos factores y la seguridad de tu cuenta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* MFA Status Section */}
            <div className="border rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg ${mfaEnabled ? 'bg-success/10' : 'bg-muted'}`}>
                    {mfaEnabled ? (
                      <ShieldCheck className="h-6 w-6 text-success" />
                    ) : (
                      <Shield className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Autenticación de Dos Factores (2FA)</h3>
                    <p className="text-sm text-muted-foreground">
                      Agrega una capa extra de seguridad a tu cuenta
                    </p>
                  </div>
                </div>
                <Badge variant={mfaEnabled ? "default" : "secondary"}>
                  {mfaEnabled ? "Activado" : "Desactivado"}
                </Badge>
              </div>

              {!mfaEnabled && !showMFASetup && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    La autenticación de dos factores agrega una capa adicional de seguridad a tu cuenta. 
                    Necesitarás ingresar un código de Google Authenticator además de tu contraseña.
                  </p>
                  <Button 
                    onClick={handleEnrollMFA} 
                    disabled={setupLoading}
                    className="w-full sm:w-auto"
                  >
                    <QrCode className="h-4 w-4 mr-2" />
                    Activar 2FA
                  </Button>
                </div>
              )}

              {!mfaEnabled && showMFASetup && (
                <div className="space-y-4">
                  <div className="bg-background border rounded-lg p-4">
                    <h4 className="font-medium mb-2">1. Escanea el código QR</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Abre Google Authenticator y escanea este código QR
                    </p>
                    {mfaQRCode && (
                      <div className="flex justify-center bg-white p-4 rounded-lg">
                        <img src={mfaQRCode} alt="QR Code" className="w-48 h-48" />
                      </div>
                    )}
                  </div>

                  <div className="bg-background border rounded-lg p-4">
                    <h4 className="font-medium mb-2">2. Código secreto (alternativo)</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Si no puedes escanear el QR, ingresa este código manualmente:
                    </p>
                    <div className="bg-muted p-3 rounded font-mono text-sm break-all">
                      {mfaSecret}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="mfaCode">3. Ingresa el código de verificación</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        id="mfaCode"
                        type="text"
                        placeholder="000000"
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                        className="font-mono text-center text-lg tracking-widest"
                      />
                      <Button 
                        onClick={handleVerifyMFASetup} 
                        disabled={setupLoading || mfaCode.length !== 6}
                      >
                        Verificar
                      </Button>
                    </div>
                  </div>

                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowMFASetup(false);
                      setMfaCode("");
                      setMfaQRCode("");
                      setMfaSecret("");
                    }}
                    className="w-full sm:w-auto"
                  >
                    Cancelar
                  </Button>
                </div>
              )}

              {mfaEnabled && (
                <div className="space-y-4">
                  <div className="bg-success/10 border border-success/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-success mb-2">
                      <ShieldCheck className="h-5 w-5" />
                      <span className="font-medium">2FA está activo</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Tu cuenta está protegida con autenticación de dos factores. 
                      Se te pedirá un código de Google Authenticator cada vez que inicies sesión desde un nuevo dispositivo.
                    </p>
                  </div>
                  <Button 
                    variant="destructive" 
                    onClick={handleDisableMFA}
                    disabled={setupLoading}
                  >
                    <Key className="h-4 w-4 mr-2" />
                    Desactivar 2FA
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Security;
