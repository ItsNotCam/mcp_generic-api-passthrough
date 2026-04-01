FROM oven:bun@latest

ARG PORT=3000
ENV PORT=${PORT}

WORKDIR /usr/src/app
COPY . .
RUN bun i

EXPOSE ${PORT}

CMD ["bun", "run", "start"]