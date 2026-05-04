"use strict";

const baseProvider = require("../animeworld/index.js");

async function getStreams(id, type, season, episode, providerContext = null) {
  return await baseProvider.getStreams(id, type, season, episode, {
    ...(providerContext || {}),
    easyCatalogsLangIt: true,
    mappingLanguage: "it"
  });
}

module.exports = { getStreams };
