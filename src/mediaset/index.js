const { getOfficialStreams } = require('../official_vod.js');

async function getStreams(id, type, season, episode, providerContext = null) {
  return getOfficialStreams('mediaset', id, type, season, episode, providerContext || {});
}

module.exports = { getStreams };
