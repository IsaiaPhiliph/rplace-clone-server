import fastify from "fastify";
import fastifyCors from "fastify-cors";
import fastifyIO from "fastify-socket.io";
import fs from "fs";
import path from "path";
import fastifyStatic from "fastify-static";
import sharp from "sharp";
import { RateLimiterMemory } from "rate-limiter-flexible";

const width = 1024;
const height = 1024;

const start_date = new Date().toLocaleString();

const imagePath = path.join(__dirname, "public/place.png");

const initialColor = { r: 255, g: 255, b: 255, alpha: 1 };

const getInitialArray = async (width: number, height: number) => {
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
};

async function downloadImage(canvasArray: Buffer | Uint8ClampedArray) {
  const image = sharp(canvasArray, {
    raw: {
      width,
      height,
      channels: 4,
    },
  });
  await image.toFile(imagePath);
  // console.log("Downloaded image");
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

  server.ready().then(() => {
    server.io.on("connection", (socket) => {
      console.log("Client connected to socket: ", socket.id);
      socket.on("pixel", async (pixel) => {
        // console.log("Recieved pixel: ", pixel, " Timestamp: ", timestamp);
        try {
          await rateLimiter.consume(socket.handshake.address);
          const [x, y, r, g, b] = pixel;
          const index = (width * y + x) * 4;
          canvasArray[index] = r;
          canvasArray[index + 1] = g;
          canvasArray[index + 2] = b;
          canvasArray[index + 3] = 255;
          socket.broadcast.emit("pixel", pixel);
        } catch (rejRes) {
          socket.disconnect(true);
        }
      });
    });
  });

  server.listen(process.env.PORT || 8080);
}

main();
