export async function handleApi(req,res) { res.writeHead(503,{'Content-Type':'application/json'}).end(JSON.stringify({error:'History is getting ready.'})); }
