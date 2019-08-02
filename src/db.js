import Dexie from "dexie";

const db = new Dexie("Button");

db.version(1).stores({
  keys: "key"
});

export default db;
