package handler

import (
	"context"

	"github.com/gofiber/fiber/v2"
)

// resolveModel translates a public display_name to internal model name.
func resolveModel(ctx context.Context, deps *HandlerDeps, model string) string {
	var internal string
	err := deps.PG.QueryRow(ctx,
		"SELECT name FROM model_pools WHERE display_name = $1 AND is_active = true LIMIT 1",
		model,
	).Scan(&internal)
	if err == nil && internal != "" {
		return internal
	}
	return model
}

func ListModels(deps *HandlerDeps) fiber.Handler {
	return func(c *fiber.Ctx) error {
		ctx := c.Context()
		rows, err := deps.PG.Query(ctx,
			`SELECT DISTINCT mp.name, mp.display_name
			 FROM model_pools mp
			 JOIN channels c ON c.model_pool_id = mp.id
			 WHERE mp.is_active = true AND c.status = 'active'`)
		if err != nil || rows == nil {
			return c.JSON(fiber.Map{
				"object": "list",
				"data":   []fiber.Map{},
			})
		}
		defer rows.Close()

		var models []fiber.Map
		for rows.Next() {
			var name, display string
			if err := rows.Scan(&name, &display); err == nil {
				if display == "" {
					display = name
				}
				models = append(models, fiber.Map{
					"id":       display,
					"object":   "model",
					"owned_by": "Camellia",
				})
			}
		}
		if len(models) == 0 {
			models = []fiber.Map{}
		}
		return c.JSON(fiber.Map{
			"object": "list",
			"data":   models,
		})
	}
}
