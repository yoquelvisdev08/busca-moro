FROM mcr.microsoft.com/playwright/python:v1.49.0-jammy

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl gnupg ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g lighthouse@12.2.1

COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

RUN playwright install --with-deps chromium

COPY ./auditor ./auditor
COPY ./config ./config

ENV AUDITOR_SCREENSHOT_DIR=/app/storage/screenshots
RUN mkdir -p /app/storage/screenshots

RUN echo '#!/bin/sh' > /usr/local/bin/auditor-entry \
    && echo 'CHROME_BIN=$(find /ms-playwright -type f -name "chrome" 2>/dev/null | head -1)' >> /usr/local/bin/auditor-entry \
    && echo 'if [ -z "$CHROME_BIN" ]; then CHROME_BIN=$(find /root/.cache/ms-playwright -type f -name "chrome" 2>/dev/null | head -1); fi' >> /usr/local/bin/auditor-entry \
    && echo 'export CHROME_PATH="$CHROME_BIN"' >> /usr/local/bin/auditor-entry \
    && echo 'echo "[auditor] CHROME_PATH=$CHROME_PATH"' >> /usr/local/bin/auditor-entry \
    && echo 'exec "$@"' >> /usr/local/bin/auditor-entry \
    && chmod +x /usr/local/bin/auditor-entry

ENTRYPOINT ["/usr/local/bin/auditor-entry"]
CMD ["python", "-m", "auditor.worker"]
