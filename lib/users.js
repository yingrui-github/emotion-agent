// 用户表的读写。邮箱统一小写存查，表上有 UNIQUE 约束。

import { randomUUID } from "node:crypto";
import { db } from "./db.js";
import { hashPassword } from "./password.js";

const selectByEmail = db.prepare("SELECT * FROM users WHERE email = ?");
const selectById = db.prepare("SELECT * FROM users WHERE id = ?");
const insertUser = db.prepare(
  `INSERT INTO users (id, email, nickname, password_hash, salt, created_at)
   VALUES (?, ?, ?, ?, ?, ?)`,
);

export const normalizeEmail = (email) => String(email ?? "").trim().toLowerCase();

/** 只给前端看的字段。password_hash / salt 一律不出这个文件。 */
const toPublic = (row) =>
  row ? { id: row.id, email: row.email, nickname: row.nickname } : null;

export function findByEmail(email) {
  return selectByEmail.get(normalizeEmail(email)) ?? null;
}

export function findPublicById(id) {
  return toPublic(selectById.get(String(id ?? "")));
}

/**
 * 不先查重再插入 —— 并发注册时那个检查没有意义。直接插，让 UNIQUE 约束接住。
 * @returns {{user: object} | {taken: true}}
 */
export async function createUser({ email, nickname, password }) {
  const { salt, hash } = await hashPassword(password);
  const id = randomUUID();
  try {
    insertUser.run(id, normalizeEmail(email), nickname, hash, salt, Date.now());
  } catch (err) {
    if (String(err?.code ?? err?.message).includes("UNIQUE")) return { taken: true };
    throw err;
  }
  return { user: { id, email: normalizeEmail(email), nickname } };
}
