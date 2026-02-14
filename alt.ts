import { DuckDBInstance } from "@duckdb/node-api";

const db = await DuckDBInstance.create(':memory:')
const conn = await db.connect();

const results = await conn.runAndRead(`select count(id) from 'https://huggingface.co/datasets/Geralt-Targaryen/books3/resolve/main/books3-00001-of-00035.parquet' limit 10`);
console.table(results.getRows())
