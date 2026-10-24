import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const base=new URL('./',import.meta.url);
const files={'/':'index.html','/index.html':'index.html','/styles.css':'styles.css','/app.js':'app.js'};
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const server=http.createServer(async(req,res)=>{const path=new URL(req.url,'http://localhost').pathname;const file=files[path];if(!file){res.writeHead(404);res.end('Not found');return}try{const data=await readFile(fileURLToPath(new URL(file,base)));res.writeHead(200,{'Content-Type':mime[file.slice(file.lastIndexOf('.'))],'Cache-Control':'no-store'});res.end(data)}catch{res.writeHead(500);res.end('Preview unavailable')}});
const port=Number(process.argv[2]||4317);
server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}`));
