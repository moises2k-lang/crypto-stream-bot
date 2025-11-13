import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BiometricLogin } from "@/components/BiometricLogin";
import { toast } from "sonner";
import { TrendingUp, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { useTranslation } from "react-i18next";


const RECAPTCHA_SITE_KEY = "6LfzfwcsAAAAAPzLJA1w-USCXdQjz-XEZ8VIC0ck";

declare global {
  interface Window {
    grecaptcha: any;
  }
}

export const Auth = () => {
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [recaptchaLoaded, setRecaptchaLoaded] = useState(false);
  const [showMFAVerify, setShowMFAVerify] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const recaptchaRef = useRef<number | null>(null);

  const authSchema = z.object({
    email: z.string()
      .trim()
      .min(1, t('auth.errors.emailRequired'))
      .email(t('auth.errors.emailInvalid'))
      .max(255, t('auth.errors.emailTooLong')),
    password: z.string()
      .min(6, t('auth.errors.passwordMin'))
      .max(100, t('auth.errors.passwordTooLong'))
  });

  const loadRecaptcha = () => {
    if (recaptchaLoaded || document.querySelector(`script[src*="google.com/recaptcha"]`)) {
      return;
    }
    
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;
    script.onload = () => setRecaptchaLoaded(true);
    document.body.appendChild(script);
  };

  // Only load reCAPTCHA when user starts interacting with form
  const handleFormInteraction = () => {
    loadRecaptcha();
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      z.string().email().parse(email.trim());
    } catch (error) {
      toast.error(t('auth.errors.emailValidation'));
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/`,
      });
      
      if (error) throw error;
      toast.success(t('auth.messages.resetEmailSent'));
      setIsResetPassword(false);
    } catch (error: any) {
      toast.error(error.message || t('auth.errors.resetError'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMFALogin = async () => {
    if (!mfaCode || mfaCode.length !== 6) {
      toast.error(t('auth.errors.codeRequired'));
      return;
    }

    setLoading(true);
    try {
      const { data: mfaData } = await supabase.auth.mfa.listFactors();
      const totpFactor = mfaData?.totp?.[0];

      if (!totpFactor) {
        toast.error(t('auth.errors.noMfaConfig'));
        return;
      }

      const challenge = await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
      if (challenge.error) throw challenge.error;

      const verify = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.data.id,
        code: mfaCode
      });

      if (verify.error) throw verify.error;

      toast.success(t('auth.messages.sessionStarted'));
      setShowMFAVerify(false);
      setMfaCode("");
    } catch (error: any) {
      toast.error(t('auth.errors.invalidCode'));
    } finally {
      setLoading(false);
    }
  };

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

    // Validar nombre si es registro
    if (!isLogin && !fullName.trim()) {
      toast.error(t('auth.errors.nameRequired'));
      return;
    }

    // Verify reCAPTCHA v3 for both login and signup
    if (!window.grecaptcha || !recaptchaLoaded) {
      toast.error(t('auth.errors.recaptchaNotLoaded'));
      return;
    }

    let recaptchaToken;
    try {
      recaptchaToken = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'submit' });
    } catch (error) {
      toast.error(t('auth.errors.recaptchaError'));
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
        toast.error(t('auth.errors.recaptchaFailed'));
        setLoading(false);
        return;
      }
      
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        
        if (error) throw error;

        // Log login activity
        try {
          // Get client IP from a service
          let clientIP = 'Unknown';
          try {
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipResponse.json();
            clientIP = ipData.ip;
          } catch (ipError) {
            console.error('Error getting IP:', ipError);
          }

          await supabase.functions.invoke('log-login-activity', {
            body: {
              userAgent: navigator.userAgent,
              ipAddress: clientIP
            }
          });
        } catch (logError) {
          console.error('Error logging activity:', logError);
          // Don't block login if logging fails
        }

        // Check if user has MFA enabled
        const { data: mfaData } = await supabase.auth.mfa.listFactors();
        const hasMFA = mfaData?.all && mfaData.all.length > 0;

        if (hasMFA) {
          setShowMFAVerify(true);
          setLoading(false);
          return;
        }

        toast.success(t('auth.messages.sessionStarted'));
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
          await supabase.from('profiles').insert({ 
            user_id: user.id, 
            email: email.trim(),
            full_name: fullName.trim()
          });
          await supabase.from('user_stats').insert({ 
            user_id: user.id,
            total_balance: 0,
            today_pnl: 0,
            win_rate: 0
          });
        }
        
        toast.success(t('auth.messages.accountCreated'));
      }
    } catch (error: any) {
      // Manejo de errores más específico
      if (error.message?.includes("already registered")) {
        toast.error(t('auth.errors.alreadyRegistered'));
      } else if (error.message?.includes("Invalid login credentials")) {
        toast.error(t('auth.errors.invalidCredentials'));
      } else {
        toast.error(error.message || t('common.error'));
      }
    } finally {
      setLoading(false);
    }
  };

  if (showMFAVerify) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-card border-border">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-foreground">{t('auth.mfaVerification')}</CardTitle>
            <CardDescription className="text-muted-foreground">
              {t('auth.mfaPrompt')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('auth.verificationCode')}</label>
              <Input
                type="text"
                placeholder="000000"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                maxLength={6}
                className="bg-background border-border text-center text-lg tracking-widest"
              />
            </div>
            <Button
              onClick={handleVerifyMFALogin}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={loading}
            >
              {loading ? t('common.verifying') : t('auth.verify')}
            </Button>
            <Button
              onClick={() => setShowMFAVerify(false)}
              variant="outline"
              className="w-full"
            >
              {t('common.cancel')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isResetPassword) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-card border-border">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-primary/10 p-3 rounded-lg">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl text-foreground">{t('auth.recoverPassword')}</CardTitle>
            <CardDescription className="text-muted-foreground">
              {t('auth.messages.recoverySent')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('auth.email')}</label>
                <Input
                  type="email"
                  placeholder={t('auth.emailPlaceholder')}
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
                {loading ? t('common.sending') : t('auth.sendEmail')}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <button
                onClick={() => setIsResetPassword(false)}
                className="text-sm text-primary hover:underline"
              >
                {t('auth.backToLogin')}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <BiometricLogin />
        <Card className="w-full bg-card border-border">
          <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary/10 p-3 rounded-lg">
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl text-foreground">TradePro</CardTitle>
          <CardDescription className="text-muted-foreground">
            {isLogin ? t('auth.loginTitle') : t('auth.signupTitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('auth.fullName')}</label>
                <Input
                  type="text"
                  placeholder={t('auth.yourName')}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onFocus={handleFormInteraction}
                  required={!isLogin}
                  className="bg-background border-border"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('auth.email')}</label>
              <Input
                type="email"
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={handleFormInteraction}
                required
                className="bg-background border-border"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('auth.password')}</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={handleFormInteraction}
                  required
                  className="bg-background border-border pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {isLogin && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setIsResetPassword(true)}
                  className="text-sm text-primary hover:underline"
                >
                  {t('auth.forgotPassword')}
                </button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={loading}
            >
              {loading ? t('common.processing') : isLogin ? t('auth.login') : t('auth.createAccount')}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">{t('auth.continueWith')}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                      redirectTo: `${window.location.origin}/`,
                      queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                      }
                    }
                  });
                  if (error) throw error;
                } catch (error: any) {
                  toast.error(t('auth.googleError'));
                }
              }}
              disabled={loading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'azure',
                    options: {
                      redirectTo: `${window.location.origin}/`,
                      scopes: 'email openid profile'
                    }
                  });
                  if (error) throw error;
                } catch (error: any) {
                  toast.error(t('auth.microsoftError'));
                }
              }}
              disabled={loading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z"/>
              </svg>
              Microsoft
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'apple',
                    options: {
                      redirectTo: `${window.location.origin}/`
                    }
                  });
                  if (error) throw error;
                } catch (error: any) {
                  toast.error("Error al iniciar sesión con Apple");
                }
              }}
              disabled={loading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              Apple
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'facebook',
                    options: {
                      redirectTo: `${window.location.origin}/`
                    }
                  });
                  if (error) throw error;
                } catch (error: any) {
                  toast.error("Error al iniciar sesión con Facebook");
                }
              }}
              disabled={loading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Facebook
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  setLoading(true);
                  // Open Telegram login in a popup
                  const width = 600;
                  const height = 700;
                  const left = window.screen.width / 2 - width / 2;
                  const top = window.screen.height / 2 - height / 2;
                  
                  const popup = window.open(
                    'about:blank',
                    'telegram-login',
                    `width=${width},height=${height},left=${left},top=${top}`
                  );
                  
                  if (!popup) {
                    toast.error(t('auth.popupBlocked'));
                    setLoading(false);
                    return;
                  }

                  // Get the Telegram login URL from edge function
                  const { data, error } = await supabase.functions.invoke('get-telegram-auth-url');
                  
                  if (error || !data?.url) {
                    throw new Error(t('auth.authUrlError'));
                  }

                  popup.location.href = data.url;

                  // Listen for the response
                  const handleMessage = async (event: MessageEvent) => {
                    if (event.origin !== window.location.origin) return;
                    
                    if (event.data.type === 'telegram-auth') {
                      window.removeEventListener('message', handleMessage);
                      popup.close();
                      
                      try {
                        // Authenticate with Telegram data
                        const { data: authData, error: authError } = await supabase.functions.invoke(
                          'telegram-auth',
                          { body: event.data.data }
                        );

                        if (authError || !authData?.session) {
                          throw new Error(t('auth.authenticationError'));
                        }

                        // Set the session
                        await supabase.auth.setSession({
                          access_token: authData.session.access_token,
                          refresh_token: authData.session.refresh_token
                        });

                        toast.success(t('auth.telegramSuccess'));
                      } catch (err: any) {
                        toast.error(err.message || t('auth.telegramError'));
                      } finally {
                        setLoading(false);
                      }
                    }
                  };

                  window.addEventListener('message', handleMessage);

                  // Check if popup was closed
                  const checkClosed = setInterval(() => {
                    if (popup.closed) {
                      clearInterval(checkClosed);
                      window.removeEventListener('message', handleMessage);
                      setLoading(false);
                    }
                  }, 500);
                } catch (error: any) {
                  console.error('Telegram auth error:', error);
                  toast.error(t('auth.telegramError'));
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="col-span-2"
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
              </svg>
              Telegram
            </Button>
          </div>
          
          <div className="mt-4 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-primary hover:underline"
            >
              {isLogin ? t('auth.noAccount') : t('auth.alreadyHaveAccount')}
            </button>
          </div>
        </CardContent>
        </Card>
      </div>
    </div>
  );
};
