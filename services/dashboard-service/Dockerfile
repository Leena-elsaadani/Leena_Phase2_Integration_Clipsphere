FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt ./
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir -r requirements.txt
COPY src ./src
COPY app ./app
COPY internal ./internal
EXPOSE 8000
# Honor PORT from docker-compose / .env (exec-form CMD ignores env alone).
CMD ["sh", "-c", "exec uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
