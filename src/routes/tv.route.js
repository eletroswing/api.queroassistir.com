import { Router } from "express";
import algolia from "algoliasearch";
import dotenv from "dotenv";
if (process.env.NODE != "PRODUCTION") {
  dotenv.config();
}
import categories from "./../data/tv/categories.json" assert { type: "json" };
import references from "./../data/tv/references.json" assert { type: "json" };

const client = algolia(process.env.ALGOLIA_CLIENT, process.env.ALGOLIA_KEY);
const index = client.initIndex(process.env.ALGOLIA_INDEX);

const TvRouter = Router();

TvRouter.get("/categories", (request, response) => {
  response.status(200).json(categories);
});

TvRouter.get("/categories/:id", (request, response) => {
  const response_ref = references[request.params.id];
  if (response_ref) {
    response.status(200).json(response_ref);
  } else {
    return response.status(400).json({
      message: "error",
      error: "Unknow reference for that category.",
      id: "unknow-reference",
    });
  }
});

TvRouter.get("/search", async (request, response) => {
  try {
    const term = request.query.t;
    if(!term) return response.status(400).json({
      message: "error",
      error: "Missing search term.",
      id: "missing-term",
    });
    const { hits } = await index.search(request.query.t, {
      hitsPerPage: 10, // Define o número de resultados desejados (neste caso, 5).
    });

    const result = hits.map(hit => {
      var dt = hit;
      delete dt.objectID;
      return dt
    })
    return response.status(200).json(result);
  } catch (e) {
    return response.status(500).json({
      message: "error",
      error: "Server Internal Error.",
      id: "internal-error",
    });
  }
});

export default TvRouter;
