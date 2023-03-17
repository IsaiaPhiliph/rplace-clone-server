FROM node:18

WORKDIR /usr/src/app

RUN apt-get update

RUN apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

RUN npm install -g pnpm@7.29.3

COPY pnpm-lock.yaml .

COPY package.json .

RUN pnpm install

COPY . .

RUN pnpm build

EXPOSE 8080

CMD [ "node", "index.js" ]