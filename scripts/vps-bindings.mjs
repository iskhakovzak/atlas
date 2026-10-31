import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { readFile, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

/** SQLite implements only the D1 surface used by Atlas; batches are atomic. */
export function openAtlasDatabase(filename) {
  mkdirSync(path.dirname(filename), {recursive:true,mode:0o700});
  const sqlite=new DatabaseSync(filename);
  sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  class Statement {
    constructor(sql,values=[]) {this.sql=sql;this.values=values;}
    bind(...values) {return new Statement(this.sql,values);}
    execute() {
      const started=performance.now(),statement=sqlite.prepare(this.sql);
      const rows=statement.columns().length?statement.all(...this.values):[];
      const result=statement.columns().length?null:statement.run(...this.values);
      const changes=result?.changes??(/^(?:INSERT|UPDATE|DELETE|REPLACE)\b/i.test(this.sql.trim())?sqlite.prepare('SELECT changes() AS n').get().n:0);
      return {success:true,results:rows.map(row=>({...row})),meta:{changes:Number(changes),last_row_id:Number(result?.lastInsertRowid??0),duration:performance.now()-started}};
    }
    async all() {return this.execute();}
    async run() {return this.execute();}
    async first(column) {const row=this.execute().results[0];return row?(column?row[column]:row):null;}
    async raw() {return this.execute().results.map(Object.values);}
  }
  return {
    prepare(sql) {return new Statement(sql);},
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {const results=statements.map(statement=>statement.execute());sqlite.exec('COMMIT');return results;}
      catch(error) {sqlite.exec('ROLLBACK');throw error;}
    },
    exec(sql) {sqlite.exec(sql);},
    close() {sqlite.close();},
  };
}

/** Private files never have public URLs; existing authenticated routes authorize reads. */
export function openAtlasBucket(directory) {
  mkdirSync(directory,{recursive:true,mode:0o700});
  const filename=key=>path.join(directory,createHash('sha256').update(key).digest('hex')+'.json');
  return {
    async put(key,value,options={}) {
      const data=typeof value==='string'?Buffer.from(value):value instanceof ReadableStream?Buffer.from(await new Response(value).arrayBuffer()):Buffer.from(value);
      const destination=filename(key),temporary=destination+'.'+randomUUID()+'.tmp';
      await writeFile(temporary,JSON.stringify({key,httpMetadata:options.httpMetadata??{},data:data.toString('base64')}),{mode:0o600});
      await rename(temporary,destination);
      return {key,size:data.length};
    },
    async get(key) {
      let object;
      try {object=JSON.parse(await readFile(filename(key),'utf8'));}
      catch(error) {if(error.code==='ENOENT')return null;throw error;}
      if(object.key!==key)throw new Error('Object key mismatch');
      const bytes=Buffer.from(object.data,'base64');
      return {key,size:bytes.length,httpMetadata:object.httpMetadata,body:new Response(bytes).body,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
    },
    async delete(keys) {for(const key of Array.isArray(keys)?keys:[keys])await rm(filename(key),{force:true});},
  };
}

let bindings;
export function getAtlasBindings() {
  if(bindings)return bindings;
  const root=process.env.ATLAS_DATA_DIR;
  if(!root||!path.isAbsolute(root))throw new Error('ATLAS_DATA_DIR must be an absolute persistent directory');
  const secrets=process.env.ATLAS_ENV_FILE?JSON.parse(readFileSync(process.env.ATLAS_ENV_FILE,'utf8')):{};
  const db=openAtlasDatabase(path.join(root,'atlas.sqlite'));
  db.exec('CREATE TABLE IF NOT EXISTS atlas_schema_migrations (name TEXT PRIMARY KEY);');
  const migrations=process.env.ATLAS_MIGRATIONS_DIR??path.resolve('drizzle');
  for(const file of readdirSync(migrations).filter(file=>/^\d+.*\.sql$/.test(file)).sort()) {
    // Run migrations once, transactionally, before accepting requests.
    const sql=readFileSync(path.join(migrations,file),'utf8');
    db.exec('BEGIN IMMEDIATE');
    try {
      // This module's initialization is synchronous; the query itself executes immediately.
      // Record checks use a dedicated connection before startup only.
      const check=new DatabaseSync(path.join(root,'atlas.sqlite'),{readOnly:true});
      const applied=check.prepare('SELECT 1 FROM atlas_schema_migrations WHERE name=?').get(file);check.close();
      if(!applied){db.exec(sql);db.exec(`INSERT INTO atlas_schema_migrations VALUES ('${file.replaceAll("'","''")}');`);}
      db.exec('COMMIT');
    } catch(error) {db.exec('ROLLBACK');throw error;}
  }
  // This target is a clean installation: bundled demo cards must not return on first read.
  db.exec(`INSERT OR IGNORE INTO market_settings(key,value,updated_at,updated_by) VALUES ('catalog','{"revision":0,"entries":[],"collections":[],"bundledSyncDisabled":true}',0,'atlas.clean-launch');`);
  bindings={...secrets,...process.env,DB:db,BUCKET:openAtlasBucket(path.join(root,'objects'))};
  return bindings;
}

// Lazy initialization prevents builds from opening a database or requiring production secrets.
export const env=new Proxy({}, {get:(_target,key)=>getAtlasBindings()[key]});
export function waitUntil(promise) {Promise.resolve(promise).catch(()=>console.error('Atlas background operation failed'));}
