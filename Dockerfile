# The app and its speech API, in one small image.
#
# Kokoro itself is not in here and is not built here: it is `remsky/Kokoro-FastAPI`,
# pulled as a published image by the compose file. Rebuilding a model server is
# not a thing this project should be doing, and the whole point of putting an
# API in front of it is that the model is a component we depend on rather than
# a thing we maintain.

# ── Build the front end ──────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Served from the root of this container rather than from the /Manifester/
# sub-path GitHub Pages needs, and pointed at the API that is one service away.
ENV MANIFESTER_BASE=/
ENV VITE_TTS_ENDPOINT=/api/tts
RUN npm run build

# ── Run ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# The server has no dependencies — it is `node:http` and the shared modules
# from `src/lib/tts`, which Node runs directly by stripping their types. So
# there is nothing to install here, and nothing in the image that is not either
# this repository or Node itself.
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/src/lib/tts ./src/lib/tts
COPY --from=build /app/src/lib/wordcraft.ts ./src/lib/wordcraft.ts
COPY --from=build /app/package.json ./package.json

ENV PORT=8787
ENV HOST=0.0.0.0
ENV PUBLIC_DIR=/app/dist
ENV SPEECH_CACHE_DIR=/data/speech
ENV SPEECH_STATIC_DIR=/app/dist/speech

RUN mkdir -p /data/speech && chown -R node:node /data
USER node

EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/api/tts/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.mjs"]
