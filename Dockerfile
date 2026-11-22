FROM node:24-bookworm-slim

ENV NEXT_TELEMETRY_DISABLED=1 \
    OCR_PYTHON=/opt/paddle/bin/python

ARG NEXT_PUBLIC_APP_URL=https://lapakwu.bluepack.my.id
ARG NEXT_PUBLIC_QRIS_URL=/qris.jpg
ARG NEXT_PUBLIC_KONTAK_EMAIL=
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_QRIS_URL=$NEXT_PUBLIC_QRIS_URL \
    NEXT_PUBLIC_KONTAK_EMAIL=$NEXT_PUBLIC_KONTAK_EMAIL

RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-venv libgomp1 libglib2.0-0 libgl1 curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN python3 -m venv /opt/paddle \
    && /opt/paddle/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/paddle/bin/pip install --no-cache-dir -r scripts/requirements-ocr.txt \
       --extra-index-url https://www.paddlepaddle.org.cn/packages/stable/cpu/ \
    && npm run build \
    && mkdir -p /home/node/.paddlex \
    && chown -R node:node /app/.next /opt/paddle /home/node/.paddlex

EXPOSE 3000
USER node
CMD ["npm", "start"]
