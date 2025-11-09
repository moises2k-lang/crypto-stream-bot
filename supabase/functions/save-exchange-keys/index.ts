import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function toBase64(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary);
}

function fromString(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const passphraseBytes = new TextEncoder().encode(passphrase);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passphraseBytes as unknown as BufferSource,
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: (salt as unknown as BufferSource), iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encrypt(value: string, passphrase: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    (fromString(value).buffer as ArrayBuffer),
  );
  return {
    ciphertext: toBase64(ciphertext),
    iv: toBase64(iv.buffer),
    salt: toBase64(salt.buffer),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const ENCRYPTION_KEY = Deno.env.get("EXCHANGE_ENCRYPTION_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Server not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ENCRYPTION_KEY) {
      return new Response(JSON.stringify({ error: "Missing encryption key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const exchange: string = body.exchange;
    const apiKey: string = body.apiKey;
    const apiSecret: string = body.apiSecret;

    if (!exchange || !apiKey || !apiSecret) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowed = ["Binance", "Bybit"];
    if (!allowed.includes(exchange)) {
      return new Response(JSON.stringify({ error: "Exchange inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Encrypt values
    const apiKeyEnc = await encrypt(apiKey, ENCRYPTION_KEY);
    const apiSecretEnc = await encrypt(apiSecret, ENCRYPTION_KEY);

    // Store credentials (upsert)
    const { error: credError } = await supabase
      .from("exchange_credentials")
      .upsert({
        user_id: user.id,
        exchange_name: exchange,
        api_key_ciphertext: apiKeyEnc.ciphertext,
        api_key_iv: apiKeyEnc.iv,
        api_secret_ciphertext: apiSecretEnc.ciphertext,
        api_secret_iv: apiSecretEnc.iv,
        salt: apiKeyEnc.salt,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,exchange_name' });

    if (credError) {
      return new Response(JSON.stringify({ error: credError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark connection as active
    const { error: connError } = await supabase
      .from("exchange_connections")
      .upsert({
        user_id: user.id,
        exchange_name: exchange,
        is_connected: true,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,exchange_name' });

    if (connError) {
      return new Response(JSON.stringify({ error: connError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = (e as any)?.message ?? "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
