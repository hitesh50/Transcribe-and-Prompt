FROM node:20-bookworm-slim AS frontend-build

WORKDIR /ui
COPY frontend/package.json ./
COPY frontend/package-lock.json ./package-lock.json
COPY frontend/tsconfig.json ./tsconfig.json
COPY frontend/tsconfig.node.json ./tsconfig.node.json
COPY frontend/vite-node-globals.d.ts ./vite-node-globals.d.ts
COPY frontend/vite.config.ts ./vite.config.ts
COPY frontend/index.html ./index.html
COPY frontend/src ./src
RUN npm ci
RUN npm run build

FROM python:3.11-slim AS app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /srv/app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./pyproject.toml
COPY README.md ./README.md
COPY config.yaml ./config.yaml
COPY .env.example ./.env.example
COPY app ./app

RUN mkdir -p /srv/app/data/sessions /srv/app/data/insights

RUN pip install --upgrade pip \
  && pip install .

COPY --from=frontend-build /ui/dist ./app/static

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
