import cheerio from 'cheerio';

async function fetchData(id, movie) {
  try {
    const response = await fetch(
      `https://embedder.net/ajax/get_stream_link?id=${id}&movie=${movie}&is_init=false&captcha=&ref=`,
      {
        method: "GET",
        headers: {
          accept: "application/json, text/javascript, */*; q=0.01",
          "accept-language": "pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7",
          "sec-ch-ua":
            '"Chromium";v="118", "Google Chrome";v="118", "Not=A?Brand";v="99"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "x-requested-with": "XMLHttpRequest",
        },
        referrer: "https://embedder.net/e/tt13159924/1/2",
        referrerPolicy: "strict-origin-when-cross-origin",
        mode: "cors",
        credentials: "include",
      }
    );

    if (response.ok) {
      const data = await response.json();
      const callLink = data.data.link;
      return callLink;
    } else {
      console.error("A solicitação falhou com status:", response.status);
    }
  } catch (error) {
    console.error("Ocorreu um erro ao fazer a solicitação:", error);
  }
}

async function fetchRedirectUrl(link) {
  const options = {
    method: "HEAD",
    headers: {
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "accept-language": "pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      "sec-ch-ua":
        '"Chromium";v="118", "Google Chrome";v="118", "Not=A?Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "iframe",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "same-origin",
      "sec-fetch-user": "?1",
      "upgrade-insecure-requests": "1",
    },
    referrer: "https://embedder.net/e/tt13159924/1/2",
    referrerPolicy: "strict-origin-when-cross-origin",
    mode: "cors",
    credentials: "include",
    redirect: "manual",
  };

  try {
    const response = await fetch(link, options);
    if (response.status == 200) {
      throw new Error("Video does not exist or an error occurred.");
    }
    if (response.headers.get("location")) {
      const redirectUrl = response.headers.get("location");
      const extension =
        redirectUrl.split("/")[redirectUrl.split("/").length - 1];
      return extension;
    } else {
      console.log("Não houve redirecionamento.");
    }
  } catch (error) {
    console.error("Ocorreu um erro:", error);
  }
}

async function fetchVideoData(extension) {
  const url2 = `https://piroplay.xyz/player/index.php?data=${extension}&do=getVideo`;
  const options2 = {
    method: "POST",
    headers: {
      accept: "*/*",
      "accept-language": "pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "sec-ch-ua":
        '"Chromium";v="118", "Google Chrome";v="118", "Not=A?Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "x-requested-with": "XMLHttpRequest",
    },
    referrerPolicy: "no-referrer",
    body: `hash=${extension}&r=https%3A%2F%2Fembedder.net%2F`,
    mode: "no-cors",
    credentials: "include",
  };

  try {
    const response = await fetch(url2, options2);

    if (response.ok) {
      const data4 = await response.text();
      return data4;
    } else {
      console.log("Não houve redirecionamento.");
    }
  } catch (error) {
    console.error("Ocorreu um erro aqui:", error);
  }
}

async function fetchHTML(url) {
  try {
    const response = await fetch(url);

    if (response.ok) {
      const html = await response.text();
      return html;
    } else {
      throw new Error(
        `Failed to fetch the HTML. Status code: ${response.status}`
      );
    }
  } catch (error) {
    console.error("Error fetching HTML:", error);
  }
}

async function parseHTML(html) {
  const $ = cheerio.load(html);

  // Find the element with ID "embed-player" and get its data-movie-id attribute
  const embedPlayerElement = $("#embed-player");
  const movie = embedPlayerElement.attr("data-movie-id");

  const serverDropdownItems = $(".server.dropdown-item");
  var id = "";
  serverDropdownItems.each((index, element) => {
    const dataId = $(element).attr("data-id");
    if (dataId) {
      id = dataId;
    }
  });

  if (!movie) {
    throw new Error(
      "The data-movie-id attribute is not present on the element."
    );
  }

  return {
    id,
    movie,
  };
}

async function get(id) {
  const url = `https://embedder.net/e/${id}`; // Replace with the URL of the webpage you want to fetch
  const html = await fetchHTML(url);
  const data = await parseHTML(html);
  const callLink = await fetchData(data.id, data.movie);
  const extension = await fetchRedirectUrl(callLink);
  return await fetchVideoData(extension);
}

async function parseSeasons(html) {
  const $ = cheerio.load(html);

  // Find the select element with ID "season-select"
  const seasonSelect = $("#season-select");

  if (seasonSelect.length > 0) {
    const result = {};

    // Extract the options within the "season-select" element
    seasonSelect.find("option").each((index, option) => {
      const seasonNumber = $(option).attr("value");
      const seasonTitle = $(option).text();
      result[seasonNumber] = {};

      // Find the corresponding episodes select element
      const episodesSelect = $(
        `.episodes-select#sea-${seasonNumber}--episodes`
      );

      if (episodesSelect.length > 0) {
        episodesSelect.find("option").each((index, episodeOption) => {
          const episodeValue = $(episodeOption).attr("value");
          const episodeTitle = $(episodeOption).text();
          const imdbId = $(episodeOption).attr("data-imdb");
          result[seasonNumber][episodeValue] = {
            title: episodeTitle,
            id: imdbId,
          };
        });
      }
    });

    return result;
  } else {
    throw new Error('not serie')
  }
}

async function getPosters(html){
  const $ = cheerio.load(html);
  const data = [];
  $('.film-poster').each((index, element) => {
    const img = $(element).find('.film-poster-img');
    const a = $(element).find('.film-poster-ahref');
    const nome = $(element).find('.bop-name');
  
    // Verificar se encontramos a imagem, o link e o nome
    if (img.length > 0 && a.length > 0 && nome.length > 0) {
      const imageSrc = img.attr('src');
      const link = a.attr('href');
      const name = nome.text();
  
      // Criar um objeto com as informações e adicioná-lo ao array
      const obj = { image: imageSrc, name: name, id: link.replace('https://embedder.net/v/', '') };
      data.push(obj);
    }
  });
  return data;
}

async function getTrending(){
  const moviesHtml = await fetchHTML('https://embedder.net/trending/movies')
  const seriesHtml = await fetchHTML('https://embedder.net/trending/shows')
  const movieTrending = await getPosters(moviesHtml)
  const seriesTrending = await getPosters(seriesHtml)

  return {
    movies: movieTrending,
    shows: seriesTrending
  }
}

async function getRecents(){
  const moviesHtml = await fetchHTML('https://embedder.net/recent-releases/movies')
  const seriesHtml = await fetchHTML('https://embedder.net/recent-releases/shows')
  const movieTrending = await getPosters(moviesHtml)
  const seriesTrending = await getPosters(seriesHtml)

  return {
    movies: movieTrending,
    shows: seriesTrending
  }
}

function getCategories(){
  return {
    0: "Ação",
    1: "Aventura",
    2: "Animação",
    3: "Comédia",
    4: "Crime",
    5: "Documentário",
    6: "Drama",
    7: "Família",
    8: "Fantasia",
    9: "História",
    10: "Horror",
    11: "Mistério",
    12: "Romance",
    13: "Terror",
    14: "Ficção Científica",
    15: "Anime",
    16: "Reality",
  }
}

async function getAnCategorie(categorie_ids=[], page = 1, year = "", country = "", imdb_rate="", sort_by=""){
  const sort_enum = ["year", "title", "imdb_rate", "created_at"]
  if(sort_by != "" && !sort_enum.includes(sort_by)) throw new Error('Unknow sort by')

  if(imdb_rate != ""){
    const result = parseFloat(imdb_rate);
    if (isNaN(result)) {
      throw new Error('Imdb rate must to be a string float.');
    }
  }


  const categorie_enum = ['acao', 'aventura', 'animacao','comedia','crime','documentario','drama','familia','fantasia','historia','horror','misterio','romance','terror','ficcao cientifica','anime','reality']
  
  var categorie_query = ``;
  categorie_ids.forEach((cat, index) => categorie_query = (index == 0 ? categorie_query + categorie_enum[cat]: categorie_query + ',' + categorie_enum[cat]));
  
  const movieUrl = `https://embedder.net/lib/movies?genres=${encodeURIComponent(categorie_query)}&page=${page}${year ? `&year=${year}`: ""}${country ? `&country=${country}`: ""}${imdb_rate ? `&imdb_rate=${imdb_rate}`: ""}${sort_by ? `&sort_by=${sort_by}`: ""}`;
  const movieHtml = await fetchHTML(movieUrl);
  const movieData = await getPosters(movieHtml)

  const showUrl = `https://embedder.net/lib/shows?genres=${encodeURIComponent(categorie_query)}&page=${page}${year ? `&year=${year}`: ""}${country ? `&country=${country}`: ""}${imdb_rate ? `&imdb_rate=${imdb_rate}`: ""}${sort_by ? `&sort_by=${sort_by}`: ""}`;
  const showHtml = await fetchHTML(showUrl);
  const showData = await getPosters(showHtml)

  return {
    movies: movieData,
    shows: showData
  }
}

async function search(term){
  const searchUrl = `https://embedder.net/search?term=${term}`
  var html;
  try {
    const response = await fetch(searchUrl, {
      "headers": {
        "accept": "text/html, */*; q=0.01",
        "accept-language": "pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "sec-ch-ua": "\"Chromium\";v=\"118\", \"Google Chrome\";v=\"118\", \"Not=A?Brand\";v=\"99\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "x-requested-with": "XMLHttpRequest"
      },
      "referrer": "https://embedder.net/",
      "referrerPolicy": "strict-origin-when-cross-origin",
      "body": null,
      "method": "GET",
      "mode": "cors",
      "credentials": "include"
    });

    if (response.ok) {
     html = await response.text();
    } else {
      throw new Error(
        `Failed to fetch the HTML. Status code: ${response.status}`
      );
    }
  } catch (error) {
    console.error("Error fetching HTML:", error);
  }

  const data = await getPosters(html)
 
  return data;
}

async function getSeason(id){
  const PageHtml = await fetchHTML(`https://embedder.net/v/${id}`);
  const seasonData = await parseSeasons(PageHtml);
  return seasonData
}

async function fetchContent(id){
    const PageHtml = await fetchHTML(`https://embedder.net/v/${id}`);
    try{
        const SeasonsHtml = await parseSeasons(PageHtml);
        console.log('ix, é serie que tu quer? entao toma')
        console.log(SeasonsHtml)
    }catch(e){
        console.log('C ta procurando um filme? beleza, aqui seu resultado')
        await get(id)
    }
}

export default {
  getSeason,
  getAnCategorie,
  getCategories,
  getTrending,
  getRecents,
  fetchData,
  fetchContent,
  fetchHTML,
  parseHTML,
  get,
  parseSeasons,
  search
}