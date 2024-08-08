FROM mcr.microsoft.com/playwright:v1.46.0-jammy

WORKDIR /tmp/test

COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ENV CI=true
CMD ["npx", "playwright", "test"]
