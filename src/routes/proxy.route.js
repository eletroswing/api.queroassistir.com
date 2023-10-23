import { Router } from "express";
import RequestLib from "request";
import path from "path";
import Fs from "node:fs";
import Redis from "ioredis";
import dotenv from "dotenv";
if (process.env.NODE != "PRODUCTION") {
  dotenv.config();
}
const ProxyRouter = Router();

const redis = new Redis({
  url: process.env.REDIS_URL
});

ProxyRouter.get("/proxy/channel/:content", (request, response) => {
  const regex = /^\d{5,6}\.m3u8$/;
  const urlRegex = /https?:\/\/[^\s]+/g;

  if (!regex.test(request.params.content))
    return response.status(400).json({
      message: "error",
      error: "Send a valid content.",
      id: "invalid-content",
    });

  try {
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${request.params.content}.m3u8"`
    );

    const fileStream = Fs.createReadStream(
      path.resolve(`${process.env.TV_FILE_M3U8}/${request.params.content}`)
    );
    fileStream.pipe(response);
  } catch (e) {
    return response.status(500).json({
      message: "error",
      error: "Content doest exists.",
      id: "content-dont-exists",
    });
  }
});

ProxyRouter.get("/proxy/m3u8", async (request, response_api) => {
  const url = request.query.url;
  const regex = /\/hls/g;
  if (!url)
    return response_api.status(400).json({
      message: "error",
      error: "Missing url.",
      id: "missing-url",
    });

  try {
      RequestLib.get(url, {
        followAllRedirects: true,
        headers: {
          accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
          "upgrade-insecure-requests": "1",
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
        },
      })
        .on("response", (response) => {
          if (response.statusCode === 200) {
            response.on("data", (chunk) => {              
              chunk = chunk
                .toString("utf-8")
                .replace(
                  regex,
                  `${process.env.URL}/api/v1/proxy/ts?url=http://${response.request.uri.host}/hls`
                );

              response_api.setHeader('Content-Disposition', `attachment; filename="${url}.m3u8"`);
              response_api.write(chunk);
            });
            response.on("end", () => {
              response_api.end();
            });
          } else {
            response_api.writeHead(response.statusCode);
            response_api.end();
          }
        })
        .on("error", () => {
          response_api.writeHead(500);
          response_api.end("off line");
          return response_api.status(500).json({
            message: "error",
            error: "Content off-line.",
            id: "of-content",
          });
        });
  } catch (e) {
    //TODO: when live  is offline, redirect to a placeholder stream
    return response_api.status(500).json({
      message: "error",
      error: "Content off-line.",
      id: "of-content",
    });
  }
});

ProxyRouter.get("/proxy/ts", async (request, response_api) => {
  const url = request.query.url;

  if (!url)
    return response_api.status(400).json({
      message: "error",
      error: "Missing url.",
      id: "missing-url",
    });

  try {
    RequestLib.get(url, {
      followAllRedirects: true,
      headers: {
        accept: "*/*",
        "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "cache-control": "no-cache",
        pragma: "no-cache",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
      },
    })
      .on("response", (response) => {
        if (response.statusCode === 200) {
          response_api.writeHead(200, response.headers);
          response.on("data", (chunk) => {
            response_api.write(chunk);
          });
          response.on("end", () => {
            response_api.end();
          });
        } else {
          response_api.writeHead(response.statusCode);
          response_api.end();
        }
      })
      .on("error", () => {
        return response_api.status(500).json({
          message: "error",
          error: "Content off-line.",
          id: "of-content",
        });
      });
  } catch (e) {
    //TODO: when live  is offline, redirect to a placeholder stream
    return response_api.status(500).json({
      message: "error",
      error: "Content off-line.",
      id: "of-content",
    });
  }
});

ProxyRouter.get('/watch/:id', async (request, response) => {
  const item = await redis.get(`vod:reference:${request.params.id}`);
  if(!item) return response.status(404).json({
    message: "error",
    error: "Video doest exists.",
    id: "video-dont-exists",
  }); 

  response.setHeader('Content-Disposition', `attachment; filename="${request.params.id}.m3u8"`)
  response.send(`#EXTM3U
  
${item}`)
})

export default ProxyRouter;
