-- Create encrypted tokens table for secure Strava token storage
CREATE TABLE public.encrypted_strava_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.encrypted_strava_tokens ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own encrypted tokens" 
ON public.encrypted_strava_tokens 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own encrypted tokens" 
ON public.encrypted_strava_tokens 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own encrypted tokens" 
ON public.encrypted_strava_tokens 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own encrypted tokens" 
ON public.encrypted_strava_tokens 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create secure state tokens table for OAuth
CREATE TABLE public.oauth_state_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_url TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '15 minutes'),
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.oauth_state_tokens ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own OAuth tokens" 
ON public.oauth_state_tokens 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own OAuth tokens" 
ON public.oauth_state_tokens 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own OAuth tokens" 
ON public.oauth_state_tokens 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_encrypted_strava_tokens_updated_at
BEFORE UPDATE ON public.encrypted_strava_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Remove plaintext Strava tokens from profiles (keeping connection flags)
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS strava_access_token,
DROP COLUMN IF EXISTS strava_refresh_token;

-- Add audit log table for security monitoring
CREATE TABLE public.security_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS (admins only can view all, users can view their own)
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs" 
ON public.security_audit_log 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_encrypted_strava_tokens_user_id ON public.encrypted_strava_tokens(user_id);
CREATE INDEX idx_oauth_state_tokens_token ON public.oauth_state_tokens(token);
CREATE INDEX idx_oauth_state_tokens_expires_at ON public.oauth_state_tokens(expires_at);
CREATE INDEX idx_security_audit_log_user_id ON public.security_audit_log(user_id);
CREATE INDEX idx_security_audit_log_created_at ON public.security_audit_log(created_at);