package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type UserHandler struct {
	service UserContract
}

type UserContract interface {
	ListUsers(q, pageRaw, limitRaw string) (map[string]any, error)
	GetByID(id string) (any, error)
	UpdateMe(id string, name, avatar *string) (map[string]any, error)
	UpdateRole(id, role string) (map[string]any, error)
	DeleteByID(id string) (int64, error)
	Search(q string) ([]map[string]any, error)
}

func NewUserHandler(s UserContract) *UserHandler {
	return &UserHandler{service: s}
}

func (h *UserHandler) ListUsers(c *gin.Context) {
	res, err := h.service.ListUsers(c.Query("q"), c.DefaultQuery("page", "1"), c.DefaultQuery("limit", "20"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}
	c.JSON(http.StatusOK, res)
}

func (h *UserHandler) GetMe(c *gin.Context) {
	claims := c.MustGet("user").(map[string]any)
	sub, _ := claims["sub"].(string)
	user, err := h.service.GetByID(sub)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}
	if user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	c.JSON(http.StatusOK, user)
}

func (h *UserHandler) GetByID(c *gin.Context) {
	user, err := h.service.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}
	if user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	c.JSON(http.StatusOK, user)
}

func (h *UserHandler) UpdateMe(c *gin.Context) {
	var body map[string]*string
	if err := c.ShouldBindJSON(&body); err != nil {
		body = map[string]*string{}
	}
	name, hasName := body["name"]
	avatar, hasAvatar := body["avatar"]
	if !hasName && !hasAvatar {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No fields to update"})
		return
	}
	claims := c.MustGet("user").(map[string]any)
	sub, _ := claims["sub"].(string)
	updated, err := h.service.UpdateMe(sub, name, avatar)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}
	if updated == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	c.JSON(http.StatusOK, updated)
}

func (h *UserHandler) UpdateRole(c *gin.Context) {
	var body struct {
		Role string `json:"role"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		body.Role = ""
	}
	if body.Role != "user" && body.Role != "admin" {
		c.JSON(http.StatusBadRequest, gin.H{"error": `Invalid role. Must be "user" or "admin"`})
		return
	}
	updated, err := h.service.UpdateRole(c.Param("id"), body.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}
	if updated == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	c.JSON(http.StatusOK, updated)
}

func (h *UserHandler) DeleteUser(c *gin.Context) {
	deleted, err := h.service.DeleteByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}
	if deleted == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *UserHandler) Search(c *gin.Context) {
	q := c.Query("q")
	if q == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": `Query param "q" is required`})
		return
	}
	users, err := h.service.Search(q)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"users": users})
}

func (h *UserHandler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
