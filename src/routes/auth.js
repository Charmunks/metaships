const express = require("express");
const db = require("../db");

const router = express.Router();

const HACKCLUB_AUTH_URL = "https://auth.hackclub.com/oauth/authorize";
const HACKCLUB_TOKEN_URL = "https://auth.hackclub.com/oauth/token";
const HACKCLUB_API_URL = "https://auth.hackclub.com/api/v1";

function getRedirectUri() {
  return `${process.env.BASE_URL}/auth/callback`;
}

router.get("/login", (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.HACKCLUB_CLIENT_ID,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: "email",
  });

  res.redirect(`${HACKCLUB_AUTH_URL}?${params.toString()}`);
});

router.get("/callback", async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.render("login.njk", {
      title: "Login",
      error: "Authorization was denied",
    });
  }

  if (!code) {
    return res.render("login.njk", {
      title: "Login",
      error: "No authorization code received",
    });
  }

  try {
    const tokenResponse = await fetch(HACKCLUB_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.HACKCLUB_CLIENT_ID,
        client_secret: process.env.HACKCLUB_CLIENT_SECRET,
        redirect_uri: getRedirectUri(),
        code,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to exchange code for token");
    }

    const tokens = await tokenResponse.json();

    const userResponse = await fetch(`${HACKCLUB_API_URL}/me`, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error("Failed to fetch user info");
    }

    const userInfo = await userResponse.json();
    const hackclubId = userInfo.identity.id;
    const email = userInfo.identity.primary_email;

    const tokenExpiresAt = new Date(
      Date.now() + (tokens.expires_in || 15552000) * 1000
    );

    let user = await db("users").where("hackclub_id", hackclubId).first();

    if (user) {
      await db("users").where("id", user.id).update({
        email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: tokenExpiresAt,
        updated_at: db.fn.now(),
      });
      user = await db("users").where("id", user.id).first();
    } else {
      const [newUser] = await db("users")
        .insert({
          hackclub_id: hackclubId,
          email,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: tokenExpiresAt,
        })
        .returning("*");
      user = newUser;
    }

    req.session.userId = user.id;
    const returnTo = req.session.returnTo || "/";
    delete req.session.returnTo;
    res.redirect(returnTo);
  } catch (err) {
    console.error("OAuth error:", err);
    res.render("login.njk", {
      title: "Login",
      error: "Authentication failed. Please try again.",
    });
  }
});

router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Session destruction error:", err);
    }
    res.redirect("/");
  });
});

router.get("/page", (req, res) => {
  res.render("login.njk", { title: "Login", user: req.user });
});

module.exports = router;
