import _ from "lodash";
import IPFS from "ipfs";
import blobToBuffer from "blob-to-buffer";

import db from "./db";

let node;
let ready = false;

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

(async () => {
  node = new IPFS(options);

  await new Promise(resolve => {
    node.once("start", async () => {
      resolve();
    });
  });

  ready = true;
  self.postMessage({ message: "ready" });
})();

async function handleShare() {
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
  const content = _.flatten(files)
    .map(f => `${f.key}:${f.iFile.hash}`)
    .join(",");
  const shareFile = await node.add({
    path: "buttons",
    content: IPFS.Buffer.from(content)
  });

  postMessage({
    message: "share",
    hash: shareFile[0].hash
  });
}

async function handleDownload(hash) {
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

  postMessage({
    message: "download"
  });
}

addEventListener("message", async event => {
  if (!ready) return console.log("worker not ready");

  if (event.data.message === "share") {
    handleShare();
  } else if (event.data.message === "download") {
    handleDownload(event.data.hash);
  }
});
