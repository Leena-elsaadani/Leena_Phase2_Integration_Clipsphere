from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator

from internal.handlers.dashboard_handler import register_handlers
from internal.services.events_consumer import start_consumer_thread


def create_app() -> FastAPI:
    app = FastAPI()
    register_handlers(app)
    Instrumentator().instrument(app).expose(app, include_in_schema=False)

    @app.on_event("startup")
    async def startup_event() -> None:
        start_consumer_thread()

    return app
