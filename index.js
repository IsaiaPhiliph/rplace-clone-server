"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const fastify_cors_1 = __importDefault(require("fastify-cors"));
const fastify_socket_io_1 = __importDefault(require("fastify-socket.io"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const fastify_static_1 = __importDefault(require("fastify-static"));
const sharp_1 = __importDefault(require("sharp"));
const width = 1024;
const height = 1024;
const start_date = new Date().toLocaleString();
const imagePath = path_1.default.join(__dirname, "public/place.png");
const initialColor = { r: 255, g: 255, b: 255, alpha: 1 };
const rateLimit = 0;
const getInitialArray = (width, height) => __awaiter(void 0, void 0, void 0, function* () {
    if (fs_1.default.existsSync(imagePath)) {
        const image = yield (0, sharp_1.default)(imagePath).ensureAlpha().raw().toBuffer();
        return new Uint8ClampedArray(image);
    }
    else {
        console.log("Error reading data, creating new blank image");
        const blankImage = yield (0, sharp_1.default)({
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
});
function downloadImage(canvasArray) {
    return __awaiter(this, void 0, void 0, function* () {
        const image = (0, sharp_1.default)(canvasArray, {
            raw: {
                width,
                height,
                channels: 4,
            },
        });
        yield image.toFile(imagePath);
        // console.log("Downloaded image");
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const canvasArray = yield getInitialArray(width, height);
        yield downloadImage(canvasArray);
        const server = (0, fastify_1.default)();
        server.register(fastify_cors_1.default, {
            origin: "*",
        });
        server.register(fastify_socket_io_1.default, {
            cors: {
                origin: "*",
            },
        });
        server.register(fastify_static_1.default, {
            root: path_1.default.join(__dirname, "public"),
        });
        server.get("/", (req, res) => {
            res.send("Up since " + start_date);
        });
        server.ready().then(() => {
            server.io.on("connection", (socket) => {
                console.log("Client connected to socket: ", socket.id);
                let lastTimestamp;
                socket.on("pixel", (pixel) => __awaiter(this, void 0, void 0, function* () {
                    const timestamp = new Date().getTime();
                    if (lastTimestamp) {
                        const diff = timestamp - lastTimestamp;
                        if (diff < rateLimit) {
                            socket.disconnect(true);
                        }
                    }
                    lastTimestamp = timestamp;
                    // console.log("Recieved pixel: ", pixel, " Timestamp: ", timestamp);
                    const [x, y, r, g, b] = pixel;
                    const index = (width * y + x) * 4;
                    canvasArray[index] = r;
                    canvasArray[index + 1] = g;
                    canvasArray[index + 2] = b;
                    canvasArray[index + 3] = 255;
                    yield downloadImage(canvasArray);
                    socket.broadcast.emit("pixel", pixel);
                }));
            });
        });
        server.listen(8080);
    });
}
main();
