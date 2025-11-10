-- Crear tabla para almacenar las credenciales WebAuthn (passkeys/huella digital)
CREATE TABLE IF NOT EXISTS public.webauthn_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  device_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE
);

-- Habilitar RLS
ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para webauthn_credentials
CREATE POLICY "Los usuarios pueden ver sus propias credenciales"
  ON public.webauthn_credentials
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden crear sus propias credenciales"
  ON public.webauthn_credentials
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar sus propias credenciales"
  ON public.webauthn_credentials
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden eliminar sus propias credenciales"
  ON public.webauthn_credentials
  FOR DELETE
  USING (auth.uid() = user_id);

-- Índice para búsquedas rápidas
CREATE INDEX idx_webauthn_credentials_user_id ON public.webauthn_credentials(user_id);
CREATE INDEX idx_webauthn_credentials_credential_id ON public.webauthn_credentials(credential_id);