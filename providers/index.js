var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};
const streamingcommunity = require("./streamingcommunity");
const guardahd = require("./guardahd");
const guardaserie = require("./guardaserie");
const guardoserie = require("./guardoserie");
const animeunity = require("./animeunity");
function getStreams(id, type, season, episode) {
  return __async(this, null, function* () {
    const streams = [];
    const normalizedType = type.toLowerCase();
    console.log(`[MultiProvider] Requesting streams for ${id} (${type})`);
    const promises = [];
    promises.push(
      animeunity.getStreams(id, normalizedType, season, episode).then((streams2) => ({ provider: "AnimeUnity", streams: streams2, status: "fulfilled" })).catch((error) => ({ provider: "AnimeUnity", error, status: "rejected" }))
    );
    promises.push(
      streamingcommunity.getStreams(id, normalizedType, season, episode).then((streams2) => ({ provider: "StreamingCommunity", streams: streams2, status: "fulfilled" })).catch((error) => ({ provider: "StreamingCommunity", error, status: "rejected" }))
    );
    if (normalizedType === "movie") {
      promises.push(
        guardahd.getStreams(id, normalizedType, season, episode).then((streams2) => ({ provider: "GuardaHD", streams: streams2, status: "fulfilled" })).catch((error) => ({ provider: "GuardaHD", error, status: "rejected" }))
      );
      promises.push(
        guardoserie.getStreams(id, normalizedType, season, episode).then((streams2) => ({ provider: "Guardoserie", streams: streams2, status: "fulfilled" })).catch((error) => ({ provider: "Guardoserie", error, status: "rejected" }))
      );
    }
    if (normalizedType === "tv") {
      promises.push(
        guardaserie.getStreams(id, normalizedType, season, episode).then((streams2) => ({ provider: "Guardaserie", streams: streams2, status: "fulfilled" })).catch((error) => ({ provider: "Guardaserie", error, status: "rejected" }))
      );
      promises.push(
        guardoserie.getStreams(id, normalizedType, season, episode).then((streams2) => ({ provider: "Guardoserie", streams: streams2, status: "fulfilled" })).catch((error) => ({ provider: "Guardoserie", error, status: "rejected" }))
      );
    }
    const results = yield Promise.all(promises);
    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.streams && result.streams.length > 0) {
          console.log(`[MultiProvider] ${result.provider} found ${result.streams.length} streams`);
          streams.push(...result.streams);
        }
      } else {
        console.error(`[MultiProvider] ${result.provider} error:`, result.error);
      }
    }
    return streams;
  });
}
module.exports = { getStreams };
