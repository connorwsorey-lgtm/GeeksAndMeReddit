from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://ugc:ugc_dev_pass@db:5432/ugc_signals"

    # Reddit API
    reddit_client_id: str = ""
    reddit_client_secret: str = ""
    reddit_username: str = ""
    reddit_password: str = ""
    reddit_user_agent: str = "ugc-signal-scraper/1.0"

    # Anthropic
    anthropic_api_key: str = ""

    # WhatsApp (WaSenderAPI)
    wasender_api_key: str = ""
    wasender_default_recipient: str = ""

    # App
    scan_default_limit: int = 25
    classification_batch_size: int = 15

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
