import { Router } from "express";

const router = Router();

// POST /api/google/token
// Exchanges an authorization code for tokens using the server-side client secret.
// The client sends: { code, codeVerifier, redirectUri }
router.post("/google/token", async (req, res) => {
  const { code, codeVerifier, redirectUri } = req.body as {
    code?: string;
    codeVerifier?: string;
    redirectUri?: string;
  };

  if (!code || !codeVerifier || !redirectUri) {
    res.status(400).json({ error: "code, codeVerifier and redirectUri are required" });
    return;
  }

  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    res.status(500).json({ error: "Google credentials not configured on server" });
    return;
  }

  try {
    const params = new URLSearchParams({
      code,
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  redirectUri,
      grant_type:    "authorization_code",
      code_verifier: codeVerifier,
    });

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    params.toString(),
    });

    const data = await tokenRes.json() as Record<string, unknown>;

    if (!tokenRes.ok) {
      res.status(400).json({ error: "Google token exchange failed", details: data });
      return;
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Internal error during token exchange" });
  }
});

// POST /api/google/refresh
// Exchanges a refresh token for a new access token.
// The client sends: { refreshToken }
router.post("/google/refresh", async (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };

  if (!refreshToken) {
    res.status(400).json({ error: "refreshToken is required" });
    return;
  }

  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    res.status(500).json({ error: "Google credentials not configured on server" });
    return;
  }

  try {
    const params = new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     clientId,
      client_secret: clientSecret,
      grant_type:    "refresh_token",
    });

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    params.toString(),
    });

    const data = await tokenRes.json() as Record<string, unknown>;

    if (!tokenRes.ok) {
      res.status(400).json({ error: "Google token refresh failed", details: data });
      return;
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Internal error during token refresh" });
  }
});

export default router;
