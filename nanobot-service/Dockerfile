FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
        PYTHONPATH=/data/nanobot/workspace/skills:/opt/nanobot/custom_skills:${PYTHONPATH:-} \
        PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
        PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# System deps + Git + Node.js >= 18 for WhatsApp bridge.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash \
        ca-certificates \
        curl \
        git \
        gnupg \
        build-essential \
        chromium \
        chromium-sandbox \
        libgbm1 \
        libnss3 \
        libatk-bridge2.0-0 \
        libx11-xcb1 \
        libxcomposite1 \
        libxdamage1 \
        libxrandr2 \
        libasound2 \
        libpangocairo-1.0-0 \
        libxshmfence1 \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
        | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" \
        > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt

# Clone official nanobot repository.
RUN git clone https://github.com/HKUDS/nanobot.git

WORKDIR /opt/nanobot

# Install nanobot from source in editable mode.
RUN pip install -e .

# Install WhatsApp bridge
COPY package.json whatsapp-bridge.js /opt/nanobot/
RUN cd /opt/nanobot && npm install --production

# Bundle default custom skills into image.
COPY skills/ /opt/nanobot/custom_skills/
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Runtime folders for config/workspace persistence.
RUN mkdir -p /data/nanobot/config /data/nanobot/workspace /data/nanobot/custom_skills

EXPOSE 18790

ENTRYPOINT ["/entrypoint.sh"]
