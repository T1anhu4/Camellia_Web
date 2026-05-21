package handler

import (
	"fmt"
	"sync/atomic"

	"github.com/gofiber/fiber/v2"
)

// Metrics holds atomic counters for gateway observability.
// Exposed at GET /metrics in Prometheus text format.
type Metrics struct {
	TotalRequests     uint64
	SuccessfulRequests uint64
	FailedRequests    uint64
	RateLimitedRequests uint64
	SSEStreamsActive  int64
	TokensProcessed   uint64
	BillingEventsSent uint64
}

var GlobalMetrics = &Metrics{}

func (m *Metrics) IncRequests()     { atomic.AddUint64(&m.TotalRequests, 1) }
func (m *Metrics) IncSuccess()      { atomic.AddUint64(&m.SuccessfulRequests, 1) }
func (m *Metrics) IncFailed()       { atomic.AddUint64(&m.FailedRequests, 1) }
func (m *Metrics) IncRateLimited()  { atomic.AddUint64(&m.RateLimitedRequests, 1) }
func (m *Metrics) AddTokens(n int)  { atomic.AddUint64(&m.TokensProcessed, uint64(n)) }
func (m *Metrics) IncBillingEvent() { atomic.AddUint64(&m.BillingEventsSent, 1) }
func (m *Metrics) SSEStart()        { atomic.AddInt64(&m.SSEStreamsActive, 1) }
func (m *Metrics) SSEEnd()          { atomic.AddInt64(&m.SSEStreamsActive, -1) }

// MetricsHandler returns a Prometheus-compatible metrics endpoint.
func MetricsHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		m := GlobalMetrics
		body := fmt.Sprintf(
			`# HELP llmgw_requests_total Total number of API requests
# TYPE llmgw_requests_total counter
llmgw_requests_total %d

# HELP llmgw_requests_successful_total Successful API requests
# TYPE llmgw_requests_successful_total counter
llmgw_requests_successful_total %d

# HELP llmgw_requests_failed_total Failed API requests
# TYPE llmgw_requests_failed_total counter
llmgw_requests_failed_total %d

# HELP llmgw_rate_limited_total Rate-limited requests
# TYPE llmgw_rate_limited_total counter
llmgw_rate_limited_total %d

# HELP llmgw_sse_streams_active Currently active SSE streams
# TYPE llmgw_sse_streams_active gauge
llmgw_sse_streams_active %d

# HELP llmgw_tokens_processed_total Total tokens processed
# TYPE llmgw_tokens_processed_total counter
llmgw_tokens_processed_total %d

# HELP llmgw_billing_events_sent_total Billing events enqueued to worker pool
# TYPE llmgw_billing_events_sent_total counter
llmgw_billing_events_sent_total %d
`,
			m.TotalRequests,
			m.SuccessfulRequests,
			m.FailedRequests,
			m.RateLimitedRequests,
			m.SSEStreamsActive,
			m.TokensProcessed,
			m.BillingEventsSent,
		)
		c.Set("Content-Type", "text/plain; version=0.0.4")
		return c.SendString(body)
	}
}
