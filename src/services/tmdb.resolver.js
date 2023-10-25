import dotenv from "dotenv";
if (process.env.NODE != "PRODUCTION") {
  dotenv.config();
}

import fs from "node:fs";

async function GetTmdbIdByImdbIdWithType(imdb_id) {
  const url = `https://api.themoviedb.org/3/find/${imdb_id}?api_key=${process.env.TMDB_KEY}&external_source=imdb_id&language=pt-Br`;
  const data = await fetch(url, {
    method: "GET",
  });

  const response = await data.json();

  var id = "";
  var type = "";
  Object.keys(response).forEach((key) => {
    if (response[key].length) id = response[key][0].id;
    if (response[key].length) type = response[key][0].media_type;
  });

  return { id, type };
}

async function GetItemInfo(tmdb_id, type = "tv") {
  const url = `https://api.themoviedb.org/3/${type}/${tmdb_id}?api_key=${process.env.TMDB_KEY}&language=pt-BR&append_to_response=images,videos`;
  const data = await fetch(url, {
    method: "GET",
  });

  const response = await data.json();

  const interactions = Math.ceil(response.number_of_seasons / 20);

  if (response.episode_run_time) {
    const seasonData = [response];
    for (let i = 0; i < interactions; i++) {
      var query = ``;
      for (
        let j = 0;
        j <
        (response.number_of_seasons <= 20 ? response.number_of_seasons : 20);
        j++
      ) {
        query = query + `season/${20 * i + (j + 1)}`;
        if (
          j !=
          (response.number_of_seasons <= 20 ? response.number_of_seasons : 20) -
            1
        )
          query = query + ",";
      }
      const url2 = `https://api.themoviedb.org/3/tv/${tmdb_id}?api_key=${process.env.TMDB_KEY}&language=pt-BR&append_to_response=${query}`;
      const data2 = await (await fetch(url2)).json();
      seasonData.push(data2);
    }

    const mergedObject = {};
    seasonData.forEach((infoData) => {
      Object.keys(infoData).forEach((key) => {
        if (!mergedObject.hasOwnProperty(key)) {
          mergedObject[key] = infoData[key];
        }
      });
    });

    return mergedObject;
  }

  return response;
}

function FormatItemData(data) {
  delete data.adult;
  delete data.id;
  if (data.seasons) {
    if (data.seasons[0].name == "Especiais") data.seasons.shift();
    data.seasons = data.seasons.map((item) => {
      delete item.id;
      return item;
    });
    Object.keys(data).forEach((key) => {
      if (key.startsWith("season/")) {
        const seasonId = Number(key.replace("season/", "")) - 1;
        const seasonData = data[key];
        const episodes = seasonData.episodes.map((item) => {
          delete item.id;
          delete item.show_id;
          return item;
        });
        data.seasons[seasonId].episodes = episodes;
        delete data[key];
      }
    });
  }

  return data;
}

export default {
  GetTmdbIdByImdbIdWithType,
  GetItemInfo,
  FormatItemData,
};
