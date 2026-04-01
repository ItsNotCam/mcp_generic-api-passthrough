FROM oven/bun:1 

ARG PORT=3000
ENV PORT=${PORT}

WORKDIR /usr/src/app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

EXPOSE ${PORT}

CMD ["bun", "run", "start"]