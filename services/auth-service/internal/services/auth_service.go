package services

import (
	"auth-service/internal/config"
	"auth-service/internal/repository"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"gorm.io/gorm"
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

func (s *AuthService) GoogleLoginURL() string {
	return s.oauthCfg.AuthCodeURL("state")
}

func (s *AuthService) HandleGoogleCallback(ctx context.Context, code string) (string, map[string]any, error) {
	token, err := s.oauthCfg.Exchange(ctx, code)
	if err != nil {
		return "", nil, err
	}

	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	req.Header.Set("Authorization", "Bearer "+token.AccessToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return "", nil, fmt.Errorf("google userinfo failed: %s", strings.TrimSpace(string(body)))
	}

	var googleUser struct {
		ID      string `json:"id"`
		Email   string `json:"email"`
		Name    string `json:"name"`
		Picture string `json:"picture"`
	}
	if err := json.Unmarshal(body, &googleUser); err != nil {
		return "", nil, err
	}

	user, err := s.userRepo.UpsertFromGoogle(googleUser.ID, googleUser.Email, googleUser.Name, googleUser.Picture)
	if err != nil {
		return "", nil, err
	}

	t := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"sub":   user.ID,
		"email": user.Email,
		"role":  user.Role,
		"name":  user.Name,
		"exp":   time.Now().Add(time.Hour).Unix(),
		"iat":   time.Now().Unix(),
	})

	private, err := jwt.ParseRSAPrivateKeyFromPEM(s.privateKey)
	if err != nil {
		return "", nil, err
	}
	signedToken, err := t.SignedString(private)
	if err != nil {
		return "", nil, err
	}

	if err := s.redis.SaveSession(signedToken, user.ID); err != nil {
		return "", nil, err
	}

	return signedToken, map[string]any{
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
