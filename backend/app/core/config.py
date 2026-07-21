from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    OPENAI_API_KEY: str

    STORAGE_BACKEND: str = "local"  # "local" or "r2"

    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = ""
    R2_ENDPOINT_URL: str = ""

    EMAIL_API_KEY: str = ""
    EMAIL_FROM: str = ""

    N8N_WEBHOOK_BASE_URL: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
