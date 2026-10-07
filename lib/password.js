// 密码哈希：node:crypto 的 scrypt，不引 bcrypt。
//
// 用异步版 —— scryptSync 会把事件循环堵住（单线程下每次登录约 100ms，并发登录直接排队）。
// 长度上限不是洁癖：scrypt 的开销随输入走，无上限的密码就是一个免费的 CPU 放大器。

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const derive = promisify(scrypt);
const KEY_LEN = 64;

export const MIN_PASSWORD_LEN = 8;
export const MAX_PASSWORD_LEN = 128;

/** @returns {Promise<{salt: string, hash: string}>} 都是 hex */
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await derive(password, salt, KEY_LEN)).toString("hex");
  return { salt, hash };
}

/**
 * timingSafeEqual 在长度不等时会抛错，所以比的是两个定宽 hex 摘要，
 * 绝不能把用户输入直接塞进去。
 */
export async function verifyPassword(password, salt, expectedHash) {
  const actual = Buffer.from((await derive(password, salt, KEY_LEN)).toString("hex"), "utf8");
  const expected = Buffer.from(expectedHash, "utf8");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/**
 * 邮箱不存在时也烧掉一次同等的 scrypt。不这么做，「账号不存在」会比
 * 「密码错误」快两位数毫秒，响应时间本身就把账号是否存在说出去了。
 */
export async function burnDummyHash() {
  await derive("dummy-password", "0".repeat(32), KEY_LEN);
}
