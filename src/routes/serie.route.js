import { Router } from "express";
import SerieService from "./../services/series.js";

const SerieRouter = Router();

SerieRouter.get("/categories", (request, response) => {
  response.status(200).json(SerieService.getCategories());
});

SerieRouter.get("/categories/:id", async (request, response) => {
  try {
    const page = request.query.page
      ? request.query.page < 1
        ? 1
        : request.query.page
      : 1;
    const categorieData = await SerieService.getCategoryById(request.params.id, page);
    return response.status(200).json(categorieData);
  } catch (e) {
    return response.status(400).json({
      message: "error",
      error: "Unknow reference for that category.",
      id: "unknow-reference",
    });
  }
});

SerieRouter.get("/news", async (request, response) => {
  try {
    const newsData = await SerieService.getNews();
    return response.status(200).json(newsData);
  } catch (e) {
    return response.status(500).json({
      message: "error",
      error: "Server Internal Error.",
      id: "internal-error",
    });
  }
});

SerieRouter.get("/search", async (request, response) => {
  try {
    const term = request.query.t;
    if(!term) return response.status(400).json({
      message: "error",
      error: "Missing search term.",
      id: "missing-term",
    });
    const searchData = await SerieService.search(term);
    return response.status(200).json(searchData);
  } catch (e) {
    return response.status(500).json({
      message: "error",
      error: "Server Internal Error.",
      id: "internal-error",
    });
  }
});

SerieRouter.get("/info/:id", async (request, response) => {
  try {
    const data = await SerieService.getInfo(request.params.id, Boolean(request.query.serie))
    return response.status(200).json(data);
  } catch (e) {
    return response.status(500).json({
      message: "error",
      error: "Server Internal Error.",
      id: "internal-error",
    });
  }
});

export default SerieRouter;
