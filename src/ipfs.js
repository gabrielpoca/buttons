import _ from "lodash";
import IPFS from "ipfs";
import blobToBuffer from "blob-to-buffer";

import db from "./db";

const options = {
  EXPERIMENTAL: {
    pubsub: true
  },
  repo: "ipfs-buttons",
  config: {
    Addresses: {
      Swarm: [
        "/dns4/ws-star.discovery.libp2p.io/tcp/443/wss/p2p-websocket-star"
      ]
    }
  }
};

let node;

export const share = async () => {
  if (!node) {
    node = new IPFS(options);

    await new Promise(resolve => {
      node.once("start", async () => {
        resolve();
      });
    });
  }

  const keys = await db.keys.toArray();

  const files = await Promise.all(
    keys.map(async key => {
      const buffer = await new Promise((resolve, reject) => {
        blobToBuffer(key.blob, (err, buffer) => {
          if (err) return reject(err);
          resolve(buffer);
        });
      });

      return {
        iFile: (await node.add({
          path: key.key,
          content: buffer
        }))[0],
        key: key.key
      };
    })
  );

  console.log(files);

  const content = _.flatten(files)
    .map(f => `${f.key}:${f.iFile.hash}`)
    .join(",");

  const shareFile = await node.add({
    path: "buttons",
    content: IPFS.Buffer.from(content)
  });

  return shareFile[0].hash;
};

export const download = async hash => {
  if (!node) {
    node = new IPFS(options);

    await new Promise(resolve => {
      node.once("start", async () => {
        resolve();
      });
    });
  }

  const file = (await node.get(hash))[0];

  const files = file.content
    .toString()
    .split(",")
    .map(part => {
      const [key, hash] = part.split(":");

      return {
        key,
        hash
      };
    });

  await Promise.all(
    files.map(async file => {
      const gotFile = (await node.get(file.hash))[0];
      console.log(gotFile.content.buffer);

      db.keys.put({
        blob: new Blob([gotFile.content.buffer], {
          type: "audio/ogg; codecs=opus"
        }),
        key: file.key
      });
    })
  );

  window.location.reload();
};
