import dotenv from "dotenv";
if (process.env.NODE != "PRODUCTION") {
  dotenv.config();
}

import Express from "express";
import Fs from "node:fs";
import pg from "pg";
import Bull from "bull";

const pool = new pg.Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DB,
  password: process.env.PG_PASS,
  port: process.env.PG_PORT,
});

import moment from "moment-timezone";

moment.tz.setDefault("America/Sao_Paulo");

const logQueue = new Bull("log", { redis: { port: process.env.REDIS_PORT, host: process.env.REDIS_HOST, password: process.env.REDIS_PASS, username: process.env.REDIS_USER }});

import ProxyRouter from "./src/routes/proxy.route.js";
import TvRouter from "./src/routes/tv.route.js";
import VodRouter from "./src/routes/vod.route.js";
import generateRandomId from "./src/services/id.js";

const ApplicationInstance = Express();

logQueue.process(5, async (job, jobDone) => {
  const route = job.data.route;
  const ip = job.data.ip;
  const userAgent = job.data.agent;
  const currentDateTime = job.data.time;
  const id = generateRandomId(32);

  pool.connect((err, client, done) => {
    if (err) {
      jobDone(new Error("error connecting to db", {}));
    } else {
      const text =
        "INSERT INTO logs(id, route, ip, agent, moment) VALUES($1, $2, $3, $4, $5)";
      const values = [id, route, ip, userAgent, currentDateTime];
      client.query(text, values, (err, result) => {
        if (err) {
          jobDone(new Error("error inserting data on db", {}));
        } else {
          jobDone(undefined);
        }

        // Close the connection pool
        done();
      });
    }
  });
});

ApplicationInstance.use((request, response, next) => {
  const route = request.originalUrl;
  const ip = request.ip;
  const userAgent = request.get("user-agent");

  logQueue.add(
    {
      route: route,
      ip: ip,
      agent: userAgent,
      time: moment().format("YYYY-MM-DD HH:mm:ss"),
    },
    {
      attempts: 3,
    }
  );
  next();
});

ApplicationInstance.get("/images/:id", (request, response) => {
  const imageName = request.params.id;
  Fs.readFile(`./public/${imageName}`, (err, data) => {
    if (err) {
      Fs.readFile(`./public/not_found.gif`, (err, data) => {
        if (err) {
          return response.status(500).json({
            message: "error",
            error: "Error loading the image.",
            id: "load-image-error",
          });
        } else {
          response.setHeader("Content-Type", "image/gif");
          response.send(data);
        }
      });
    } else {
      // Set the content type to JPEG
      response.setHeader("Content-Type", "image/jpeg");
      // Send the image data
      response.send(data);
    }
  });
});

ApplicationInstance.use("/api/v1", ProxyRouter);
ApplicationInstance.use("/tv/", TvRouter);
ApplicationInstance.use("/vod/", VodRouter);

ApplicationInstance.use("/", (request, response) => {
  response.redirect(process.env.DOCS)
});

ApplicationInstance.listen(process.env.PORT, () =>
  console.log("[SERVER] Running")
);
