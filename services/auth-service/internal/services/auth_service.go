package services

import (
	"auth-service/internal/config"
	"auth-service/internal/models"
	"auth-service/internal/repository"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"gorm.io/gorm"
)

var googleOAuthRequestsTotal = promauto.NewCounterVec(
	prometheus.CounterOpts{
		Name: "google_oauth_requests_total",
		Help: "Google OAuth authorization code exchange attempts",
	},
	[]string{"status"},
)

type AuthService struct {
	cfg        config.Config
	userRepo   *repository.UserRepository
	redis      *RedisService
	privateKey []byte
	publicKey  []byte
	oauthCfg   *oauth2.Config
	httpClient *http.Client
}

type JWTUser struct {
	Sub   string `json:"sub"`
	Email string `json:"email"`
	Role  string `json:"role"`
	Name  string `json:"name"`
}

func NewAuthService(cfg config.Config, db *gorm.DB, redisSvc *RedisService) (*AuthService, error) {
	privateKey, err := os.ReadFile(cfg.JWTPrivateKey)
	if err != nil {
		return nil, err
	}
	publicKey, err := os.ReadFile(cfg.JWTPublicKey)
	if err != nil {
		return nil, err
	}

	return &AuthService{
		cfg:        cfg,
		userRepo:   repository.NewUserRepository(db),
		redis:      redisSvc,
		privateKey: privateKey,
		publicKey:  publicKey,
		oauthCfg: &oauth2.Config{
			ClientID:     cfg.GoogleClientID,
			ClientSecret: cfg.GoogleSecret,
			RedirectURL:  cfg.GoogleCallback,
			Endpoint:     google.Endpoint,
			Scopes:       []string{"profile", "email"},
		},
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}, nil
}

// generateState returns a cryptographically secure random 32-char hex string.
// Returns error instead of panicking, following Go error handling best practices.
func generateState() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate oauth state: %w", err)
	}
	return hex.EncodeToString(b), nil
}

// GoogleLoginURL satisfies handlers.AuthContract (no error in signature); Redis/state logic unchanged.
func (s *AuthService) GoogleLoginURL() string {
	u, err := s.googleLoginURL(context.Background())
	if err != nil {
		return ""
	}
	return u
}

// googleLoginURL generates a secure OAuth authorization URL with CSRF protection.
func (s *AuthService) googleLoginURL(ctx context.Context) (string, error) {
	state, err := generateState()
	if err != nil {
		return "", err
	}

	if err := s.redis.SetState(ctx, state, 5*time.Minute); err != nil {
		return "", fmt.Errorf("store oauth state: %w", err)
	}

	return s.oauthCfg.AuthCodeURL(state), nil
}



// googleUserInfo is the JSON shape returned by Google's userinfo endpoint.
// Named so JSON unmarshaling and return values share one type (struct tags are part of the type in Go).
type googleUserInfo struct {
	ID      string `json:"id"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

// fetchGoogleUser retrieves user information from Google OAuth provider.
func (s *AuthService) fetchGoogleUser(ctx context.Context, accessToken string) (googleUserInfo, error) {
	var result googleUserInfo

	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return result, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		return result, fmt.Errorf("google userinfo failed: %s", strings.TrimSpace(string(body)))
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return result, err
	}

	return result, nil
}

// issueJWT creates a signed JWT token for the authenticated user.
func (s *AuthService) issueJWT(user *models.User) (string, error) {
	t := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"sub":   user.ID,
		"email": user.Email,
		"role":  user.Role,
		"name":  user.Name,
		"exp":   time.Now().Add(time.Hour).Unix(),
		"iat":   time.Now().Unix(),
	})

	priv, err := jwt.ParseRSAPrivateKeyFromPEM(s.privateKey)
	if err != nil {
		return "", fmt.Errorf("parse private key: %w", err)
	}

	return t.SignedString(priv)
}


// HandleGoogleCallback validates OAuth callback and completes the login flow.
func (s *AuthService) HandleGoogleCallback(ctx context.Context, code string, state string) (string, map[string]any, error) {
	// Validate OAuth state (CSRF protection)
	ok, err := s.redis.ConsumeState(ctx, state)
	if err != nil || !ok {
		return "", nil, fmt.Errorf("invalid or expired OAuth state")
	}

	// Exchange authorization code for access token
	token, err := s.oauthCfg.Exchange(ctx, code)
	if err != nil {
		googleOAuthRequestsTotal.WithLabelValues("failure").Inc()
		return "", nil, fmt.Errorf("oauth exchange: %w", err)
	}
	googleOAuthRequestsTotal.WithLabelValues("success").Inc()

	// Fetch user information from Google
	googleUser, err := s.fetchGoogleUser(ctx, token.AccessToken)
	if err != nil {
		return "", nil, err
	}

	// Create or update user in database
	user, err := s.userRepo.UpsertFromGoogle(googleUser.ID, googleUser.Email, googleUser.Name, googleUser.Picture)
	if err != nil {
		return "", nil, err
	}

	// Issue JWT token
	jwtToken, err := s.issueJWT(user)
	if err != nil {
		return "", nil, err
	}

	// Save session in Redis
	if err := s.redis.SaveSession(jwtToken, user.ID); err != nil {
		return "", nil, err
	}

	return jwtToken, map[string]any{
		"id":    user.ID,
		"email": user.Email,
		"name":  user.Name,
		"role":  user.Role,
	}, nil
}

func (s *AuthService) Logout(token string) error {
	if token == "" {
		return nil
	}
	_ = s.redis.DeleteSession(token)

	ttl := time.Hour
	if parsed, _, err := jwt.NewParser().ParseUnverified(token, jwt.MapClaims{}); err == nil {
		if claims, ok := parsed.Claims.(jwt.MapClaims); ok {
			if expRaw, ok := claims["exp"]; ok {
				switch exp := expRaw.(type) {
				case float64:
					remaining := time.Until(time.Unix(int64(exp), 0))
					if remaining > 0 && remaining < ttl {
						ttl = remaining
					}
				case int64:
					remaining := time.Until(time.Unix(exp, 0))
					if remaining > 0 && remaining < ttl {
						ttl = remaining
					}
				}
			}
		}
	}

	return s.redis.BlacklistToken(token, ttl)
}

func (s *AuthService) ValidateToken(token string) (map[string]any, string, error) {
	public, err := jwt.ParseRSAPublicKeyFromPEM(s.publicKey)
	if err != nil {
		return nil, "Invalid token", err
	}
	parsed, err := jwt.Parse(token, func(t *jwt.Token) (any, error) {
		return public, nil
	}, jwt.WithValidMethods([]string{"RS256"}))
	if err != nil {
		if strings.Contains(err.Error(), "expired") {
			return nil, "Token expired", err
		}
		return nil, "Invalid token", err
	}
	if !parsed.Valid {
		return nil, "Invalid token", fmt.Errorf("invalid token")
	}

	if _, err := s.redis.GetSession(token); err != nil {
		return nil, "Token invalidated", err
	}

	claims, ok := parsed.Claims.(jwt.MapClaims)
	if !ok {
		return nil, "Invalid token", fmt.Errorf("invalid claims")
	}
	return claims, "", nil
}

func (s *AuthService) PublicKey() string {
	return string(s.publicKey)
}