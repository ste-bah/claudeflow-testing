"""Market Terminal Backend - package setup."""
from pathlib import Path
from setuptools import find_packages, setup


def read_requirements() -> list[str]:
    """Read dependencies from requirements.txt."""
    req_file = Path(__file__).parent / "requirements.txt"
    lines = req_file.read_text().splitlines()
    return [line.strip() for line in lines if line.strip() and not line.startswith("#")]


setup(
    name="market-terminal-backend",
    version="0.1.0",
    packages=find_packages(),
    install_requires=read_requirements(),
    python_requires=">=3.11",
)
