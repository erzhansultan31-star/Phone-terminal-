FROM node:20-bullseye

WORKDIR /app

RUN apt-get update && \
    apt-get install -y python3 make g++ git curl && \
    rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --production

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
