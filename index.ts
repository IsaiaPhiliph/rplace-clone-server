import fastify from "fastify";
import fastifyIO from "fastify-socket.io";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { fastifyCors } from "@fastify/cors";
import { fastifyStatic } from "@fastify/static";

const width = 1024;
const height = 1024;

const start_date = new Date().toLocaleString();

const imagePath = path.join(__dirname, "public/place.png");

const initialColor = { r: 255, g: 255, b: 255, alpha: 1 };

async function getInitialArray(width: number, height: number) {
  if (fs.existsSync(imagePath)) {
    const image = await sharp(imagePath).ensureAlpha().raw().toBuffer();
    return new Uint8ClampedArray(image);
  } else {
    console.log("Error reading data, creating new blank image");
    const blankImage = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: initialColor,
      },
    })
      .png()
      .raw()
      .toBuffer();
    return blankImage;
  }
}

async function downloadImage(canvasArray: Buffer | Uint8ClampedArray) {
  const image = sharp(canvasArray, {
    raw: {
      width,
      height,
      channels: 4,
    },
  });
  await image.toFile(imagePath);
}

async function main() {
  const canvasArray = await getInitialArray(width, height);

  await downloadImage(canvasArray);

  setInterval(async () => {
    await downloadImage(canvasArray);
  }, 1000);

  const rateLimiter = new RateLimiterMemory({
    points: 10, // 10 points
    duration: 1, // per second
  });

  const server = fastify();

  server.register(fastifyCors, {
    origin: "*",
  });

  server.register(fastifyIO, {
    cors: {
      origin: "*",
    },
  });

  server.register(fastifyStatic, {
    root: path.join(__dirname, "public"),
  });

  server.get("/", (req, res) => {
    res.send("Up since " + start_date);
  });

  server.get("/connected-clients", (req, res) => {
    const sockets: {
      socket_id: string;
      client_ip_address: string | undefined;
      connected_on: string;
    }[] = [];
    server.io.sockets.sockets.forEach((socket) => {
      sockets.push({
        socket_id: socket.id,
        client_ip_address: socket.handshake.headers["x-real-ip"] as string,
        connected_on: socket.handshake.time,
      });
    });
    const count = sockets.length;

    res.send({ count, sockets });
  });

  server.ready().then(() => {
    console.log(`Server listening on http://localhost:${port}`);

    server.io.on("connection", (socket) => {
      console.log("Client connected to socket: ", socket.id);
      socket.on("pixel", async (pixel) => {
        // console.log("Recieved pixel: ", pixel, " Timestamp: ", timestamp);
        try {
          await rateLimiter.consume(
            socket.handshake.headers["x-real-ip"] as string
          );
          const [x, y, r, g, b] = pixel;
          const index = (width * y + x) * 4;

          const original_r = canvasArray[index];
          const original_g = canvasArray[index + 1];
          const original_b = canvasArray[index + 2];

          if (original_r !== r || original_g !== g || original_b !== b) {
            canvasArray[index] = r;
            canvasArray[index + 1] = g;
            canvasArray[index + 2] = b;
            canvasArray[index + 3] = 255;
            socket.broadcast.emit("pixel", pixel);
          }
        } catch (rejRes) {
          socket.disconnect(true);
        }
      });
    });
  });

  const port = Number(process.env.PORT) || 8080;

  server.listen({
    port,
    host: "0.0.0.0",
  });
}

main();
