.PHONY: test test-coverage

test:
	PYTHONPATH=$(CURDIR) pytest tests/ --override-ini="addopts="

test-coverage:
	PYTHONPATH=$(CURDIR) pytest tests/ \
		--cov=internal \
		--cov=app \
		--cov-report=term-missing \
		--cov-report=html:coverage_html \
		--override-ini="addopts="
