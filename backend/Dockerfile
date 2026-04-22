FROM mcr.microsoft.com/playwright/python:v1.49.1-jammy

WORKDIR /app

# Install system dependencies for asyncpg/database if any (though asyncpg is usually fine)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Browsers are already installed in this image, but we ensure chromium is there
RUN playwright install chromium

COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
