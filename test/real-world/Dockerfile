FROM mcr.microsoft.com/playwright:v1.50.0-noble

WORKDIR /tmp/test

COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ENV CI=true
CMD ["npx", "playwright", "test"]
