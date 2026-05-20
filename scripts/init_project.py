"""Project initialization script."""
import os
import sys
import subprocess


def run_command(cmd, cwd=None):
    """Run a shell command."""
    try:
        result = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"Error: {result.stderr}")
            return False
        return True
    except Exception as e:
        print(f"Exception: {e}")
        return False


def main():
    """Initialize project structure."""
    print("🚀 ShadowSense Aurora - Project Initialization")
    print("=" * 50)
    
    # Create virtual environment for backend
    print("\n📦 Setting up backend...")
    backend_path = os.path.join(os.getcwd(), "backend")
    if not run_command("python -m venv venv", cwd=backend_path):
        print("❌ Failed to create backend virtual environment")
        return False
    print("✅ Backend virtual environment created")
    
    # Install backend dependencies
    print("\n📥 Installing backend dependencies...")
    if not run_command("pip install -r requirements.txt", cwd=backend_path):
        print("❌ Failed to install backend dependencies")
        return False
    print("✅ Backend dependencies installed")
    
    # Set up extension
    print("\n🔌 Setting up extension...")
    extension_path = os.path.join(os.getcwd(), "extension")
    if not run_command("npm install", cwd=extension_path):
        print("❌ Failed to install extension dependencies")
        return False
    print("✅ Extension dependencies installed")
    
    # Set up ML pipeline
    print("\n🤖 Setting up ML pipeline...")
    ml_path = os.path.join(os.getcwd(), "ml-pipeline")
    if not run_command("python -m venv venv", cwd=ml_path):
        print("❌ Failed to create ML pipeline virtual environment")
        return False
    print("✅ ML pipeline virtual environment created")
    
    if not run_command("pip install -r requirements.txt", cwd=ml_path):
        print("❌ Failed to install ML pipeline dependencies")
        return False
    print("✅ ML pipeline dependencies installed")
    
    print("\n" + "=" * 50)
    print("✅ ShadowSense Aurora initialized successfully!")
    print("\nNext steps:")
    print("1. Start backend: make run-backend")
    print("2. Build extension: make build-extension")
    print("3. Run tests: make test")
    
    return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
