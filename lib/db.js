// 账号数据库：Node 24 内置的 node:sqlite，不引第三方驱动。
//
// DatabaseSync 是同步 API，所以不需要写入队列 —— 唯一约束和事务都交给 sqlite。
// 建表用 IF NOT EXISTS 幂等执行，没有迁移工具；改表结构时记得手动处理已有的 .data/auth.db。

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const DIR = join(process.cwd(), ".data");
const FILE = join(DIR, "auth.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  nickname      TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS codes (
  email      TEXT PRIMARY KEY,
  code_hash  TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  sent_at    INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

function open() {
  mkdirSync(DIR, { recursive: true });
  const handle = new DatabaseSync(FILE);
  handle.exec("PRAGMA journal_mode = WAL");
  handle.exec(SCHEMA);
  return handle;
}

// dev 热更新会重新执行模块，每次都 new 一个句柄会攒一堆连接，所以挂在 globalThis 上。
const globalRef = globalThis;
export const db = (globalRef.__lingxiDb ??= open());
