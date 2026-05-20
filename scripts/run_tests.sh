#!/bin/bash
# Run all tests

echo "Running unit tests..."
pytest tests/unit/ -v

echo "Running integration tests..."
pytest tests/integration/ -v

echo "All tests completed"
