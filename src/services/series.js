import Redis from "ioredis";
import axios from "axios";
import generateRandomId from "./id.js";
import dotenv from "dotenv";
if (process.env.NODE != "PRODUCTION") {
  dotenv.config();
}
const redis = new Redis({
  port: process.env.REDIS_PORT,
  host: process.env.REDIS_HOST,
  password: process.env.REDIS_PASS,
  username: process.env.REDIS_USER
});

const categories = {
  0: "Lançamentos",
  1: "Aventura",
  2: "Comédia",
  3: "Crime",
  4: "Romance",
  5: "Suspense",
  6: "Terror",
  7: "Guerra",
  8: "Animação",
  9: "Família",
  10: "Ficcçaõ científica",
  11: "Mistério",
  12: "Música",
  13: "História",
  14: "Faroeste",
  15: "Drama",
  16: "Documentário",
  17: "Biografia",
  18: "Erótico",
  19: "Nacional",
  20: "Thriller",
};

const references = {
  0: "destaques",
  1: "categoria-aventura",
  2: "categoria-comedia",
  3: "categoria-crime",
  4: "categoria-romance",
  5: "categoria-suspense",
  6: "categoria-terror",
  7: "categoria-guerra",
  8: "categoria-animacao",
  9: "categoria-familia",
  10: "categoria-ficcaocientifica",
  11: "categoria-misterio",
  12: "categoria-musica",
  13: "categoria-historia",
  14: "categoria-faroeste",
  15: "categoria-drama",
  16: "categoria-documentario",
  17: "categoria-biografia",
  18: "categoria-erotico",
  19: "categoria-nacional",
  20: "categoria-thriller",
};

function getCategories() {
  return categories;
}

async function getCategoryById(id, page = 1) {
  if (!references[id]) {
    throw new Error("Categorie id dont exists");
  }
  const categorieName = references[id];
  const url = `https://appservidor.erremepe.com/ajax/appv/appv2_2_0_10.php?v=9.9.95&tipo=categoria&nome=${categorieName}&pagina=${page}&hwid=null`;

  const cache = await redis.get(`cache:categorie:${categorieName}:${page}`);
  if (cache) {
    return JSON.parse(cache);
  } else {
    const request = await axios.get(url);
    var response = request.data;

    if (response == null) {
      throw new Error("Page dont exists");
    }

    response = response.map((item) => {
      return {
        id: item.id,
        name: item.nome,
        image: item.imagem,
        original_image: item.imagem_original,
        type: item.tipo,
        serie: item.temporadas != " Temporadas",
        seasons:
          item.temporadas == " Temporadas" ? "undefined" : item.temporada,
      };
    });

    redis.setex(
      `cache:categorie:${categorieName}:${page}`,
      1 * 60 * 60 /* 1 h*/,
      JSON.stringify(response)
    );

    return response;
  }
}

async function getNews() {
  const url = `https://appservidor.erremepe.com/ajax/appv/appv2_2_0_10.php?v=9.9.95&tipo=inicio&hwid=null`;

  const cache = await redis.get(`cache:news`);
  if (cache) {
    return JSON.parse(cache);
  } else {
    const request = await axios.get(url);
    const response = request.data;

    var newResponse = {};
    response.forEach((item) => {
      if (!newResponse[item.tipo]) newResponse[item.tipo] = [];
      newResponse[item.tipo].push(item);
    });

    delete newResponse.banner_app_filme;

    redis.setex(
      `cache:news`,
      1 * 60 * 60 /* 1 h*/,
      JSON.stringify(newResponse)
    );

    return newResponse;
  }
}

async function search(term) {
  if (!term) throw new Error("Missing search term.");
  const url = `https://appservidor.erremepe.com/ajax/appv/appv2_2_0_10.php?v=9.9.95&tipo=buscar&nome=${term}&hwid=null`;

  const request = await axios.get(url);
  var response = request.data;

  response = response.map((item) => {
    return {
      id: item.id,
      name: item.nome,
      image: item.imagem,
      original_image: item.imagem_original,
      type: item.audio == "" ? "DUB" : item.audio,
      serie: item.filmeouserie == "serie",
      seasons: item.temporadas == " Temporadas" ? "undefined" : item.temporadas,
    };
  });

  return response;
}

async function getInfo(id, serie = false) {
  if (!id) throw new Error("Missing id.");
  const url = `https://cache.erremepe.com/ajax/appv/appv2_2_0_9.php?v=9.9.95&tipo=filme&id=${id}&serie=${
    serie == false ? 0 : 1
  }`;

  const cache = await redis.get(`cache:data:${id}:${serie}`);

  if (cache) {
    return JSON.parse(cache);
  } else {
    const request = await axios.get(url);
    const data = request.data;

    if (!data) throw new Error("This id dont exists");

    const synopseUrl = `https://appservidor.erremepe.com/ajax/appv/appv2_2_0_10.php?v=9.9.95&tipo=obter_synopse&id=${id}`
    const synopseRequest = await axios.get(synopseUrl);
    const synopseData = synopseRequest.data;

    const dataToReturn = {
      id: data.id,
      name: data.nome,
      image: data.imagem_original,
      seasons: data.temporada,
      synopse: synopseData.synopse,
      cast: data.elenco,
      director: data.diretor,
      classification: data.classificacao,
      duration: data.duracao,
      date: data.lancamento,
      serie: serie,
      metadata: {},
    };

    const audioType = data.audio
      ? data.audio == "DUB" || data.audio == "DUBLEG"
        ? "dublado"
        : "legendado"
      : "dublado";
    const vodType = serie ? "serie" : "filme";
    if (serie == false) {
      const playerId = data.player_pai
        .replace(/\//g, "%2F")
        .replace(/:/g, "%3A");
      const videoUrl = `http://appservidor.erremepe.com:80/ajax/appv/appv2_2_0_10.php?v=9.9.95&tipo=categoria&nome=players&id_player=${playerId}&filme_ou_serie=${vodType}&dub_ou_leg=${audioType}`;
      const videoRequest = await axios.get(videoUrl);
      const videoData = videoRequest.data;
      const id = generateRandomId(64);
      redis.setex(
        `vod:reference:${id}`,
        25 * 60 * 60 /* 24h */,
        videoData[0].link
      );
      dataToReturn.metadata["link"] = `${process.env.URL}/api/v1/watch/${id}`;
    } else {
      //pegar todas as temporadas da serie
      for (let i = 0; i < data.temporada; i++) {
        const seasonUrl = `http://appservidor.erremepe.com:80/ajax/appv/appv2_2_0_10.php?v=9.9.95&tipo=categoria&nome=episodios-serie-page&serie_id=${
          data.id
        }&serie_temporada=${i + 1}&serie_audio=${audioType}&hwid=null `;
        const seasonRequest = await axios.get(seasonUrl);
        const seasonData = seasonRequest.data;

        const episodes = await Promise.all(
          seasonData.map(async (item) => {
            const playerId = item.player_pai
              .replace(/\//g, "%2F")
              .replace(/:/g, "%3A");

            const epUrl = `http://appservidor.erremepe.com:80/ajax/appv/appv2_2_0_10.php?v=9.9.95&tipo=categoria&nome=players&id_player=${playerId}&filme_ou_serie=${vodType}&dub_ou_leg=${audioType}`;
            const epRequest = await axios.get(epUrl);
            const epData = epRequest.data;
            const id = generateRandomId(64);
            redis.setex(
              `vod:reference:${id}`,
              25 * 60 * 60 /* 24h */,
              epData[0].link
            );

            return {
              id: item.id,
              episode: item.episodio,
              name: item.nome,
              image: item.imagem_original,
              link: `${process.env.URL}/api/v1/watch/${id}`,
            };
          })
        );

        dataToReturn.metadata[i + 1] = episodes;
      }
    }

    redis.setex(
      `cache:data:${id}:${serie}`,
      4 * 60 * 60 /* 4h */,
      JSON.stringify(dataToReturn)
    );

    return dataToReturn;
  }
}

export default {
  getCategories,
  getCategoryById,
  getNews,
  search,
  getInfo,
};
