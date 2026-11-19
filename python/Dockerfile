FROM python:3.11-slim

WORKDIR /app

# libgomp1 is required at runtime by LightGBM OpenMP threading
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*

COPY python/requirements.txt ./python/requirements.txt
RUN pip install --no-cache-dir -r python/requirements.txt

COPY python ./python
COPY server/artifacts ./server/artifacts

# Train LightGBM Booster + export SHA-256 signed artifacts at image build if missing
RUN python python/train_lightgbm.py

EXPOSE 8000
CMD ["uvicorn", "python.api:app", "--host", "0.0.0.0", "--port", "8000"]
