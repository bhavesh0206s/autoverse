from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
	app_name: str = "Autoverse"
	env: str = "development"
	secret_key: str = "change_me_in_production"

	database_url: str = "postgresql+asyncpg://autoverse:autoverse@localhost:5432/autoverse"

	cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

	groq_api_key: str = ""
	groq_model: str = "openai/gpt-oss-120b"

	vite_api_url: str = "http://localhost:8000"
	vite_ws_url: str = "ws://localhost:8000"

	class Config:
		env_file = [".env", "../.env"]
		env_file_encoding = "utf-8"
		extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
	return Settings()
