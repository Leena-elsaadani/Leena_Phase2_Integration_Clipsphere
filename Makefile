.PHONY: coverage-all coverage-auth coverage-user coverage-chat coverage-dashboard

# Run coverage for every service sequentially and print a combined summary.
coverage-all: coverage-auth coverage-user coverage-chat coverage-dashboard
	@echo ""
	@echo "=========================================="
	@echo "  Coverage run complete for all services"
	@echo "=========================================="

coverage-auth:
	@echo ""
	@echo "--- auth-service ---"
	$(MAKE) -C services/auth-service test-coverage

coverage-user:
	@echo ""
	@echo "--- user-service ---"
	$(MAKE) -C services/user-service test-coverage

coverage-chat:
	@echo ""
	@echo "--- chat-service ---"
	cd services/chat-service && npm run test:coverage

coverage-dashboard:
	@echo ""
	@echo "--- dashboard-service ---"
	$(MAKE) -C services/dashboard-service test-coverage
