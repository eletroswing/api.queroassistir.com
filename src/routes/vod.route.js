import { Router, response } from "express";
import EmbedderService from "../services/embedder.resolver.js";
import TmdbService from "../services/tmdb.resolver.js";
import Redis from "ioredis";
import generateRandomId from "../services/id.js";
import RequestLib from "request";
import { Transform } from "stream";

const redis = new Redis({
  port: process.env.REDIS_PORT,
  host: process.env.REDIS_HOST,
  password: process.env.REDIS_PASS,
  username: process.env.REDIS_USER,
});

const VodRouter = Router();

VodRouter.get("/categories", (request, response) => {
  response.status(200).json(EmbedderService.getCategories());
});

VodRouter.get("/categories/get", async (request, response) => {
  try {
    const page = request.query.page
      ? request.query.page < 1
        ? 1
        : request.query.page
      : 1;

    const ids = decodeURIComponent(request.query.categories).split(",");
    const year = request.query.year ? request.query.year : "";
    const country = request.query.country ? request.query.country : "";
    const imdb_rate = request.query.imdb_rate ? request.query.imdb_rate : "";
    const sort_by = request.query.sort_by ? request.query.sort_by : "";

    const categorieData = await EmbedderService.getAnCategorie(
      ids,
      page,
      year,
      country,
      imdb_rate,
      sort_by
    );
    return response.status(200).json(categorieData);
  } catch (e) {
    return response.status(400).json({
      message: "error",
      error: e.message,
      id: "unknow-error",
    });
  }
});

VodRouter.get("/news", async (request, response) => {
  try {
    const cache = await redis.get('vod:cache:news')
    if(cache){
      return response.status(200).json(JSON.parse(cache));
    }
    const recents = await EmbedderService.getRecents();
    const trending = await EmbedderService.getTrending();
    redis.setex('vod:cache:news', 4 * 60 * 60 /* 4h */, JSON.stringify({
      recents,
      trending,
    }))
    return response.status(200).json({
      recents,
      trending,
    });
  } catch (e) {
    return response.status(500).json({
      message: "error",
      error: "Server Internal Error.",
      id: "internal-error",
    });
  }
});

VodRouter.get("/search", async (request, response) => {
  try {
    const term = request.query.t;
    if (!term)
      return response.status(400).json({
        message: "error",
        error: "Missing search term.",
        id: "missing-term",
      });

    const cache = await redis.get(`vod:search:${request.query.t}`)
    if(cache) {
      return response.status(200).json(JSON.parse(cache));
    }

    const searchData = await EmbedderService.search(term);
    redis.setex(`vod:search:${request.query.t}`, 4 * 60 * 60 /* 4h */, JSON.stringify(searchData))
    return response.status(200).json(searchData);
  } catch (e) {
    return response.status(500).json({
      message: "error",
      error: "Server Internal Error.",
      id: "internal-error",
    });
  }
});

VodRouter.get("/info/:id", async (request, response) => {
  try {
    const cache = await redis.get(`vod:info:${request.params.id}`)

    if(cache){
      return response.status(200).json(JSON.stringify(cache));
    }

    const IdAndType = await TmdbService.GetTmdbIdByImdbIdWithType(
      request.params.id
    );
    const itemData = await TmdbService.GetItemInfo(
      IdAndType.id,
      IdAndType.type
    );
    const FormatItemData = await TmdbService.FormatItemData(itemData);
    FormatItemData.type = IdAndType.type;

    if (itemData.type == "tv") {
      const meta = await EmbedderService.getSeason(request.params.id);
      FormatItemData.metadata = meta;
    } else {
      FormatItemData.metadata = { id: request.params.id };
    }

    redis.setex(`vod:info:${request.params.id}`, 4 * 60 * 60 /* 4h */, JSON.stringify(FormatItemData))
    return response.status(200).json(FormatItemData);
  } catch (e) {
    return response.status(500).json({
      message: "error",
      error: "Server Internal Error. Maybe item dont exists?",
      id: "internal-item-error",
    });
  }
});

VodRouter.get("/link/:id", async (request, response) => {
  try {
    const link = JSON.parse(await EmbedderService.get(request.params.id));
    const video_image = link.videoImage;
    const video_link = link.securedLink;

    const link_id = generateRandomId(32);
    const link_id_string = `${link_id}.m3u8`;

    redis.setex(link_id_string, 4 * 60 * 60 /* 4h */, video_link);

    return response.status(200).json({
      image: video_image,
      link: `${process.env.URL}/vod/watch/${link_id_string}`,
    });
  } catch (e) {
    return response.status(500).json({
      message: "error",
      error: "Server Internal Error. Maybe item dont exists?",
      id: "internal-item-error",
    });
  }
});

VodRouter.get("/watch/:item", async (request, response) => {
  const regex = /https/gi; 
  if (
    !request.params.item.endsWith(".m3u8") ||
    request.params.item.replace(".m3u8", "").length != 32
  )
    return response.status(400).json({
      message: "error",
      error: "Invalid watch link.",
      id: "invalid-link",
    });

  const item = await redis.get(request.params.item);
  if (!item) {
    return response.status(404).json({
      message: "error",
      error: "Content not found.",
      id: "content-not-founf",
    });
  }

  response.setHeader(
    "Content-Disposition",
    `attachment; filename="${request.params.item}"`
  );
  const meta = RequestLib(item);

  const transformStream = new Transform({
    transform(chunk, encoding, callback) {
      const data = chunk.toString();

      const modified = data.replace(regex, `${process.env.URL}/vod/proxy?url=https`);
      this.push(modified)
      callback();
    }
  });

  request.on("close", () => {
    meta.abort();
  });

  meta.pipe(transformStream).pipe(response);
});

VodRouter.get("/proxy", async (request, response) => {
  const regex = /https/gi; 

  if(!request.query.url) return response.status(400).json({
    message: "error",
    error: "Missing url",
    id: "missing url",
  });

  const meta = RequestLib(request.query.url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Safari/537.36'
    },
    method: 'GET',
  });

  meta.on("response", (res) => {
    const contentType = res.headers["content-type"]; // Aqui você obtém o Content-Type
    if(contentType){
      response.setHeader("Content-Type", contentType);
    }
  });
  
  const transformStream = new Transform({
    transform(chunk, encoding, callback) {
      this.push(chunk)
      callback();
    }
  });

  request.on("close", () => {
    meta.abort();
  });

  meta.pipe(transformStream).pipe(response);
})

export default VodRouter;
