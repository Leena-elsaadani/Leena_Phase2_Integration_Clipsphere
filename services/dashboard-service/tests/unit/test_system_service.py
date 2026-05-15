import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from internal.services.system_service import CircuitBreaker, fetch_with_retry


class TestCircuitBreaker:
    def test_circuit_breaker_initial_state(self):
        """Test circuit breaker starts in closed state."""
        breaker = CircuitBreaker(threshold=3, cooldown_seconds=10)
        assert breaker.failures == 0
        assert breaker.opened_at is None
        assert breaker.can_call() is True

    def test_circuit_breaker_can_call_when_closed(self):
        """Test can_call returns True when circuit is closed."""
        breaker = CircuitBreaker(threshold=3, cooldown_seconds=10)
        assert breaker.can_call() is True

    def test_circuit_breaker_opens_after_threshold_failures(self):
        """Test circuit opens after reaching failure threshold."""
        breaker = CircuitBreaker(threshold=3, cooldown_seconds=10)
        
        # Record failures up to threshold
        for _ in range(3):
            breaker.on_failure()
        
        assert breaker.failures == 3
        assert breaker.opened_at is not None
        assert breaker.can_call() is False

    def test_circuit_breaker_remains_closed_below_threshold(self):
        """Test circuit stays closed when failures below threshold."""
        breaker = CircuitBreaker(threshold=3, cooldown_seconds=10)
        
        # Record failures below threshold
        for _ in range(2):
            breaker.on_failure()
        
        assert breaker.failures == 2
        assert breaker.opened_at is None
        assert breaker.can_call() is True

    def test_circuit_breaker_resets_on_success(self):
        """Test circuit resets to closed state on success."""
        breaker = CircuitBreaker(threshold=3, cooldown_seconds=10)
        
        # Open the circuit
        for _ in range(3):
            breaker.on_failure()
        
        assert breaker.opened_at is not None
        
        # Reset on success
        breaker.on_success()
        
        assert breaker.failures == 0
        assert breaker.opened_at is None
        assert breaker.can_call() is True

    def test_circuit_breaker_cooldown_period(self):
        """Test circuit remains closed after cooldown period."""
        breaker = CircuitBreaker(threshold=3, cooldown_seconds=1)
        
        # Open the circuit
        for _ in range(3):
            breaker.on_failure()
        
        assert breaker.can_call() is False
        
        # Wait for cooldown
        time.sleep(1.1)
        
        assert breaker.can_call() is True

    def test_circuit_breaker_still_open_during_cooldown(self):
        """Test circuit stays open during cooldown period."""
        breaker = CircuitBreaker(threshold=3, cooldown_seconds=2)
        
        # Open the circuit
        for _ in range(3):
            breaker.on_failure()
        
        assert breaker.can_call() is False
        
        # Wait less than cooldown
        time.sleep(1)
        
        assert breaker.can_call() is False

    def test_circuit_breaker_custom_threshold(self):
        """Test circuit breaker with custom threshold."""
        breaker = CircuitBreaker(threshold=5, cooldown_seconds=10)
        
        # Record failures below custom threshold
        for _ in range(4):
            breaker.on_failure()
        
        assert breaker.can_call() is True
        
        # Reach threshold
        breaker.on_failure()
        
        assert breaker.can_call() is False

    def test_circuit_breaker_incremental_failures(self):
        """Test circuit breaker handles incremental failures."""
        breaker = CircuitBreaker(threshold=3, cooldown_seconds=10)
        
        breaker.on_failure()
        assert breaker.failures == 1
        assert breaker.can_call() is True
        
        breaker.on_failure()
        assert breaker.failures == 2
        assert breaker.can_call() is True
        
        breaker.on_failure()
        assert breaker.failures == 3
        assert breaker.can_call() is False

    def test_circuit_breaker_success_after_partial_failures(self):
        """Test circuit resets on success even with partial failures."""
        breaker = CircuitBreaker(threshold=3, cooldown_seconds=10)
        
        breaker.on_failure()
        breaker.on_failure()
        assert breaker.failures == 2
        
        breaker.on_success()
        assert breaker.failures == 0
        assert breaker.can_call() is True


class TestFetchWithRetry:
    @pytest.mark.asyncio
    async def test_fetch_with_retry_success_on_first_attempt(self):
        """Test successful fetch on first attempt."""
        breaker = CircuitBreaker(threshold=3, cooldown_seconds=10)
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"data": "success"}
        
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client
            mock_client.get.return_value = mock_response
            
            result = await fetch_with_retry("http://example.com", breaker)
            
            assert result == {"data": "success"}
            assert breaker.failures == 0
            assert breaker.opened_at is None
            mock_client.get.assert_called_once_with("http://example.com")

    @pytest.mark.asyncio
    async def test_fetch_with_retry_success_after_retry(self):
        """Test successful fetch after retry."""
        breaker = CircuitBreaker(threshold=3, cooldown_seconds=10)
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"data": "success"}
        
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client
            # First attempt fails, second succeeds
            mock_client.get.side_effect = [
                httpx.RequestError("Connection error"),
                mock_response
            ]
            
            result = await fetch_with_retry("http://example.com", breaker)
            
            assert result == {"data": "success"}
            assert breaker.failures == 0  # Reset on success
            assert mock_client.get.call_count == 2

    @pytest.mark.asyncio
    async def test_fetch_with_retry_all_attempts_fail(self):
        """Test fetch fails after all retry attempts."""
        breaker = CircuitBreaker(threshold=3, cooldown_seconds=10)
        
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client
            mock_client.get.side_effect = httpx.RequestError("Connection error")
            
            with pytest.raises(RuntimeError, match="Connection error"):
                await fetch_with_retry("http://example.com", breaker)
            
            assert breaker.failures == 3  # All retries failed
            assert breaker.opened_at is not None

    @pytest.mark.asyncio
    async def test_fetch_with_retry_http_error_status(self):
        """Test fetch handles HTTP error status codes."""
        breaker = CircuitBreaker(threshold=3, cooldown_seconds=10)
        
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Server error", request=MagicMock(), response=mock_response
        )
        
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client
            mock_client.get.return_value = mock_response
            
            with pytest.raises(RuntimeError):
                await fetch_with_retry("http://example.com", breaker)
            
            assert breaker.failures > 0

    @pytest.mark.asyncio
    async def test_fetch_with_retry_json_parse_error(self):
        """Test fetch handles JSON parse errors."""
        breaker = CircuitBreaker(threshold=3, cooldown_seconds=10)
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.side_effect = ValueError("Invalid JSON")
        
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client
            mock_client.get.return_value = mock_response
            
            with pytest.raises(RuntimeError):
                await fetch_with_retry("http://example.com", breaker)
            
            assert breaker.failures > 0

    @pytest.mark.asyncio
    async def test_fetch_with_retry_circuit_open_error(self):
        """Test fetch fails when circuit is open."""
        breaker = CircuitBreaker(threshold=1, cooldown_seconds=10)
        
        # Open the circuit
        breaker.on_failure()
        
        with pytest.raises(RuntimeError, match="circuit open"):
            await fetch_with_retry("http://example.com", breaker)
        
        # Should not attempt HTTP call when circuit is open
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client
            
            with pytest.raises(RuntimeError, match="circuit open"):
                await fetch_with_retry("http://example.com", breaker)
            
            mock_client.get.assert_not_called()

    @pytest.mark.asyncio
    async def test_fetch_with_retry_resets_circuit_on_success(self):
        """Test successful fetch resets circuit breaker."""
        breaker = CircuitBreaker(threshold=2, cooldown_seconds=10)
        
        # Partially open the circuit
        breaker.on_failure()
        assert breaker.failures == 1
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"data": "success"}
        
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client
            mock_client.get.return_value = mock_response
            
            result = await fetch_with_retry("http://example.com", breaker)
            
            assert result == {"data": "success"}
            assert breaker.failures == 0  # Reset
            assert breaker.opened_at is None

    @pytest.mark.asyncio
    async def test_fetch_with_retry_retry_delays(self):
        """Test retry uses exponential backoff delays."""
        breaker = CircuitBreaker(threshold=3, cooldown_seconds=10)
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"data": "success"}
        
        call_times = []
        
        async def track_time(*args, **kwargs):
            call_times.append(time.time())
            if len(call_times) == 1:
                raise httpx.RequestError("First failure")
            return mock_response
        
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client
            mock_client.get.side_effect = track_time
            
            result = await fetch_with_retry("http://example.com", breaker)
            
            assert result == {"data": "success"}
            assert len(call_times) == 2
            # Check that there was a delay between calls (roughly 0.1s based on implementation)
            delay = call_times[1] - call_times[0]
            assert delay >= 0.05  # Allow some tolerance

    @pytest.mark.asyncio
    async def test_fetch_with_retry_timeout(self):
        """Test fetch respects timeout configuration."""
        breaker = CircuitBreaker(threshold=3, cooldown_seconds=10)
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"data": "success"}
        
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client
            mock_client.get.return_value = mock_response
            
            await fetch_with_retry("http://example.com", breaker)
            
            # Check that timeout was passed to AsyncClient
            mock_client_class.assert_called_once()
            call_kwargs = mock_client_class.call_args
            assert 'timeout' in call_kwargs[1]
            assert call_kwargs[1]['timeout'] == 2.0

    @pytest.mark.asyncio
    async def test_fetch_with_retry_different_url(self):
        """Test fetch with different URLs."""
        breaker = CircuitBreaker(threshold=3, cooldown_seconds=10)
        
        urls = [
            "http://example1.com",
            "http://example2.com",
            "http://example3.com"
        ]
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"data": "success"}
        
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client
            mock_client.get.return_value = mock_response
            
            for url in urls:
                result = await fetch_with_retry(url, breaker)
                assert result == {"data": "success"}

    @pytest.mark.asyncio
    async def test_fetch_with_retry_empty_response(self):
        """Test fetch handles empty response data."""
        breaker = CircuitBreaker(threshold=3, cooldown_seconds=10)
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {}
        
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client
            mock_client.get.return_value = mock_response
            
            result = await fetch_with_retry("http://example.com", breaker)
            
            assert result == {}
            assert breaker.failures == 0

    @pytest.mark.asyncio
    async def test_fetch_with_retry_complex_json_response(self):
        """Test fetch handles complex JSON responses."""
        breaker = CircuitBreaker(threshold=3, cooldown_seconds=10)
        
        complex_data = {
            "users": [
                {"id": 1, "name": "Alice"},
                {"id": 2, "name": "Bob"}
            ],
            "metadata": {
                "total": 2,
                "page": 1
            }
        }
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = complex_data
        
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client
            mock_client.get.return_value = mock_response
            
            result = await fetch_with_retry("http://example.com", breaker)
            
            assert result == complex_data
            assert len(result["users"]) == 2
