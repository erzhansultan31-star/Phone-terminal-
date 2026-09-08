FROM node:20-bookworm

WORKDIR /app

RUN apt-get update && \
    apt-get install -y python3 make g++ git curl tmux && \
    rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --production

COPY . .

RUN echo 'export PATH="$HOME/.local/bin:$PATH"' >> /root/.bashrc

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
