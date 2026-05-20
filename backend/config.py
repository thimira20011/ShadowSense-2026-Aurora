"""Configuration settings for ShadowSense Aurora."""
import os
from dotenv import load_dotenv


load_dotenv()


# API Configuration
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", 8000))
DEBUG = os.getenv("DEBUG", "False") == "True"

# Database Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///shadowsense.db")

# ML Pipeline
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-r1")
CHROMADB_PATH = os.getenv("CHROMADB_PATH", "./chromadb")

# CrewAI Configuration
CREWAI_VERBOSE = os.getenv("CREWAI_VERBOSE", "True") == "True"

# Extension Configuration
EXTENSION_ID = os.getenv("EXTENSION_ID", "shadowsense-aurora")
