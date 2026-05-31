FROM python:3.10-slim

WORKDIR /app

# Install system dependencies needed for ONNX / building dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --default-timeout=1000 -r requirements.txt

# Set cache path for FastEmbed and pre-download model during build
# Using bge-small-en-v1.5 (384-dim, ~130MB) - fast download, excellent quality
ENV FASTEMBED_CACHE_PATH=/app/fastembed_cache
RUN python -c "from fastembed import TextEmbedding; TextEmbedding(model_name='BAAI/bge-small-en-v1.5')"

COPY . .

EXPOSE 8002

CMD ["python", "app.py"]
