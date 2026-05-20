.PHONY: help install-backend install-extension install-ml test run-backend build-extension clean

help:
	@echo "ShadowSense Aurora - Available Commands"
	@echo "======================================="
	@echo "install-backend      Install backend dependencies"
	@echo "install-extension    Install extension dependencies"
	@echo "install-ml          Install ML pipeline dependencies"
	@echo "run-backend         Start FastAPI backend"
	@echo "build-extension     Build Chrome extension"
	@echo "test                Run all tests"
	@echo "test-unit           Run unit tests only"
	@echo "test-integration    Run integration tests only"
	@echo "clean               Remove generated files"

install-backend:
	cd backend && pip install -r requirements.txt

install-extension:
	cd extension && npm install

install-ml:
	cd ml-pipeline && pip install -r requirements.txt

run-backend:
	cd backend && python main.py

build-extension:
	cd extension && npm run build

test:
	pytest tests/ -v

test-unit:
	pytest tests/unit/ -v

test-integration:
	pytest tests/integration/ -v

clean:
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	rm -rf backend/.venv
	rm -rf extension/node_modules
	rm -rf extension/dist
	rm -rf ml-pipeline/.venv
