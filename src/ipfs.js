import MyWorker from "./test.worker";

let workerReady = false;
const worker = new MyWorker();

worker.addEventListener(
  "message",
  ({ data }) => {
    if (data.message === "ready") workerReady = true;
  },
  {
    once: true
  }
);

export const share = async () => {
  if (!workerReady) {
    await new Promise(resolve => {
      const check = () => {
        if (workerReady) resolve();
        else setTimeout(check, 200);
      };

      setTimeout(check, 200);
    });
  }

  console.log("starting share");

  worker.postMessage({ message: "share" });

  return new Promise((resolve, reject) => {
    worker.addEventListener(
      "message",
      ({ data }) => {
        if (data.message === "share") resolve(data.hash);
        else reject("invalid message received");
      },
      {
        once: true
      }
    );
  });
};

export const download = async hash => {
  if (!workerReady) {
    await new Promise(resolve => {
      const check = () => {
        if (workerReady) resolve();
        else setTimeout(check, 200);
      };

      setTimeout(check, 200);
    });
  }

  console.log("starting download");

  worker.postMessage({ message: "download", hash });

  return new Promise((resolve, reject) => {
    worker.addEventListener(
      "message",
      ({ data }) => {
        console.log("cko asiasdfksadf");
        if (data.message === "download") {
          resolve();
        } else reject("invalid message received");
      },
      {
        once: true
      }
    );
  });
};
