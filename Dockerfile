FROM oven/bun:1 AS builder

WORKDIR /usr/src/app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun build src/main.ts --outfile main.js --target bun


FROM oven/bun:1

WORKDIR /app
COPY --from=builder /usr/src/app/main.js .

EXPOSE ${PORT:-3000}

CMD ["bun", "run", "main.js"]