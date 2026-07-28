import mysql from 'mysql2/promise';
import { MYSQL_INSIGHT_PASSWORD, DB_PASS } from '$env/static/private';

// ROSI DB — direct connection (whitelisted on live server)
const pool1 = mysql.createPool({
  host: "102.165.56.61",
  port: 3369,
  user: "Insight",
  password: MYSQL_INSIGHT_PASSWORD,
  database: "rosi",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 5000
});

// Insight-2 DB
const pool2 = mysql.createPool({
  host: "77.72.2.151",
  user: "logintoapp_insight3",
  password: DB_PASS,
  database: "logintoapp_live",
  waitForConnections: true,
  connectionLimit: 25,
  queueLimit: 0
});

export async function executeQuery(query, params = []) {
  // Dev: route via live server proxy
  if (process.env.NODE_ENV !== 'production') {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch('https://insight3.logintoapp.com/rosi-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: 'oijweoijidjowijiojdeiojwioeiodj', query, params }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      return { data: json.data, connected: true, usingFakeData: false };
    } catch (proxyError) {
      console.warn("ROSI proxy unavailable:", proxyError.message);
      return { data: [], connected: false, usingFakeData: false, error: proxyError.message };
    }
  }

  // Production: direct connection
  try {
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('ETIMEDOUT')), 5000));
    const conn = await Promise.race([pool1.getConnection(), timeoutPromise]);
    try {
      const [rows] = await Promise.race([
        conn.query(query, params),
        new Promise((_, reject) => setTimeout(() => reject(new Error('ETIMEDOUT')), 5000))
      ]);
      return { data: rows, connected: true, usingFakeData: false };
    } finally {
      conn.release();
    }
  } catch (error) {
    console.warn("ROSI unavailable:", error.message);
    return { data: [], connected: false, usingFakeData: false, error: error.message };
  }
}

export async function insightQuery(query, params = []) {
  try {
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('ETIMEDOUT')), 10000));
    const conn = await Promise.race([pool2.getConnection(), timeoutPromise]);
    try {
      const [rows] = await Promise.race([
        conn.query(query, params),
        new Promise((_, reject) => setTimeout(() => reject(new Error('ETIMEDOUT')), 10000))
      ]);
      return { data: rows, connected: true, usingFakeData: false };
    } finally {
      conn.release();
    }
  } catch (error) {
    console.warn("Insight DB unavailable:", error.message);
    return { data: [], connected: false, usingFakeData: false, error: error.message };
  }
}
