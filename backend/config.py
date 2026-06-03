"""Configuration settings for ShadowSense Aurora."""
import os
import pathlib
from dotenv import load_dotenv

# Load from the backend directory no matter where the process is started from
_HERE = pathlib.Path(__file__).parent
load_dotenv(_HERE / ".env")


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

# Groq Configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
_raw_model = os.getenv("GROQ_MODEL", "llama-4-scout")
GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct" if _raw_model == "llama-4-scout" else _raw_model

# Gemini Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Extension Configuration
EXTENSION_ID = os.getenv("EXTENSION_ID", "shadowsense-aurora")
