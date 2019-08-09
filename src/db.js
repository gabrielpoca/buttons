import Dexie from "dexie";

const db = new Dexie("Button");

db.version(1).stores({
  keys: "key"
});

db.version(2).stores({
  keys: "key",
  keyboards: "hash"
});

export default db;
