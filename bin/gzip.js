// server example
// Running a gzip operation on every request is quite expensive.
// It would be much more efficient to cache the compressed buffer.
var zlib = require('zlib');
var http = require('http');
var fs = require('fs');
http.createServer(function(request, response) {
  var raw = fs.createReadStream('index.html');
  var acceptEncoding = request.headers['accept-encoding'];
  console.log("acceptEncoding"+ acceptEncoding);
  if (!acceptEncoding) {
    acceptEncoding = 'identity';
  }

  // Note: this is not a conformant accept-encoding parser.
  // See http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.3
  //if (acceptEncoding.match(/\bdeflate\b/)) {
  //  console.log("deflate");
  //  response.writeHead(200, { 'Content-Encoding': 'deflate' });
  //  raw.pipe(zlib.createDeflate()).pipe(response);
  if (acceptEncoding.match(/\bgzip\b/)) {
    console.log("gzip");
    response.writeHead(200, { 'Content-Encoding': 'gzip', 'content-type':'text/html' });
    raw.pipe(zlib.createGzip()).pipe(response);
  } else {
    console.log("raw");
    response.writeHead(200, { 'Content-Encoding': 'identity'});
    raw.pipe(response);
  }
}).listen(4000);
