FROM node:18

WORKDIR /usr/src/app

RUN npm install -g pnpm@7.29.3

COPY pnpm-lock.yaml .

COPY package.json .

RUN pnpm install

COPY . .

RUN pnpm build

EXPOSE 8080

CMD [ "node", "index.js" ]