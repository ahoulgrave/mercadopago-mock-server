FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production
COPY . .
EXPOSE 3001
ENV PORT=3001
CMD ["node", "src/index.js"]
