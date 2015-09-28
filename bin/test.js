// Load the http module to create an http server.
var http = require('http');
var fs = require('fs');
var zlib = require('zlib');

// Configure our HTTP server to respond with Hello World to all requests.
var server = http.createServer(function (request, response) {

  var filePath = request.url;
  console.log(filePath);

  var acceptEncoding = request.headers['accept-encoding'];
  if(!acceptEncoding) {
    acceptEncoding = 'identity';
  }

  if(filePath == '/temp_name.js'){
    console.log('equal temp');
    var raw = fs.createReadStream('temp_name.js');
    if (acceptEncoding.match(/\bgzip\b/)) {
      console.log("gzip");
      response.writeHead(200, {"Content-Type": "application/javascript", "Content-Encodng":"gzip"});
      raw.pipe(zlib.createGzip()).pipe(response);
    } else {
      console.log("raw");
      response.writeHead(200, {"Content-Type": "application/javascript", "Content-Encoding":"identity"});
      raw.pipe(response);
    }

  } else if(filePath == '/jos.js'){
    console.log('equal jos.js');
    var raw = fs.createReadStream('jos.js');
    if (acceptEncoding.match(/\bgzip\b/)) {
      console.log("gzip");
      response.writeHead(200, {"Content-Type": "application/javascript", "Content-Encoding":"gzip"});
      raw.pipe(zlib.createGzip()).pipe(response);
    } else {
      console.log("raw");
      response.writeHead(200, {"Content-Type": "application/javascript", "Content-Encoding":"identity"});
      raw.pipe(response);
    }

  } else if(filePath == '/dist/js/compiler.js'){
    console.log('/dist/js/compiler.js');
    var raw = fs.createReadStream('./dist/js/compiler.js');
    if (acceptEncoding.match(/\bgzip\b/)) {
      console.log("gzip");
      response.writeHead(200, { 'Content-Encoding': 'gzip' });
      raw.pipe(zlib.createGzip()).pipe(response);
    } else {
      console.log("raw");
      response.writeHead(200, { 'Content-Encoding': 'identity'});
      raw.pipe(response);
    }

  } else if(filePath == '/dist/js/dust-core.js'){
    console.log('/dist/js/dust-core.js');
    var raw = fs.createReadStream('./dist/js/dust-core.js');
    if (acceptEncoding.match(/\bgzip\b/)) {
      console.log("gzip");
      response.writeHead(200, { 'Content-Encoding': 'gzip' });
      raw.pipe(zlib.createGzip()).pipe(response);
    } else {
      console.log("raw");
      response.writeHead(200, { 'Content-Encoding': 'identity'});
      raw.pipe(response);
    }

  } else if(filePath == '/dist/js/dust-helpers.js'){
    console.log('/dist/js/dust-helpers.js');
    var raw = fs.createReadStream('./dist/js/dust-helpers.js');
    if (acceptEncoding.match(/\bgzip\b/)) {
      console.log("gzip");
      response.writeHead(200, { 'Content-Encoding': 'gzip' });
      raw.pipe(zlib.createGzip()).pipe(response);
    } else {
      console.log("raw");
      response.writeHead(200, { 'Content-Encoding': 'identity'});
      raw.pipe(response);
    }

  } else if(filePath == '/dist/js/dust-ui-helpers.js'){
    console.log('/dist/js/dust-ui-helpers.js');
    var raw = fs.createReadStream('./dist/js/dust-ui-helpers.js');
    if (acceptEncoding.match(/\bgzip\b/)) {
      console.log("gzip");
      response.writeHead(200, { 'Content-Encoding': 'gzip' });
      raw.pipe(zlib.createGzip()).pipe(response);
    } else {
      console.log("raw");
      response.writeHead(200, { 'Content-Encoding': 'identity'});
      raw.pipe(response);
    }
  } else if(filePath == '/dist/js/parser.js'){
    console.log('/dist/js/parser.js');
    var raw = fs.createReadStream('./dist/js/parser.js');
    if (acceptEncoding.match(/\bgzip\b/)) {
      console.log("gzip");
      response.writeHead(200, { 'Content-Encoding': 'gzip' });
      raw.pipe(zlib.createGzip()).pipe(response);
    } else {
      console.log("raw");
      response.writeHead(200, { 'Content-Encoding': 'identity'});
      raw.pipe(response);
    }
  } else if(filePath == '/dist/js/jquery.min.js'){
    console.log('/dist/js/jquery.min.js');
    var raw = fs.createReadStream('./dist/js/jquery.min.js');
    if (acceptEncoding.match(/\bgzip\b/)) {
      console.log("gzip");
      response.writeHead(200, { 'Content-Encoding': 'gzip' });
      raw.pipe(zlib.createGzip()).pipe(response);
    } else {
      console.log("raw");
      response.writeHead(200, { 'Content-Encoding': 'identity'});
      raw.pipe(response);
    }
  } else if(filePath == '/dist/js/fz.js'){
    console.log('/dist/js/fz.js');
    var raw = fs.createReadStream('./dist/js/fz.js');
    if (acceptEncoding.match(/\bgzip\b/)) {
      console.log("gzip");
      response.writeHead(200, { 'Content-Encoding': 'gzip' });
      raw.pipe(zlib.createGzip()).pipe(response);
    } else {
      console.log("raw");
      response.writeHead(200, { 'Content-Encoding': 'identity'});
      raw.pipe(response);
    }
  } else if(filePath == '/dist/js/fz-1.3.8-min.js'){
    console.log('js');
    var raw = fs.createReadStream('./dist/js/fz-1.3.8-min.js');
    if (acceptEncoding.match(/\bgzip\b/)) {
      console.log("gzip");
      response.writeHead(200, { 'Content-Encoding': 'gzip' });
      raw.pipe(zlib.createGzip()).pipe(response);
    } else {
      console.log("raw");
      response.writeHead(200, { 'Content-Encoding': 'identity'});
      raw.pipe(response);
    }
  } else if(filePath == '/dist/js/bootstrap.min.js'){
    console.log('/dist/js/bootstrap.min.js');
    var raw = fs.createReadStream('./dist/js/bootstrap.min.js');
    if (acceptEncoding.match(/\bgzip\b/)) {
      console.log("gzip");
      response.writeHead(200, { 'Content-Encoding': 'gzip' });
      raw.pipe(zlib.createGzip()).pipe(response);
    } else {
      console.log("raw");
      response.writeHead(200, { 'Content-Encoding': 'identity'});
      raw.pipe(response);
    }
  } else if(filePath == '/dist/css/bootstrap.min.css'){
    console.log('/dist/css/bootstrap.min.css');
    var raw = fs.createReadStream('./dist/css/bootstrap.min.css');
    if (acceptEncoding.match(/\bgzip\b/)) {
      console.log("gzip");
      response.writeHead(200, { 'Content-Encoding': 'gzip' });
      raw.pipe(zlib.createGzip()).pipe(response);
    } else {
      console.log("raw");
      response.writeHead(200, { 'Content-Encoding': 'identity'});
      raw.pipe(response);
    }
  } else if(filePath == '/embed1'){
    console.log('equal 1');
    var raw = fs.createReadStream('./embed1.html');
    if (acceptEncoding.match(/\bgzip\b/)) {
      console.log("gzip");
      response.writeHead(200, { 'Content-Encoding': 'gzip' });
      raw.pipe(zlib.createGzip()).pipe(response);
    } else {
      console.log("raw");
      response.writeHead(200, { 'Content-Encoding': 'identity'});
      raw.pipe(response);
    }
  }else if(filePath == '/embed2'){
    console.log('equal 2');
    var raw = fs.createReadStream('./embed2.html');
    if (acceptEncoding.match(/\bgzip\b/)) {
      console.log("gzip");
      response.writeHead(200, { 'Content-Encoding': 'gzip' });
      raw.pipe(zlib.createGzip()).pipe(response);
    } else {
      console.log("raw");
      response.writeHead(200, { 'Content-Encoding': 'identity'});
      raw.pipe(response);
    }
  }else if(filePath == '/embed3'){
    console.log('equal 3');
    var raw = fs.createReadStream('./embed3.json');
    if (acceptEncoding.match(/\bgzip\b/)) {
      console.log("gzip");
      response.writeHead(200, {"Content-Type": "application/json", "X-FS-TL": "http://127.0.0.1:6661/temp_name.js", "X-FS-Template-Keys":"__default__=demo", "Content-Encoding":"gzip"});
      raw.pipe(zlib.createGzip()).pipe(response);
    } else {
      console.log("raw");
      response.writeHead(200, {"Content-Type": "application/json", "X-FS-TL": "http://127.0.0.1:6661/temp_name.js", "X-FS-Template-Keys":"__default__=demo", "Content-Encoding":"identity"});
      raw.pipe(response);
    }
  }else if(filePath == '/embed6'){
    console.log('equal 6');
    var raw = fs.createReadStream('./embed6.html');
    if (acceptEncoding.match(/\bgzip\b/)) {
      console.log("gzip");
      response.writeHead(200, {"Content-Type": "text/html", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "X-FS-Origin-Request, X-FS-Embed-Fetch, X-FS-Page-Id, X-Requested-With, X-FS-Embed-Error", "Access-Control-Expose-Headers": "X-FS-Embed-Error", "Content-Encoding":"gzip"});
      raw.pipe(zlib.createGzip()).pipe(response);
    } else {
      console.log("raw");
      response.writeHead(200, {"Content-Type": "text/html", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "X-FS-Origin-Request, X-FS-Embed-Fetch, X-FS-Page-Id, X-Requested-With, X-FS-Embed-Error", "Access-Control-Expose-Headers": "X-FS-Embed-Error", "Content-Encoding":"identity"});
      raw.pipe(response);
    }
  }else if(filePath == '/embed4'){
    console.log('equal 4');
    var raw = fs.createReadStream('./embed4.html');
    if (acceptEncoding.match(/\bgzip\b/)) {
      console.log("gzip");
      response.writeHead(200, { 'Content-Encoding': 'gzip' });
      raw.pipe(zlib.createGzip()).pipe(response);
    } else {
      console.log("raw");
      response.writeHead(200, { 'Content-Encoding': 'identity'});
      raw.pipe(response);
    }
  }else if(filePath == '/embed5'){
    console.log('equal 5');
    var raw = fs.createReadStream('./embed5.json');
    if (acceptEncoding.match(/\bgzip\b/)) {
      console.log("gzip");
      response.writeHead(200, {"Content-Type": "application/json", "X-FS-TL": "http://czhenggu-ld1:6661/jos.js", "X-FS-Template-Keys":"__default__=alien", "Content-Encoding":"gzip"});
      raw.pipe(zlib.createGzip()).pipe(response);
    } else {
      console.log("raw");
      response.writeHead(200, {"Content-Type": "application/json", "X-FS-TL": "http://czhenggu-ld1:6661/jos.js", "X-FS-Template-Keys":"__default__=alien", "Content-Encoding":"identity"});
      raw.pipe(response);
    }
  }else if(filePath == '/ussr.html'){
    console.log('equal ussr');
    var raw = fs.createReadStream('./ussr.html');
    if (acceptEncoding.match(/\bgzip\b/)) {
      console.log("gzip");
      response.writeHead(200, {"Content-Type": "text/html", "X-FS-Page-Parse": "1", "Content-Encoding":"gzip"});
      raw.pipe(zlib.createGzip()).pipe(response);
    } else {
      console.log("raw");
      response.writeHead(200, {"Content-Type": "text/html", "X-FS-Page-Parse": "1", "Content-Encoding":"identity"});
      raw.pipe(response);
    }
  }else if(filePath == '/test.txt'){
    console.log('equal txt');
    var raw = fs.createReadStream('./test.txt');
    if (acceptEncoding.match(/\bgzip\b/)) {
      console.log("gzip");
      response.writeHead(200, {"Content-Type": "text/plain", "Content-Encoding":"gzip"});
      raw.pipe(zlib.createGzip()).pipe(response);
    } else {
      console.log("raw");
      response.writeHead(200, {"Content-Type": "text/plain", "Content-Encoding":"identity"});
      raw.pipe(response);
    }
  }else if(filePath == '/simpleEmbed.jpg'){
    console.log('simpleEmbed.jpg');
    var raw = fs.createReadStream('./simpleEmbed.jpg');
    if (acceptEncoding.match(/\bgzip\b/)) {
      console.log("gzip");
      response.writeHead(200, { 'Content-Encoding': 'gzip' });
      raw.pipe(zlib.createGzip()).pipe(response);
    } else {
      console.log("raw");
      response.writeHead(200, { 'Content-Encoding': 'identity'});
      raw.pipe(response);
    }
  }else if(filePath == '/serverRender.jpg'){
    console.log('serverRender.jpg');
    var raw = fs.createReadStream('./serverRender.jpg');
    if (acceptEncoding.match(/\bgzip\b/)) {
      console.log("gzip");
      response.writeHead(200, { 'Content-Encoding': 'gzip' });
      raw.pipe(zlib.createGzip()).pipe(response);
    } else {
      console.log("raw");
      response.writeHead(200, { 'Content-Encoding': 'identity'});
      raw.pipe(response);
    }
  }else if(filePath == '/customRender.jpg'){
    console.log('customRender.jpg');
    var raw = fs.createReadStream('./customRender.jpg');
    if (acceptEncoding.match(/\bgzip\b/)) {
      console.log("gzip");
      response.writeHead(200, { 'Content-Encoding': 'gzip' });
      raw.pipe(zlib.createGzip()).pipe(response);
    } else {
      console.log("raw");
      response.writeHead(200, { 'Content-Encoding': 'identity'});
      raw.pipe(response);
    }
  }else if(filePath == '/xhr.jpg'){
    console.log('xhr.jpg');
    var raw = fs.createReadStream('./xhr.jpg');
    if (acceptEncoding.match(/\bgzip\b/)) {
      console.log("gzip");
      response.writeHead(200, { 'Content-Encoding': 'gzip' });
      raw.pipe(zlib.createGzip()).pipe(response);
    } else {
      console.log("raw");
      response.writeHead(200, { 'Content-Encoding': 'identity'});
      raw.pipe(response);
    }
  }else if(filePath == '/favicon.ico'){
    console.log('ico');
  } else {
    console.log('not equal');
    var raw = fs.createReadStream('./test.html');
    if (acceptEncoding.match(/\bgzip\b/)) {
      console.log("gzip");
      response.writeHead(200, {"Content-Type": "text/html", "X-FS-Page-Parse": "1", "Content-Encoding":"gzip"});
      raw.pipe(zlib.createGzip()).pipe(response);
    } else {
      console.log("raw");
      response.writeHead(200, {"Content-Type": "text/html", "X-FS-Page-Parse": "1", "Content-Encoding":"Identity"});
      raw.pipe(response);
    }
  }
});

// Listen on port 8000, IP defaults to 127.0.0.1
server.listen(4000);

// Put a friendly message on the terminal
console.log("Server running at http://127.0.0.1:4000/");
