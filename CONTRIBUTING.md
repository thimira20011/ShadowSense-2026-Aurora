# Contributing to ShadowSense Aurora

## Git Workflow

1. **Create feature branch**:
   ```bash
   git checkout -b feature/description
   ```

2. **Make changes** in your assigned component:
   - M1: Backend (`backend/`)
   - M2: Extension (`extension/`)
   - M3: ML Pipeline (`ml-pipeline/`)
   - M4: Tests & Docs (`tests/`, `docs/`)

3. **Test your changes**:
   ```bash
   ./scripts/run_tests.sh
   ```

4. **Commit with descriptive message**:
   ```bash
   git commit -m "feat: add feature description"
   ```

5. **Push and create Pull Request**:
   ```bash
   git push origin feature/description
   ```

## Code Style

- **Python**: PEP 8, type hints required
- **TypeScript**: ESLint configuration enforced
- **React**: Functional components with hooks

## Testing Requirements

- Unit tests for all new functions
- Integration tests for new features
- All tests must pass before merge
- Maintain >80% code coverage

## Documentation

- Update README for major changes
- Document API endpoints in docstrings
- Add examples for complex features
- Update architecture.md if changing system design
