from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://ugc:ugc_dev_pass@db:5432/ugc_signals"

    # Reddit (public JSON — no API key required)
    reddit_user_agent: str = "ugc-signal-scraper/1.0 (Fuel Results internal tool)"

    # Anthropic
    anthropic_api_key: str = ""

    # WhatsApp (WaSenderAPI)
    wasender_api_key: str = ""
    wasender_default_recipient: str = ""

    # Google Search Console OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/gsc/callback"

    # App
    scan_default_limit: int = 25
    classification_batch_size: int = 15
    max_classify_per_scan: int = 50  # max signals sent to Claude per scan
    prefilter_min_keyword_hits: int = 1  # min keyword matches to qualify for classification
    classification_model: str = "claude-haiku-4-5-20251001"  # cheap model for bulk screening
    classification_model_premium: str = "claude-sonnet-4-20250514"  # full model for high-potential

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
