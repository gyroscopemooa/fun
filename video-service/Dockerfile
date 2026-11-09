FROM node:24-bookworm-slim AS node
FROM python:3.12-slim-bookworm
COPY --from=node /usr/local/bin/node /usr/local/bin/node
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY container/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY container/ ./
RUN useradd --create-home app && mkdir /tmp/manytool-video && chown app:app /tmp/manytool-video
USER app
ENV HOST=0.0.0.0 PORT=8080 PYTHONUNBUFFERED=1
EXPOSE 8080
CMD ["python", "server.py"]
