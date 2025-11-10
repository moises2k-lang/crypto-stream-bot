import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Fingerprint, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Credential {
  id: string;
  device_name: string;
  created_at: string;
  last_used_at: string | null;
}

export const WebAuthnSetup = () => {
  const [deviceName, setDeviceName] = useState("");
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [fetchingCredentials, setFetchingCredentials] = useState(true);

  const fetchCredentials = async () => {
    try {
      const { data, error } = await supabase
        .from('webauthn_credentials')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCredentials(data || []);
    } catch (error: any) {
      console.error('Error fetching credentials:', error);
    } finally {
      setFetchingCredentials(false);
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  const handleRegisterBiometric = async () => {
    if (!deviceName.trim()) {
      toast.error("Ingresa un nombre para este dispositivo");
      return;
    }

    // Verificar soporte de WebAuthn
    if (!window.PublicKeyCredential) {
      toast.error("Tu navegador no soporta autenticación biométrica");
      return;
    }

    setLoading(true);

    try {
      // Obtener el token de sesión actual
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No estás autenticado");
      }

      // Iniciar el proceso de registro
      const { data: beginData, error: beginError } = await supabase.functions.invoke(
        'webauthn-register-begin',
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        }
      );

      if (beginError || !beginData?.options) {
        throw new Error("Error al iniciar el registro");
      }

      // Convertir el challenge de base64 a ArrayBuffer
      const challengeArray = Uint8Array.from(
        atob(beginData.options.challenge),
        c => c.charCodeAt(0)
      );

      // Convertir el user.id a ArrayBuffer
      const userId = String(beginData.options.user.id);
      const userIdArray = Uint8Array.from(userId, c => c.charCodeAt(0));

      // Crear la credencial
      const credential = await navigator.credentials.create({
        publicKey: {
          ...beginData.options,
          challenge: challengeArray,
          user: {
            ...beginData.options.user,
            id: userIdArray
          }
        }
      }) as PublicKeyCredential | null;

      if (!credential) {
        throw new Error("Registro cancelado");
      }

      // Completar el registro
      const { data: completeData, error: completeError } = await supabase.functions.invoke(
        'webauthn-register-complete',
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          },
          body: {
            credential: {
              id: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
              response: {
                publicKey: credential.response
              }
            },
            deviceName: deviceName.trim()
          }
        }
      );

      if (completeError || !completeData?.success) {
        throw new Error("Error al completar el registro");
      }

      toast.success("Huella digital registrada correctamente");
      setDeviceName("");
      fetchCredentials();
      
    } catch (error: any) {
      console.error('WebAuthn registration error:', error);
      toast.error(error.message || "Error al registrar huella digital");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCredential = async (id: string) => {
    try {
      const { error } = await supabase
        .from('webauthn_credentials')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success("Credencial eliminada");
      fetchCredentials();
    } catch (error: any) {
      toast.error("Error al eliminar credencial");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-primary" />
            <CardTitle>Autenticación Biométrica</CardTitle>
          </div>
          <CardDescription>
            Configura tu huella digital o Face ID para iniciar sesión rápidamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Nombre del dispositivo</label>
            <Input
              type="text"
              placeholder="Mi iPhone, Mi Laptop, etc."
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              className="bg-background border-border"
            />
          </div>
          <Button
            onClick={handleRegisterBiometric}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={loading}
          >
            <Fingerprint className="mr-2 h-4 w-4" />
            {loading ? "Registrando..." : "Registrar Huella Digital"}
          </Button>
        </CardContent>
      </Card>

      {credentials.length > 0 && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Dispositivos Registrados</CardTitle>
            <CardDescription>
              Gestiona tus dispositivos con autenticación biométrica
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dispositivo</TableHead>
                  <TableHead>Registrado</TableHead>
                  <TableHead>Último uso</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {credentials.map((cred) => (
                  <TableRow key={cred.id}>
                    <TableCell className="font-medium">{cred.device_name}</TableCell>
                    <TableCell>{new Date(cred.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {cred.last_used_at 
                        ? new Date(cred.last_used_at).toLocaleDateString()
                        : 'Nunca'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCredential(cred.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
